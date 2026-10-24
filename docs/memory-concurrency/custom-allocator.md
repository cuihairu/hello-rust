# Custom Allocators

A Rust program goes through the system allocator by default (glibc's malloc on Linux), but allocation behavior can be swapped out wholesale: implement the `GlobalAlloc` trait and attach `#[global_allocator]`, and every `Box`/`Vec`/`String` in the program routes through your code. The core takeaways: **how `GlobalAlloc` + `Layout` work**, and **why and how to swap in jemalloc, mimalloc, or a purpose-built allocator**.

## `Layout`: the shape of an allocation request

The allocator receives not a type but a `Layout` — size and alignment. `Layout::new::<T>()` queries the layout of any type:

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

Actual run output (rustc 1.99.0, x86_64):

```text
u64:   size = 8, align = 8
u8:    size = 1, align = 1
[u8;10]: size = 10, align = 1
String: size = 24, align = 8
[u64;4]: size = 32, align = 8
```

`String` is 24 bytes (pointer + capacity + length, three usizes). When writing a custom allocator, `layout.align()` determines the alignment the returned address must satisfy — don't look only at `size()`.

## `GlobalAlloc` and `#[global_allocator]`

Implementing `GlobalAlloc` requires only the two core methods `alloc`/`dealloc` (see the trait docs for contracts such as returning a non-null pointer for zero-size allocations). An allocator that counts allocations:

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

Actual run output (three strings happen to trigger 7 allocations — `format!` and `Vec` growth each carry overhead; exact numbers vary with std version and platform):

```text
v = ["item-0", "item-1", "item-2"]
alloc 次数 = 7, 分配总字节 = 1698
```

Two key points: `unsafe impl` — you promise the compiler that your implementation satisfies the contracts; the counting must use atomics and **must never itself trigger an allocation** (otherwise infinite recursion), so it forwards to `System`.

## Bump allocator under no_std

Environments like WASM and kernels have no system malloc and usually carry a minimal allocator of their own. A bump (arena) allocator only advances, never reclaims; the whole heap is returned at once at program exit — allocation is as fast as a pointer increment. Below is a complete example compiled to `wasm32-unknown-unknown` (`cdylib`, with `panic = "abort"` set in `Cargo.toml`):

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

Actual build and verification (measured on this machine, rustc 1.99.0):

```text
$ cargo build --release --target wasm32-unknown-unknown
    Finished `release` profile [optimized] target(s) in 0.06s
$ node -e "...WebAssembly.instantiate(bump_alloc.wasm)..."
wasm main() 返回: 0        # 0 = 分配、写入、读回全部成功
```

`main` returning 0 means the u32 was correctly read back after writing 42. The bump allocator's weaknesses are equally obvious: no reclamation, and alignment handling is simplified (demo-grade); real projects use a mature crate like `bumpalo`.

## Swapping in jemalloc / mimalloc

Most programs don't need a hand-written allocator; just swap in an off-the-shelf one: add the dependency and wire it up in one line. mimalloc (Microsoft):

```rust
use mimalloc::MiMalloc;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
```

tikv-jemallocator (Rust bindings for jemalloc, used in production by TiKV and others):

```rust
use tikv_jemallocator::Jemalloc;

#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;
```

Actual run verification (measured on this machine, after cargo add mimalloc / tikv-jemallocator, both allocators compile and run the three-`Vec<String>` program normally, with the same output as above, `v = ["item-0", "item-1", "item-2"]`). When is it worth swapping: when multithreaded high-concurrency allocation becomes the bottleneck, or when you need jemalloc's heap-profiling capability; after swapping, be sure to measure with your own workload — there is no universal winner.

## Notes and common pitfalls

- **`#[global_allocator]` is unique per program**: multiple definitions cause a compile error; to swap allocators locally, use the nightly `Allocator` API (`Box::new_in` and friends).
- **No allocation inside the allocator**: logging, locks, and String can all recurse, so a `GlobalAlloc` implementation may only use atomics and `System`.
- **The contracts are an unsafe promise**: misaligned returns, or returning a dangling pointer for zero size, are all undefined behavior.

## References

- Official docs: std library · GlobalAlloc in std::alloc: <https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html>

## Related pages

- [Ownership and move semantics](../language-core/ownership-and-move) — when allocated memory is released is decided by ownership.
- [Drop and destructors](./drop-and-destructors) — the other half of the release path.
- [Cross-compilation](./cross-compilation) — no_std targets like wasm are exactly the natural home for custom allocators.
- [Glossary](../glossary) — the site-wide Chinese-English dictionary of core terms with authoritative sources.
