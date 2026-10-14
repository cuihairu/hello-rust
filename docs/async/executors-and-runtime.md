# 执行器与运行时

Future 是惰性的——必须有人反复 `poll` 它直到 `Ready`。这个「人」就是执行器（executor）。这一页先用零依赖的 `std` 手写一个单线程执行器，再对比 tokio 真实运行时的调度模型。

## block_on 的本质

最简单的执行器是 `block_on`：一个循环，反复 poll 直到 `Ready`。

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

真实运行输出：

```text
倒计时: 3
倒计时: 2
倒计时: 1
block_on 返回: 倒计时结束
```

`block_on` 只能跑一个 future——它阻塞当前线程直到完成。要并发跑多个 future，需要任务队列。

## 手写单线程执行器：任务队列 + Wake

真实执行器的核心是一个任务队列：future 返回 `Pending` 时把自己注册到 waker 上；外部条件就绪时 `wake()` 把任务塞回队列；执行器循环从队列取任务来 poll。

用 `std::task::Wake` trait 可以让 `Arc<Task>` 直接转成 `Waker`：

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

真实运行输出：

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

三个要点：

- **`Wake` trait 是任务与执行器之间的桥梁**：`Waker::from(Arc<Task>)` 把任务变成 waker；future 在 `poll` 里调用 `cx.waker().wake_by_ref()` 时，实际就是把自己重新塞回队列。
- **任务队列是 `Arc<Mutex<VecDeque>>`**：`wake` 可能从任意线程调用，所以队列必须线程安全。真实运行时用无锁队列替代。
- **`spawn` 要求 future 是 `Send + 'static`**：任务可能被移到别的线程执行，也可能活过当前函数栈帧。

## 对比 tokio：分片与工作窃取

tokio 的多线程运行时（`multi_thread` flavor）用一组 worker 线程并行执行任务。每个 worker 有自己的本地任务队列；本地队列空了就去「偷」其他 worker 的任务（work stealing）。`current_thread` flavor 则只用一个线程，所有任务在上面交错执行。

与手写执行器的关键差异：

- **手写版**：单线程 + 一个全局 `Mutex<VecDeque>` 队列。所有 `wake` 都竞争同一把锁。
- **tokio multi_thread**：每个 worker 一个本地队列 + 工作窃取，避免全局锁竞争；任务在哪个线程 `spawn` 就先进哪个 worker 的本地队列。
- **tokio current_thread**：单线程，无锁，适合测试和不需要真并行的场景。

两种 flavor 的实测对比（任务分散在多个 worker 线程 vs 全部在一个线程）见 [tokio 生态](./tokio-ecosystem) 的 runtime 一节。

## 参考资料

- 官方文档：《Asynchronous Programming in Rust》· Applied: Build an Executor：<https://rust-lang.github.io/async-book/02_execution/04_executor.html>

## 相关页面

- [async/await 与 Future](./async-await-and-future)——执行器 poll 的对象是什么。
- [tokio 生态](./tokio-ecosystem)——`#[tokio::main]`、`spawn`、`JoinHandle` 的用法。
- [select 与超时取消](./select-and-cancellation)——执行器之上如何组合多个 future。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
