# Send in Async and async trait

Async code has two unavoidable constraints: data held across an `await` must be `Send` (because a task may be moved to another thread), and `async fn` inside a trait has dyn-compatibility problems. This page explains both problems using real compiler errors and contrasting examples.

This page focuses on the `Send` requirement for the Future state machine across `.await` points, and on async trait; for the auto-derivation of `Send`/`Sync` on ordinary types and the safety promises of `unsafe impl`, see [Send and Sync](../memory-concurrency/send-and-sync).

> This environment successfully acquired tokio 1.53.2 and async-trait 0.1.92; all examples below were actually compiled and run.

## Holding a Lock Across an Await Makes It !Send

`tokio::spawn` requires the future to implement `Send` — because a task may be scheduled onto any worker thread. The rule is: **all data held across an `.await` must be `Send`**.

`std::sync::MutexGuard` is not `Send`, so holding a lock across an await causes a compile failure:

```rust
use std::sync::Mutex;

async fn bad() {
    let m = Mutex::new(1);
    let guard = m.lock().unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(1)).await; // 跨 await 持锁
    println!("{guard}");
}

#[tokio::main]
async fn main() {
    tokio::spawn(bad()).await.unwrap(); // 编译错误
}
```

Actual compiler error (excerpt):

```text
error: future cannot be sent between threads safely
   --> src/bin/err_send.rs:14:18
    |
 14 |     tokio::spawn(bad()).await.unwrap();
    |                  ^^^^^ future returned by `bad` is not `Send`
    |
    = help: within `impl Future<Output = ()>`, the trait `Send` is not implemented for `std::sync::MutexGuard<'_, i32>`
note: future is not `Send` as this value is used across an await
   --> src/bin/err_send.rs:8:61
    |
  7 |     let guard = m.lock().unwrap();
    |         ----- has type `std::sync::MutexGuard<'_, i32>` which is not `Send`
  8 |     tokio::time::sleep(std::time::Duration::from_millis(1)).await; // 跨 await 持锁
    |                                                             ^^^^^ await occurs here, with `guard` maybe used later
```

## Where the Send Bound Comes From

`Send` is a marker trait meaning "can be safely transferred across threads". An async state machine stores local variables at each `.await` point — if those variables are not `Send`, the state machine as a whole is not `Send`, and `tokio::spawn` cannot move it onto another worker thread.

Two ways to fix it:

```rust
use std::sync::Mutex;
use tokio::sync::Mutex as TokioMutex;

// 修复 1：tokio::sync::Mutex 的 guard 是 Send 的——
// 它内部用异步锁实现，await 时锁会释放，不阻塞 worker 线程。
async fn fix_tokio_mutex() {
    let m = TokioMutex::new(1);
    let mut guard = m.lock().await;
    *guard += 1;
    tokio::time::sleep(std::time::Duration::from_millis(1)).await; // 跨 await 持锁 OK
    println!("tokio::sync::Mutex: {guard}");
}

// 修复 2：std::sync::Mutex 的 guard 在 await 之前就 drop
async fn fix_scoped() {
    let m = Mutex::new(1);
    {
        let mut guard = m.lock().unwrap();
        *guard += 1;
        println!("std::sync::Mutex: {guard}");
    } // guard 在这里 drop
    tokio::time::sleep(std::time::Duration::from_millis(1)).await;
}

#[tokio::main]
async fn main() {
    tokio::join!(fix_tokio_mutex(), fix_scoped());
}
```

Actual run output:

```text
std::sync::Mutex: 2
tokio::sync::Mutex: 2
```

## async trait: The Stable Form vs the async_trait Macro

As of Rust 1.75 (RFC 3185), you can write `async fn` directly in a trait:

```rust
trait AsyncTraitStable {
    async fn fetch(&self, id: u32) -> String;
}

struct Db;

impl AsyncTraitStable for Db {
    async fn fetch(&self, id: u32) -> String {
        format!("stable: row {id}")
    }
}
```

But the stable form is **not dyn-compatible** — it cannot be put behind `dyn Trait`:

```rust
async fn use_dyn(obj: &dyn AsyncTraitStable, id: u32) -> String {
    obj.fetch(id).await
}
```

Actual compiler error (excerpt):

```text
error[E0038]: the trait `AsyncTraitStable` is not dyn compatible
  --> src/bin/async_trait.rs:31:24
   |
31 | async fn use_dyn(obj: &dyn AsyncTraitStable, id: u32) -> String {
   |                        ^^^^^^^^^^^^^^^^^^^^ `AsyncTraitStable` is not dyn compatible
   |
  --> src/bin/async_trait.rs:6:14
   |
 5 | trait AsyncTraitStable {
   |       ---------------- this trait is not dyn compatible...
 6 |     async fn fetch(&self, id: u32) -> String;
   |              ^^^^^ ...because method `fetch` is `async`
```

The `async_trait` macro solves this by returning `Box<dyn Future + Send>` — it is dyn-compatible:

```rust
#[async_trait::async_trait]
trait AsyncTraitMacro {
    async fn load(&self, id: u32) -> String;
}

#[async_trait::async_trait]
impl AsyncTraitMacro for Db {
    async fn load(&self, id: u32) -> String {
        format!("macro: row {id}")
    }
}
```

Comparing the two forms:

```rust
#[tokio::main]
async fn main() {
    let db = Db;
    println!("{}", db.fetch(1).await);
    println!("{}", db.load(2).await);

    // 宏写法是 dyn 兼容的：可以放进 trait object
    let obj: &dyn AsyncTraitMacro = &db;
    println!("{}", obj.load(3).await);

    // Future trait 本身是 object-safe 的：dyn Future 可以传递
    let fut: Pin<Box<dyn Future<Output = String> + Send>> = Box::pin(db.fetch(5));
    println!("{}", fut.await);
}
```

Actual run output:

```text
stable: row 1
macro: row 2
macro: row 3
stable: row 5
```

| feature | stable `async fn` (1.75+) | `#[async_trait]` macro |
|---|---|---|
| await directly | yes | yes |
| dyn-compatible | no (E0038) | yes |
| return type | anonymous type generated by the compiler | `Pin<Box<dyn Future + Send>>` |
| performance | zero overhead | one heap allocation |
| use case | static dispatch, generics | when you need `dyn Trait` |

## The Future trait and Object Safety

The `Future` trait itself is object-safe — `dyn Future<Output = T>` can be passed around and polled normally. This is because the receiver of `poll` is `Pin<&mut Self>` rather than `Self`, so `Self: Sized` is not required.

## References

- Official docs: RFC 3185 · static async fn in trait: <https://rust-lang.github.io/rfcs/3185-static-async-fn-in-trait.html>

## Related pages

- [The tokio Ecosystem](./tokio-ecosystem) — the `Send` requirement of `spawn`.
- [Pin and Self-Reference](./pin-and-self-reference) — the relationship between `Pin<Box<F>>` and `Unpin`.
- [select, Timeouts and Cancellation](./select-and-cancellation) — how cancellation interacts with `Send`.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
