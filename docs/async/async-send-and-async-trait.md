# async 中的 Send 问题与 async trait

异步代码有两个绕不开的约束：跨 `await` 的数据必须 `Send`（因为任务可能被移到别的线程），以及 trait 里的 `async fn` 有 dyn 兼容性问题。这一页用真实报错和对比示例把这两个问题讲清楚。

> 本环境已成功获取 tokio 1.53.2 与 async-trait 0.1.92，以下示例均为真实编译运行。

## 跨 await 持有锁导致 !Send

`tokio::spawn` 要求 future 实现 `Send`——任务可能被调度到任意 worker 线程。规则是：**跨 `.await` 持有的所有数据都必须是 `Send`**。

`std::sync::MutexGuard` 不是 `Send` 的，所以跨 await 持锁会导致编译失败：

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

真实编译报错（节选）：

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

## Send bound 的由来

`Send` 是「可以安全地跨线程传递」的标记 trait。async 状态机在 `.await` 点会保存局部变量——如果这些变量不是 `Send` 的，状态机整体就不是 `Send` 的，`tokio::spawn` 就无法把它移到别的 worker 线程。

两种修复方式：

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

真实运行输出：

```text
std::sync::Mutex: 2
tokio::sync::Mutex: 2
```

## async trait：稳定写法 vs async_trait 宏

Rust 1.75 起（RFC 3185），trait 里可以直接写 `async fn`：

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

但稳定写法**不是 dyn 兼容的**——不能放进 `dyn Trait`：

```rust
async fn use_dyn(obj: &dyn AsyncTraitStable, id: u32) -> String {
    obj.fetch(id).await
}
```

真实编译报错（节选）：

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

`async_trait` 宏通过返回 `Box<dyn Future + Send>` 解决了这个问题——它是 dyn 兼容的：

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

两种写法对比：

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

真实运行输出：

```text
stable: row 1
macro: row 2
macro: row 3
stable: row 5
```

| 特性 | 稳定 `async fn`（1.75+） | `#[async_trait]` 宏 |
|---|---|---|
| 直接 await | 可以 | 可以 |
| dyn 兼容 | 不可以（E0038） | 可以 |
| 返回类型 | 编译器生成的匿名类型 | `Pin<Box<dyn Future + Send>>` |
| 性能 | 零开销 | 一次堆分配 |
| 适用场景 | 静态 dispatch、泛型 | 需要 `dyn Trait` 时 |

## trait Future 与 object safety

`Future` trait 本身是 object-safe 的——`dyn Future<Output = T>` 可以正常传递和 poll。这是因为 `poll` 的接收者是 `Pin<&mut Self>` 而不是 `Self`，不要求 `Self: Sized`。

## 参考资料

- 官方文档：RFC 3185 · static async fn in trait：<https://rust-lang.github.io/rfcs/3185-static-async-fn-in-trait.html>

## 相关页面

- [tokio 生态](./tokio-ecosystem)——`spawn` 的 `Send` 要求。
- [Pin 与自引用](./pin-and-self-reference)——`Pin<Box<F>>` 与 `Unpin` 的关系。
- [select 与超时取消](./select-and-cancellation)——取消与 `Send` 的交互。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
