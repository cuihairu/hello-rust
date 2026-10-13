# 自定义分配器

Rust 程序默认走系统分配器（Linux 上是 glibc 的 malloc），但分配行为可以整体替换：实现 `GlobalAlloc` trait 并挂上 `#[global_allocator]`，全程序的 `Box`/`Vec`/`String` 都会经过你的代码。核心知识点：**`GlobalAlloc` + `Layout` 的机制**，以及**为什么/如何换成 jemalloc、mimalloc 或专用分配器**。

## `Layout`：分配请求的形状

分配器拿到的不是类型，而是 `Layout`——大小与对齐。`Layout::new::<T>()` 查询任意类型的布局：

```rust
use std::alloc::Layout;

fn main() {
    let l1 = Layout::new::<u64>();
    println!("u64:   size = {}, align = {}", l1.size(), l1.align());
    let l2 = Layout::new::<u8>();
    println!("u8:    size = {}, align = {}", l2.size(), l2.align());
    let l3 = Layout::array::<u8>(10).unwrap();
    println!("[u8;10]: size = {}, align = {}", l3.size(), l3.align());
    let l4 = Layout::new::<String>();
    println!("String: size = {}, align = {}", l4.size(), l4.align());
    let l5 = Layout::new::<[u64; 4]>();
    println!("[u64;4]: size = {}, align = {}", l5.size(), l5.align());
}
```

真实运行输出（rustc 1.99.0，x86_64）：

```text
u64:   size = 8, align = 8
u8:    size = 1, align = 1
[u8;10]: size = 10, align = 1
String: size = 24, align = 8
[u64;4]: size = 32, align = 8
```

`String` 是 24 字节（指针 + 容量 + 长度三个 usize）。写自定义分配器时，`layout.align()` 决定返回地址必须满足的对齐，不能只看 `size()`。

## `GlobalAlloc` 与 `#[global_allocator]`

实现 `GlobalAlloc` 只需 `alloc`/`dealloc` 两个核心方法（零大小分配返回非空指针等契约见 trait 文档）。一个统计分配次数的分配器：

```rust
use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

struct CountingAlloc;

static ALLOCS: AtomicUsize = AtomicUsize::new(0);
static BYTES: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::SeqCst);
        BYTES.fetch_add(layout.size(), Ordering::SeqCst);
        // 计数本身不能递归分配，转发给系统分配器
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static GLOBAL: CountingAlloc = CountingAlloc;

fn main() {
    let mut v: Vec<String> = Vec::new();
    for i in 0..3 {
        v.push(format!("item-{i}"));
    }
    println!("v = {v:?}");
    println!("alloc 次数 = {}, 分配总字节 = {}", ALLOCS.load(Ordering::SeqCst), BYTES.load(Ordering::SeqCst));
}
```

真实运行输出（三个字符串居然触发 7 次分配——`format!`、`Vec` 扩容各有开销；具体数值随 std 版本与平台变化）：

```text
v = ["item-0", "item-1", "item-2"]
alloc 次数 = 7, 分配总字节 = 1698
```

两个关键点：`unsafe impl`——你向编译器承诺实现满足契约；计数必须用原子操作且**绝不能再触发分配**（否则无限递归），所以转发给 `System`。

## no_std 下的 bump 分配器

WASM、内核这类环境没有系统 malloc，往往自带一个极简分配器。bump（arena）分配器只前进、不回收，程序结束一次性归还——分配快如指针递增。下面是编译到 `wasm32-unknown-unknown` 的完整例子（`cdylib`，`Cargo.toml` 里设 `panic = "abort"`）：

```rust
#![no_std]

use core::alloc::{GlobalAlloc, Layout};
use core::sync::atomic::{AtomicUsize, Ordering};

/// 极简 bump 分配器：只前进、不回收
struct BumpAlloc {
    next: AtomicUsize,
}

const HEAP_START: usize = 0x10000;

unsafe impl GlobalAlloc for BumpAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let start = self.next.fetch_add(layout.size(), Ordering::SeqCst);
        let aligned = (start + layout.align() - 1) & !(layout.align() - 1);
        self.next.store(aligned + layout.size(), Ordering::SeqCst);
        aligned as *mut u8
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {
        // bump 分配器故意不回收
    }
}

#[global_allocator]
static ALLOC: BumpAlloc = BumpAlloc {
    next: AtomicUsize::new(HEAP_START),
};

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

/// 导出一个 wasm 入口，内部验证 bump 分配器可用
#[no_mangle]
pub extern "C" fn main() -> u32 {
    let p = unsafe { ALLOC.alloc(Layout::new::<u32>()) };
    unsafe { core::ptr::write(p, 42) };
    let v = unsafe { core::ptr::read(p) };
    if v == 42 { 0 } else { 1 }
}
```

真实构建与验证（本环境实测，rustc 1.99.0）：

```text
$ cargo build --release --target wasm32-unknown-unknown
    Finished `release` profile [optimized] target(s) in 0.06s
$ node -e "...WebAssembly.instantiate(bump_alloc.wasm)..."
wasm main() 返回: 0        # 0 = 分配、写入、读回全部成功
```

`main` 返回 0 表示分配的 u32 写入 42 后能正确读回。bump 分配器的短板同样明显：不回收、对齐处理是简化的（演示级），真实项目用 `bumpalo` 这类成熟 crate。

## 换成 jemalloc / mimalloc

多数程序不需要手写分配器，直接换现成的：加依赖后一行挂上。mimalloc（Microsoft）：

```rust
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
```

tikv-jemallocator（jemalloc 的 Rust 绑定，TiKV 等生产项目在用）：

```rust
use tikv_jemallocator::Jemalloc;

#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;
```

真实运行验证（本环境 cargo add mimalloc / tikv-jemallocator 后，`Vec<String>` 三个字符串的程序两个分配器都能正常编译运行，输出同上 `v = ["item-0", "item-1", "item-2"]`）。什么时候值得换：多线程高并发分配成为瓶颈、需要 jemalloc 的堆分析（profile）能力时；换完务必用自己的负载实测，没有普适赢家。

## 注意事项

- **`#[global_allocator]` 全程序唯一**：多个定义会编译错误；想局部换分配器，用 nightly 的 `Allocator` API（`Box::new_in` 等）。
- **分配器里不能分配**：日志、锁、String 都可能递归，`GlobalAlloc` 实现里只能用原子与 `System`。
- **契约是 unsafe 承诺**：对齐不满足、零大小返回悬空指针，都是未定义行为。

## 相关页面

- [所有权与移动语义](../language-core/ownership-and-move)——分配的内存何时释放，由所有权决定。
- [Drop 与析构](./drop-and-destructors)——释放路径的另一半。
- [交叉编译](./cross-compilation)——wasm 等 no_std 目标正是自定义分配器的主场。

官方文档：<https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html>
