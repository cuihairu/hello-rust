# Send 与 Sync

线程安全在 Rust 里不是文档约定，而是两个自动 trait 的编译期事实：`Send`（值可以安全地**转移**到别的线程）与 `Sync`（引用可以安全地**共享**给别的线程）。核心知识点：**它们的推导规则与真实报错**，以及**`unsafe impl` 的动机与代价**。

## 自动 trait 与推导规则

两者都是标记 trait（marker，无方法），由编译器按字段/成员**自动推导**：一个 struct 的所有字段都是 `Send`，它就是 `Send`。规则浓缩成三句：

- `T: Sync` 等价于 `&T: Send`——能安全共享引用，才叫线程安全；
- 手动实现字段可以改变结论：`unsafe impl Send for MyType` / `unsafe impl Sync for MyType`；
- 负面清单（编译器拒绝自动推导）：裸指针 `*const T`/`*mut T` 既不 `Send` 也不 `Sync`；`Rc<T>` 不 `Send` 也不 `Sync`；`Cell<T>`/`RefCell<T>` 是 `Send` 但不 `Sync`。

## 裸指针 `!Send`：把指针送进线程的真实报错

裸指针没有所有权信息，编译器无法证明它指向的数据在另一个线程访问时仍有效，所以直接拒绝：

```rust
use std::thread;

fn main() {
    let x = 42;
    let p: *const i32 = &x; // 裸指针
    let h = thread::spawn(move || {
        println!("{:?}", p);
    });
    h.join().unwrap();
}
```

真实编译报错（stable，rustc 1.99.0）：

```text
error[E0277]: `*const i32` cannot be sent between threads safely
   --> p5_raw_ptr_notsend.rs:6:27
    |
  6 |       let h = thread::spawn(move || {
    |               ------------- ^------
    |               |             |
    |  _____________|_____________within this `{closure@p5_raw_ptr_notsend.rs:6:27: 6:34}`
    | |             |
    | |             required by a bound introduced by this call
  7 | |         println!("{:?}", p);
  8 | |     });
    | |_____^ `*const i32` cannot be sent between threads safely
    |
    = help: within `{closure@p5_raw_ptr_notsend.rs:6:27: 6:34}`, the trait `Send` is not implemented for `*const i32`
note: required by a bound in `spawn`
   --> /home/cui/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/std/src/thread/functions.rs:128:8
    |
125 | pub fn spawn<F, T>(f: F) -> JoinHandle<T>
128 |     F: Send + 'static,
    |        ^^^^ required by this bound in `spawn`
```

报错同时暴露了 `thread::spawn` 的完整边界：闭包必须 `F: Send + 'static`。把裸指针换成 `Rc` 会得到同款 E0277（`Rc<i32> cannot be sent between threads safely`）——引用计数是非原子的，跨线程会数错。

## `'static` 边界：栈上数据的另一道墙

`Send` 之外还有 `'static`：借了栈上数据的引用送进线程，即使类型本身线程安全也会被拒：

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;

fn main() {
    let n = AtomicUsize::new(0);
    let r = &n;
    let h = thread::spawn(move || {
        for _ in 0..1000 {
            r.fetch_add(1, Ordering::SeqCst);
        }
    });
    h.join().unwrap();
}
```

真实编译报错：

```text
error[E0597]: `n` does not live long enough
  --> p5_static_err.rs:6:13
   |
5  |       let n = AtomicUsize::new(0);
   |           - binding `n` declared here
6  |       let r = &n;
   |               ^^ borrowed value does not live long enough
7  |       let h = thread::spawn(move || {
  |  _____________-
8  | |         for _ in 0..1000 {
9  | |             r.fetch_add(1, Ordering::SeqCst);
10 | |         }
11 | |     });
   | |______- argument requires that `n` is borrowed for `'static`
12 |       h.join().unwrap();
13 |   }
   |     - `n` dropped here while still borrowed
```

线程可能在函数返回后还活着，而 `n` 会被回收——`'static` 就是在编译期杜绝悬垂。解法是 `Arc`（堆上共享）或 scoped threads（见[无畏并发](./threads-and-channels)）。

## `unsafe impl Send`：动机与代价

确实握着裸指针、但**知道**它跨线程安全的类型（例如指针指向的数据在 join 前不会被释放、也不并发写），可以手工承诺：

```rust
use std::thread;

/// 把裸指针包成可跨线程的类型：unsafe impl Send 的动机与代价
struct PtrWrapper(*const i32);

// 安全性承诺：指针指向的数据在目标线程使用期间保持有效，
// 且不会与别的线程并发写（本例只读）
unsafe impl Send for PtrWrapper {}

impl PtrWrapper {
    fn read(&self) -> i32 {
        // SAFETY：构造方保证指针有效且无并发写
        unsafe { *self.0 }
    }
}

fn main() {
    let x = 42;
    let w = PtrWrapper(&x);
    let h = thread::spawn(move || {
        println!("读到: {}", w.read()); // 方法调用捕获整个 Send 的 wrapper
    });
    h.join().unwrap();
    println!("join 完成，x = {x}");
}
```

真实运行输出：

```text
读到: 42
join 完成，x = 42
```

代码里处处是承诺兑现的痕迹：`join()` 保证线程先结束（`x` 仍活着）、闭包只读不写（无数据竞争）。承诺一旦撒谎——去掉 join、或另一个线程同时写 `x`——编译器不会拦你，直接是未定义行为。Nomicon 给出的数据竞争定义：**两个或更多线程未同步地访问同一内存位置，其中至少一个是非原子的写**。Safe Rust 保证它绝不发生，靠的就是 `Send`/`Sync` 把不安全的组合挡在编译期。

顺带一个真实踩坑：闭包里若直接写 `*w.0`，edition 2021 的精确捕获（RFC 2229）只捕获 `w.0` 这个裸指针字段，`unsafe impl Send for PtrWrapper` 根本用不上，照样报 E0277——上面的代码特意用 `w.read()` 方法调用，闭包捕获**整个** wrapper，Send 承诺才生效。

## `Arc<Mutex<T>>`：线程安全的共享可变

多线程改同一个值，标准答案是把三者叠起来——`Arc` 管共享（原子计数所以是 `Send + Sync`）、`Mutex` 管互斥（`Mutex<T>: Sync` 要求 `T: Send`）、内层数据由锁保护：

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            let mut n = c.lock().unwrap();
            *n += 1;
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("counter = {}", *counter.lock().unwrap());
}
```

真实运行输出：

```text
counter = 4
```

这个组合为什么过检：`Arc<Mutex<i32>>` 的每一层都 `Send + Sync`，闭包 move 走一个 `Arc` 克隆即满足 `Send + 'static`。对比单线程的 `Rc<RefCell<T>>`——结构完全对应（共享 + 内部可变性），只是把每个部件换成线程安全版本。

## 注意事项

- **`Send`/`Sync` 是结构推导的**：给含裸指针的 struct 加一个 `PhantomData<*mut ()>` 会传染 `!Send`，绕过办法只有 `unsafe impl`。
- **`Rc` 跨线程报 E0277 不是因为数据，而是因为计数**：`Rc::clone` 也要读写计数。
- **锁中毒（poisoning）**：持锁线程 panic 后 `lock()` 返回 `Err`，`.unwrap()` 会传播恐慌，这是设计而非事故。

## 相关页面

- [无畏并发](./threads-and-channels)——`spawn`/channel/锁的使用全景。
- [智能指针](./smart-pointers)——`Rc` 与 `Arc` 的差异源头。
- [内部可变性](./interior-mutability)——`Cell`/`RefCell` 为什么不是 `Sync`。

官方文档：<https://doc.rust-lang.org/nomicon/send-and-sync.html>
