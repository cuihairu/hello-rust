# select, Timeouts and Cancellation

In async code, "wait for whichever finishes first" and "actively cancel" are high-frequency needs. tokio provides the `select!` macro, the `timeout` function, and `CancellationToken`. The focus of this page is: **the future in the losing branch of a select is dropped outright** — that is the semantic foundation of async cancellation.

> This environment successfully acquired tokio 1.53.2 and tokio-util 0.7.20 (CancellationToken); all examples below were actually compiled and run.

## tokio::select!: Wait for the First One to Finish

`select!` takes several branches and returns the result of whichever future finishes first. **The futures in the other branches are dropped**:

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

Because the sleep branch expires first, the future for `do_something_slow` is dropped and the program returns `timeout 分支` after 30 seconds.

## The Future in the Losing Branch Is Really Dropped

The example below proves it with the `Drop` trait: the future type in the losing branch is dropped after select returns.

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

Actual run output:

```text
>>> Noisy(慢分支) 被 drop 了
场景 1 胜者: sleep 分支；慢分支被 poll 了 44508 次后被丢弃

>>> Noisy(快分支) 被 drop 了
场景 2 胜者: Noisy 分支；总耗时: 38.819µs（远小于 30 秒 = sleep 分支被丢弃）
```

Two key observations:

- **Scenario 1**: the sleep branch won, and `Noisy(慢分支)` was dropped after select returned — even though it had been polled 44508 times (because select keeps polling until some branch completes).
- **Scenario 2**: the Noisy branch became Ready on its 3rd poll, and the 30-second sleep branch was discarded. Had the sleep branch not been discarded, the program would have had to wait the full 30 seconds — but the actual total elapsed time was only 38.8µs.
- **The future in the winning branch is dropped too**: in scenario 2, `Noisy(快分支) 被 drop 了` appears before the winner is printed, because after select returns its temporary value goes out of scope.

This is the cancellation model of async Rust: **cancel = drop the future**. A task cannot keep running in the background unless you explicitly `spawn` a task that does not depend on the select.

## tokio::time::timeout

`timeout` is more concise than `select!` and returns `Result<T, Elapsed>`:

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

Actual run output:

```text
timeout 结果: 超时（慢任务已被丢弃）
```

## CancellationToken: Cooperative Cancellation

Both `timeout` and `select!` are "hard cancellation" — they drop the future directly, so the task has no chance to clean up. `CancellationToken` (provided by tokio-util) is **cooperative** cancellation: the task periodically checks the token and decides for itself when to exit.

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

Actual run output:

```text
worker: 工作中（第 0 轮）
worker: 工作中（第 1 轮）
worker: 工作中（第 2 轮）
worker: 工作中（第 3 轮）
main: 发出取消信号
worker: 检测到取消信号，在第 4 轮退出
main: worker 已退出
```

Cooperative cancellation suits long-running tasks: the worker can release resources, persist state, and notify other tasks. Hard cancellation (drop) cannot do any of these.

## References

- Official docs: The Tokio Tutorial · Select: <https://tokio.rs/tokio/tutorial/select>

## Related pages

- [The tokio Ecosystem](./tokio-ecosystem) — runtime, spawn, JoinHandle.
- [Executors and Runtimes](./executors-and-runtime) — the relationship between select and the executor's event loop.
- [Send in Async and async trait](./async-send-and-async-trait) — how cancellation interacts with Send.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
