# 第4部分：异步

async/await 与 Future、Pin 与自引用、tokio 生态、select 与取消——Rust 异步编程的执行模型与运行时。

- [async/await 与 Future](async-await-and-future.md) —— `Future` trait 与 `poll`、`Poll::Ready`/`Pending`、async 块编译成状态机、惰性执行；零依赖手写执行器驱动。
- [执行器与运行时](executors-and-runtime.md) —— 手写单线程执行器（任务队列 + `Wake` trait）、`block_on` 的本质；对比 tokio 多线程运行时的分片与工作窃取。
- [Pin 与自引用](pin-and-self-reference.md) —— `Unpin`、`Pin<&mut T>`、`pin!` 与 `pin_project` 的用途；为什么 async 块必须 Pin；`Future` 返回类型必须 `Unpin` 的约束。
- [tokio 生态](tokio-ecosystem.md) —— runtime 与 flavor、`#[tokio::main]`、`spawn`、`spawn_blocking`、task 的 `Send` 要求、`JoinHandle`。
- [select 与超时取消](select-and-cancellation.md) —— `tokio::select!`、`tokio::time::timeout`、`CancellationToken`、任务协作式取消；select 落选分支被丢弃的语义。
- [async 中的 Send 问题与 async trait](async-send-and-async-trait.md) —— 跨 `await` 持锁导致 `!Send` 的真实报错、`Send` bound 的由来、`async_trait` 宏与稳定 `async_fn_in_trait`（RFC 3185）的现状对比。

---

- [内存与并发](../memory-concurrency/) —— 同步并发的地基：Send 与 Sync、channel 与锁。
- [语言核心](../language-core/) —— trait、生命周期、所有权等异步代码依赖的语言基础。
