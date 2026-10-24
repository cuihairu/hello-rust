# Send and Sync

Thread safety in Rust is not a documentation convention but a compile-time fact about two automatic traits: `Send` (a value can be safely **moved** to another thread) and `Sync` (a reference can be safely **shared** with another thread). The core takeaways: **their inference rules and real error messages**, and **the motivation and cost of `unsafe impl`**.

This page discusses how ordinary types satisfy the thread-safety boundary; for `Send` constraints when an async future holds data across an `.await` and how to fix them, see [the Send problem in async and async trait](../async/async-send-and-async-trait).

## Automatic traits and inference rules

Both are marker traits (no methods) that the compiler **infers automatically** from fields/members: if all fields of a struct are `Send`, the struct is `Send`. The rules boil down to three sentences:

- `T: Sync` is equivalent to `&T: Send` — only what can be safely shared as a reference is called thread-safe;
- manually implementing a field can change the conclusion: `unsafe impl Send for MyType` / `unsafe impl Sync for MyType`;
- the blacklist (cases where the compiler refuses to infer automatically): raw pointers `*const T`/`*mut T` are neither `Send` nor `Sync`; `Rc<T>` is neither `Send` nor `Sync`; `Cell<T>`/`RefCell<T>` are `Send` but not `Sync`.

## Raw pointers `!Send`: the real error from moving a pointer into a thread

Raw pointers carry no ownership information, so the compiler cannot prove that the data they point to is still valid when accessed from another thread, and refuses outright:

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

Actual compiler error (stable, rustc 1.99.0):

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

The error also exposes the full boundary of `thread::spawn`: the closure must be `F: Send + 'static`. Swapping the raw pointer for an `Rc` yields the same E0277 (`Rc<i32> cannot be sent between threads safely`) — the reference count is non-atomic, so sharing across threads would miscount.

## The `'static` boundary: another wall for stack data

Beyond `Send` there is also `'static`: passing a reference to stack data into a thread is rejected even if the type itself is thread-safe:

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

Actual compiler error:

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

The thread may still be alive after the function returns, while `n` is reclaimed — `'static` is exactly what eliminates dangling at compile time. The fix is `Arc` (heap sharing) or scoped threads (see [fearless concurrency](./threads-and-channels)).

## `unsafe impl Send`: motivation and cost

A type that genuinely holds a raw pointer but **knows** it is safe across threads (for example the pointed-to data is not freed before join, and not concurrently written) can promise it by hand:

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

Actual run output:

```text
读到: 42
join 完成，x = 42
```

The code is full of traces of promises being kept: `join()` guarantees the thread ends first (so `x` is still alive), and the closure only reads (no data race). If the promise is ever a lie — remove the join, or have another thread write `x` at the same time — the compiler will not stop you; it is straight-up undefined behavior. The data race definition the Nomicon gives: **two or more threads access the same memory location without synchronizing, and at least one of them is a non-atomic write**. Safe Rust guarantees this never happens, precisely because `Send`/`Sync` keep unsafe combinations out at compile time.

One real footgun worth noting: if you write `*w.0` directly inside the closure, edition 2021's precise captures (RFC 2229) capture only the `w.0` raw pointer field, so `unsafe impl Send for PtrWrapper` never comes into play and E0277 fires all the same — the code above deliberately calls the `w.read()` method, so the closure captures the **whole** wrapper and the Send promise takes effect.

## `Arc<Mutex<T>>`: thread-safe shared mutability

When multiple threads mutate the same value, the standard answer is to stack the three — `Arc` manages sharing (its count is atomic, so it is `Send + Sync`), `Mutex` manages mutual exclusion (`Mutex<T>: Sync` requires `T: Send`), and the inner data is protected by the lock:

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

Actual run output:

```text
counter = 4
```

Why this combination passes the check: every layer of `Arc<Mutex<i32>>` is `Send + Sync`, and moving an `Arc` clone into the closure satisfies `Send + 'static`. Compare with the single-threaded `Rc<RefCell<T>>` — the structure maps perfectly (sharing + interior mutability), with each part just swapped for its thread-safe version.

## Notes and common pitfalls

- **`Send`/`Sync` are inferred structurally**: adding a `PhantomData<*mut ()>` field to a struct containing a raw pointer infects it with `!Send`; the only workaround is `unsafe impl`.
- **`Rc` reporting E0277 across threads is about the count, not the data**: `Rc::clone` also reads and writes the count.
- **Lock poisoning**: after a thread holding the lock panics, `lock()` returns `Err`, and `.unwrap()` propagates the panic — this is a design choice, not an accident.

## References

- Official docs: "The Rustonomicon" · Send and Sync: <https://doc.rust-lang.org/nomicon/send-and-sync.html>

## Related pages

- [Fearless concurrency](./threads-and-channels) — the full picture of `spawn`, channels, and locks.
- [Smart pointers](./smart-pointers) — the root of the difference between `Rc` and `Arc`.
- [Interior mutability](./interior-mutability) — why `Cell`/`RefCell` are not `Sync`.
- [Glossary](../glossary) — the site-wide Chinese-English dictionary of core terms with authoritative sources.
