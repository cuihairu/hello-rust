# Executors and Runtimes

Futures are lazy — someone must repeatedly `poll` them until they return `Ready`. That "someone" is the executor. This page first writes a single-threaded executor by hand using only `std`, then compares it with the scheduling model of tokio's real runtime.

## What block_on Really Is

The simplest executor is `block_on`: a loop that polls repeatedly until `Ready`.

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

fn noop_raw_waker() -> RawWaker {
    fn clone_ptr(data: *const ()) -> RawWaker { RawWaker::new(data, &VTABLE) }
    fn noop(_: *const ()) {}
    static VTABLE: RawWakerVTable = RawWakerVTable::new(clone_ptr, noop, noop, noop);
    RawWaker::new(std::ptr::null::<()>(), &VTABLE)
}

/// block_on 的本质：循环 poll 直到 Ready。
/// 真实运行时会 park 线程（让出 CPU 并等待唤醒），这里用 yield_now 模拟。
fn block_on<F: Future + Unpin>(mut fut: F) -> F::Output {
    let waker = unsafe { Waker::from_raw(noop_raw_waker()) };
    let mut cx = Context::from_waker(&waker);
    loop {
        if let Poll::Ready(v) = Pin::new(&mut fut).poll(&mut cx) {
            return v;
        }
        std::thread::yield_now();
    }
}

struct Countdown(u32);
impl Future for Countdown {
    type Output = String;
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<String> {
        if self.0 == 0 {
            Poll::Ready("倒计时结束".to_string())
        } else {
            println!("倒计时: {}", self.0);
            self.0 -= 1;
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}

fn main() {
    let result = block_on(Countdown(3));
    println!("block_on 返回: {result}");
}
```

Actual run output:

```text
倒计时: 3
倒计时: 2
倒计时: 1
block_on 返回: 倒计时结束
```

`block_on` can only run one future — it blocks the current thread until it completes. To run multiple futures concurrently, you need a task queue.

## A Hand-Written Single-Threaded Executor: Task Queue + Wake

The core of a real executor is a task queue: when a future returns `Pending` it registers itself with the waker; when the external condition is ready, `wake()` puts the task back on the queue; the executor's loop pulls tasks off the queue and polls them.

The `std::task::Wake` trait lets an `Arc<Task>` be turned directly into a `Waker`:

```rust
use std::collections::VecDeque;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll, Wake, Waker};

type BoxFuture = Pin<Box<dyn Future<Output = ()> + Send>>;

/// 任务队列：整个执行器只有这一个共享状态
struct TaskQueue {
    tasks: Mutex<VecDeque<Arc<Task>>>,
}

impl TaskQueue {
    fn new() -> Arc<Self> {
        Arc::new(TaskQueue { tasks: Mutex::new(VecDeque::new()) })
    }
    fn push(&self, task: Arc<Task>) { self.tasks.lock().unwrap().push_back(task); }
    fn pop(&self) -> Option<Arc<Task>> { self.tasks.lock().unwrap().pop_front() }
}

/// 一个任务 = 状态机 + 它所属的队列（wake 时把自己塞回队列）
struct Task {
    future: Mutex<BoxFuture>,
    queue: Arc<TaskQueue>,
}

/// 实现 Wake trait，Arc<Task> 就能转成 Waker
impl Wake for Task {
    fn wake(self: Arc<Self>) {
        let queue = self.queue.clone(); // 先借用队列，再把自己 move 进去
        queue.push(self);
    }
}

/// 把 future 包成任务并放入队列（相当于 tokio::spawn）
fn spawn(queue: &Arc<TaskQueue>, fut: impl Future<Output = ()> + Send + 'static) {
    let task = Arc::new(Task { future: Mutex::new(Box::pin(fut)), queue: queue.clone() });
    queue.push(task);
}

/// 事件循环：队列空了就结束
fn run(queue: &Arc<TaskQueue>) {
    while let Some(task) = queue.pop() {
        let waker = Waker::from(task.clone());
        let mut cx = Context::from_waker(&waker);
        let mut fut = task.future.lock().unwrap();
        match fut.as_mut().poll(&mut cx) {
            Poll::Ready(()) => println!("[executor] 一个任务完成"),
            Poll::Pending => {} // 没醒的任务在队列外，等 wake 再回来
        }
    }
    println!("[executor] 队列已空，执行器退出");
}

fn main() {
    let queue = TaskQueue::new();
    for id in 1..=2 {
        spawn(&queue, async move {
            for _ in 0..2 {
                println!("[task {id}] 醒来一次");
                yield_once().await; // 模拟「还没准备好」
            }
            println!("[task {id}] 结束");
        });
    }
    run(&queue);
}

/// 永远先 Pending 一次的 future
struct YieldOnce(bool);
impl Future for YieldOnce {
    type Output = ();
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<()> {
        if self.0 { Poll::Ready(()) } else {
            self.0 = true;
            cx.waker().wake_by_ref();
            Poll::Pending
        }
    }
}
async fn yield_once() { YieldOnce(false).await; }
```

Actual run output:

```text
[task 1] 醒来一次
[task 2] 醒来一次
[task 1] 醒来一次
[task 2] 醒来一次
[task 1] 结束
[executor] 一个任务完成
[task 2] 结束
[executor] 一个任务完成
[executor] 队列已空，执行器退出
```

Three key points:

- **The `Wake` trait is the bridge between tasks and the executor**: `Waker::from(Arc<Task>)` turns a task into a waker; when a future calls `cx.waker().wake_by_ref()` inside `poll`, it is effectively putting itself back on the queue.
- **The task queue is an `Arc<Mutex<VecDeque>>`**: `wake` may be called from any thread, so the queue must be thread-safe. Real runtimes replace it with a lock-free queue.
- **`spawn` requires the future to be `Send + 'static`**: a task may be moved to another thread to run, and it may outlive the current function's stack frame.

## Comparing with tokio: Sharding and Work Stealing

tokio's multi-threaded runtime (the `multi_thread` flavor) runs tasks in parallel across a pool of worker threads. Each worker has its own local task queue; when the local queue is empty it "steals" tasks from other workers (work stealing). The `current_thread` flavor uses only a single thread, on which all tasks run interleaved.

Key differences from the hand-written executor:

- **Hand-written version**: single thread + one global `Mutex<VecDeque>` queue. Every `wake` contends for the same lock.
- **tokio multi_thread**: one local queue per worker + work stealing, avoiding global lock contention; a task first goes into the local queue of whichever worker thread it was `spawn`ed on.
- **tokio current_thread**: single thread, lock-free, suitable for testing and scenarios that do not need real parallelism.

The measured comparison of the two flavors (tasks spread across several worker threads vs. all on one thread) is in the runtime section of [The tokio Ecosystem](./tokio-ecosystem).

## References

- Official docs: "Asynchronous Programming in Rust" · Applied: Build an Executor: <https://rust-lang.github.io/async-book/02_execution/04_executor.html>

## Related pages

- [async/await and Future](./async-await-and-future) — what an executor polls.
- [The tokio Ecosystem](./tokio-ecosystem) — using `#[tokio::main]`, `spawn`, and `JoinHandle`.
- [select, Timeouts and Cancellation](./select-and-cancellation) — how to combine multiple futures on top of an executor.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
