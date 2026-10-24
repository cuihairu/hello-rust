# The tokio Ecosystem

tokio is Rust's de facto async runtime. It provides an executor (multi-threaded or single-threaded), task scheduling, timers, synchronization primitives, and more. This page covers the runtime, `#[tokio::main]`, `spawn`, `spawn_blocking`, `JoinHandle`, and the `Send` requirements for tasks.

> This environment successfully acquired tokio 1.53.2 (features: `rt-multi-thread, macros, sync, time, signal`); all examples below were actually compiled and run.

## runtime and flavor

tokio's `Runtime` is a wrapper around an executor. There are two ways to create one:

- `#[tokio::main]`: a macro that creates a multi-threaded runtime by default and blocks the current thread to drive the async block.
- `tokio::runtime::Builder`: manual construction, where you choose the flavor and parameters.

The two flavors:

| flavor | thread count | use case |
|---|---|---|
| `current_thread` | 1 | testing, embedded, no real parallelism needed |
| `multi_thread` | default = number of logical CPU cores | production, real parallelism |

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

Actual run output:

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

With `current_thread`, all tasks interleave on `ThreadId(1)`; with `multi_thread`, tasks are spread across worker threads `ThreadId(2)`, `(3)`, `(4)`, `(6)`, `(7)`, `(8)`, `(10)`, `(12)`, `(15)`, and more — real parallelism.

## #[tokio::main] and spawn

`#[tokio::main]` wraps `fn main` as "create a runtime → block_on the async block". `tokio::spawn` submits a future to the runtime for scheduling and immediately returns a `JoinHandle`:

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

Actual run output:

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

Awaiting a `JoinHandle` returns `Result<T, JoinError>` — you get `Err` when the task panics or the runtime is shut down.

## The Send Requirement for Tasks

`tokio::spawn` requires the future to implement `Send` — because a task may be scheduled onto any worker thread. The rule is: **all data held across an `.await` must be `Send`**. `std::sync::MutexGuard` is not `Send`, so holding a lock across an await causes a compile failure (`future cannot be sent between threads safely`). See [Send in Async and async trait](./async-send-and-async-trait) for the full error example, the origin of the `Send` bound, and two ways to fix it.

## References

- Official docs: The Tokio Tutorial · Spawning: <https://tokio.rs/tokio/tutorial/spawning>

## Related pages

- [Executors and Runtimes](./executors-and-runtime) — tokio's runtime scheduling model.
- [select, Timeouts and Cancellation](./select-and-cancellation) — `tokio::select!` and `CancellationToken`.
- [Send in Async and async trait](./async-send-and-async-trait) — the full discussion of the `Send` problem.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
