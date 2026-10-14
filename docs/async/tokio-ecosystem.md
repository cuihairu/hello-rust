# tokio 生态

tokio 是 Rust 事实上的异步运行时。它提供执行器（多线程或单线程）、任务调度、定时器、同步原语等。这一页覆盖 runtime、`#[tokio::main]`、`spawn`、`spawn_blocking`、`JoinHandle` 和任务的 `Send` 要求。

> 本环境已成功获取 tokio 1.53.2（features: `rt-multi-thread, macros, sync, time, signal`），以下示例均为真实编译运行。

## runtime 与 flavor

tokio 的 `Runtime` 是执行器的封装。创建方式有两种：

- `#[tokio::main]`：宏，默认创建多线程 runtime 并阻塞当前线程执行 async 块。
- `tokio::runtime::Builder`：手动构建，可以选 flavor 和参数。

两种 flavor：

| flavor | 线程数 | 适用场景 |
|---|---|---|
| `current_thread` | 1 | 测试、嵌入式、不需要真并行 |
| `multi_thread` | 默认 = CPU 逻辑核数 | 生产环境，真并行 |

```rust
use std::thread;
use std::time::{Duration, Instant};

async fn run_flavor(name: &str, n: usize) {
    let start = Instant::now();
    let handles: Vec<_> = (1..=n)
        .map(|id| {
            tokio::spawn(async move {
                for step in 1..=2 {
                    println!("[{name}] task {id} step {step} @ {:?} 线程 {:?}",
                        start.elapsed(), thread::current().id());
                    tokio::time::sleep(Duration::from_millis(20)).await;
                }
            })
        })
        .collect();
    for h in handles { h.await.unwrap(); }
    println!("{name} 总耗时: {:?}\n", start.elapsed());
}

fn main() {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all().build().unwrap();
    rt.block_on(run_flavor("current_thread", 3));

    let workers = thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    println!("本机逻辑核数: {workers}");
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(workers).enable_all().build().unwrap();
    rt.block_on(run_flavor("multi_thread", 8));
}
```

真实运行输出：

```text
[current_thread] task 1 step 1 @ 44.465µs 线程 ThreadId(1)
[current_thread] task 2 step 1 @ 91.179µs 线程 ThreadId(1)
[current_thread] task 3 step 1 @ 102.534µs 线程 ThreadId(1)
[current_thread] task 1 step 2 @ 21.456987ms 线程 ThreadId(1)
[current_thread] task 2 step 2 @ 21.517578ms 线程 ThreadId(1)
[current_thread] task 3 step 2 @ 21.530658ms 线程 ThreadId(1)
current_thread 总耗时: 42.757169ms

本机逻辑核数: 14
[multi_thread] task 1 step 1 @ 37.488µs 线程 ThreadId(10)
[multi_thread] task 4 step 1 @ 83.158µs 线程 ThreadId(3)
[multi_thread] task 3 step 1 @ 142.317µs 线程 ThreadId(4)
[multi_thread] task 2 step 1 @ 40.04µs 线程 ThreadId(15)
[multi_thread] task 6 step 1 @ 158.174µs 线程 ThreadId(12)
[multi_thread] task 7 step 1 @ 170.436µs 线程 ThreadId(6)
[multi_thread] task 5 step 1 @ 91.628µs 线程 ThreadId(10)
[multi_thread] task 8 step 1 @ 209.386µs 线程 ThreadId(8)
[multi_thread] task 8 step 2 @ 21.751756ms 线程 ThreadId(2)
[multi_thread] task 6 step 2 @ 21.783773ms 线程 ThreadId(2)
[multi_thread] task 7 step 2 @ 21.79126ms 线程 ThreadId(2)
[multi_thread] task 5 step 2 @ 21.797643ms 线程 ThreadId(2)
[multi_thread] task 2 step 2 @ 21.796791ms 线程 ThreadId(7)
[multi_thread] task 4 step 2 @ 21.809742ms 线程 ThreadId(2)
[multi_thread] task 1 step 2 @ 21.819421ms 线程 ThreadId(2)
[multi_thread] task 3 step 2 @ 21.824325ms 线程 ThreadId(7)
multi_thread 总耗时: 44.297563ms
```

`current_thread` 所有任务都在 `ThreadId(1)` 上交错执行；`multi_thread` 任务分散到 `ThreadId(2)`、`(3)`、`(4)`、`(6)`、`(7)`、`(8)`、`(10)`、`(12)`、`(15)` 等多个 worker 线程——真并行。

## #[tokio::main] 与 spawn

`#[tokio::main]` 把 `fn main` 包装成「创建 runtime → block_on async 块」。`tokio::spawn` 把 future 提交给 runtime 调度，立即返回 `JoinHandle`：

```rust
use std::thread;
use std::time::Duration;

#[tokio::main]
async fn main() {
    println!("main 线程: {:?}", thread::current().id());

    let h1 = tokio::spawn(async {
        println!("task1 线程: {:?}", thread::current().id());
        tokio::time::sleep(Duration::from_millis(50)).await;
        println!("task1 完成");
        10
    });

    let h2 = tokio::spawn(async {
        println!("task2 线程: {:?}", thread::current().id());
        tokio::time::sleep(Duration::from_millis(10)).await;
        println!("task2 完成");
        20
    });

    // JoinHandle 本身也是 future，await 它拿回 Output
    let (a, b) = (h1.await.unwrap(), h2.await.unwrap());
    println!("两个任务的结果: {a} + {b} = {}", a + b);

    // spawn_blocking：阻塞操作放到专用线程池，不占 worker
    let h3 = tokio::task::spawn_blocking(|| {
        println!("blocking 线程: {:?}", thread::current().id());
        thread::sleep(Duration::from_millis(30));
        30
    });
    println!("spawn_blocking 结果: {}", h3.await.unwrap());
}
```

真实运行输出：

```text
main 线程: ThreadId(1)
task1 线程: ThreadId(14)
task2 线程: ThreadId(3)
task2 完成
task1 完成
两个任务的结果: 10 + 20 = 30
blocking 线程: ThreadId(16)
spawn_blocking 结果: 30
```

`JoinHandle` 的 `await` 返回 `Result<T, JoinError>`——任务 panic 或 runtime 关闭时拿到 `Err`。

## 任务的 Send 要求

`tokio::spawn` 要求 future 实现 `Send`——因为任务可能被调度到任意 worker 线程。规则是：**跨 `.await` 持有的所有数据都必须是 `Send`**。`std::sync::MutexGuard` 不是 `Send` 的，跨 await 持锁会导致编译失败（`future cannot be sent between threads safely`）。完整的报错示例、`Send` bound 的由来和两种修复方式见 [async 中的 Send 问题与 async trait](./async-send-and-async-trait)。

## 参考资料

- 官方文档：Tokio 官方教程 · Spawning：<https://tokio.rs/tokio/tutorial/spawning>

## 相关页面

- [执行器与运行时](./executors-and-runtime)——tokio runtime 的调度模型。
- [select 与超时取消](./select-and-cancellation)——`tokio::select!` 与 `CancellationToken`。
- [async 中的 Send 问题与 async trait](./async-send-and-async-trait)——`Send` 问题的完整讨论。
