# select 与超时取消

在 async 代码里，「等哪个先完成」和「主动取消」是高频需求。tokio 提供 `select!` 宏、`timeout` 函数和 `CancellationToken`。这一页的重点是：**select 落选分支的 future 会被直接丢弃**——这是异步取消的语义基础。

> 本环境已成功获取 tokio 1.53.2 与 tokio-util 0.7.20（CancellationToken），以下示例均为真实编译运行。

## tokio::select!：等第一个完成

`select!` 接受多个分支，等第一个 future 完成就返回它的结果。**其他分支的 future 会被 drop**：

```rust
use std::time::Duration;

#[tokio::main]
async fn main() {
    let winner = tokio::select! {
        v = do_something_slow() => v,
        _ = tokio::time::sleep(Duration::from_secs(30)) => "timeout 分支",
    };
    println!("{winner}");
}

async fn do_something_slow() -> &'static str {
    tokio::time::sleep(Duration::from_secs(60)).await;
    "慢任务完成"
}
```

因为 sleep 分支先到期，`do_something_slow` 的 future 被 drop，程序在 30 秒后返回 "timeout 分支"。

## select 落选分支的 future 真的被丢弃

下面这个示例用 `Drop` trait 证明：落选分支的 future 类型在 select 返回后会被 drop。

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// 带副作用的 future：每次 poll 计数，被 drop 时打印，poll 够次数就 Ready
struct Noisy {
    name: &'static str,
    polls: Arc<AtomicUsize>,
    ready_after: usize,
}

impl std::future::Future for Noisy {
    type Output = &'static str;
    fn poll(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<&'static str> {
        let n = self.polls.fetch_add(1, Ordering::SeqCst) + 1;
        if n >= self.ready_after {
            std::task::Poll::Ready("Noisy 分支")
        } else {
            cx.waker().wake_by_ref();
            std::task::Poll::Pending
        }
    }
}

impl Drop for Noisy {
    fn drop(&mut self) {
        println!(">>> Noisy({}) 被 drop 了", self.name);
    }
}

#[tokio::main]
async fn main() {
    // 场景 1：sleep 先到期，Noisy 分支被丢弃
    let polls = Arc::new(AtomicUsize::new(0));
    let winner = tokio::select! {
        v = Noisy { name: "慢分支", polls: polls.clone(), ready_after: usize::MAX } => v,
        _ = tokio::time::sleep(Duration::from_millis(50)) => "sleep 分支",
    };
    println!("场景 1 胜者: {winner}；慢分支被 poll 了 {} 次后被丢弃\n",
        polls.load(Ordering::SeqCst));

    // 场景 2：Noisy 分支第 3 次 poll 就 Ready，30 秒的 sleep 分支被丢弃。
    // 如果 sleep 分支没被丢弃，这里要等满 30 秒——用总耗时证明它被取消了。
    let start = Instant::now();
    let winner2 = tokio::select! {
        v = Noisy { name: "快分支", polls: Arc::new(AtomicUsize::new(0)), ready_after: 3 } => v,
        _ = tokio::time::sleep(Duration::from_secs(30)) => "sleep 分支",
    };
    println!("场景 2 胜者: {winner2}；总耗时: {:?}（远小于 30 秒 = sleep 分支被丢弃）",
        start.elapsed());
}
```

真实运行输出：

```text
>>> Noisy(慢分支) 被 drop 了
场景 1 胜者: sleep 分支；慢分支被 poll 了 44508 次后被丢弃

>>> Noisy(快分支) 被 drop 了
场景 2 胜者: Noisy 分支；总耗时: 38.819µs（远小于 30 秒 = sleep 分支被丢弃）
```

两个关键观察：

- **场景 1**：sleep 分支赢了，`Noisy(慢分支)` 在 select 返回后被 drop——尽管它被 poll 了 44508 次（因为 select 会不断 poll 直到有分支完成）。
- **场景 2**：Noisy 分支第 3 次 poll 就 Ready，30 秒的 sleep 分支被丢弃。如果 sleep 分支没被丢弃，程序要等满 30 秒——但实际总耗时只有 38.8µs。
- **获胜分支的 future 也会被 drop**：场景 2 中 `Noisy(快分支) 被 drop 了` 出现在 winner 打印之前，因为 select 返回后它的临时值就出作用域了。

这就是异步 Rust 的取消模型：**取消 = drop future**。任务无法在后台继续运行，除非你显式 `spawn` 一个不依赖 select 的任务。

## tokio::time::timeout

`timeout` 比 `select!` 更简洁，返回 `Result<T, Elapsed>`：

```rust
let slow = async {
    tokio::time::sleep(std::time::Duration::from_secs(30)).await;
    "慢任务完成"
};

match tokio::time::timeout(std::time::Duration::from_millis(50), slow).await {
    Ok(v) => println!("timeout 结果: {v}"),
    Err(_) => println!("timeout 结果: 超时（慢任务已被丢弃）"),
}
```

真实运行输出：

```text
timeout 结果: 超时（慢任务已被丢弃）
```

## CancellationToken：协作式取消

`timeout` 和 `select!` 都是「硬取消」——直接 drop future，任务没机会做清理。`CancellationToken`（tokio-util 提供）是**协作式**取消：任务定期检查 token，自己决定何时退出。

```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let child = token.child_token(); // child 被 cancel 时父 token 也 cancel

let worker = tokio::spawn(async move {
    for i in 0.. {
        if child.is_cancelled() {
            println!("worker: 检测到取消信号，在第 {i} 轮退出");
            return;
        }
        println!("worker: 工作中（第 {i} 轮）");
        tokio::time::sleep(std::time::Duration::from_millis(30)).await;
    }
});

tokio::time::sleep(std::time::Duration::from_millis(100)).await;
println!("main: 发出取消信号");
token.cancel();
worker.await.unwrap();
println!("main: worker 已退出");
```

真实运行输出：

```text
worker: 工作中（第 0 轮）
worker: 工作中（第 1 轮）
worker: 工作中（第 2 轮）
worker: 工作中（第 3 轮）
main: 发出取消信号
worker: 检测到取消信号，在第 4 轮退出
main: worker 已退出
```

协作式取消适用于长任务：worker 可以清理资源、持久化状态、通知其他任务。硬取消（drop）做不到这些。

## 参考资料

- 官方文档：Tokio 官方教程 · Select：<https://tokio.rs/tokio/tutorial/select>

## 相关页面

- [tokio 生态](./tokio-ecosystem)——runtime、spawn、JoinHandle。
- [执行器与运行时](./executors-and-runtime)——select 与执行器事件循环的关系。
- [async 中的 Send 问题与 async trait](./async-send-and-async-trait)——取消与 Send 的交互。
