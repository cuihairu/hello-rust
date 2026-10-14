# async/await 与 Future

Rust 的异步编程建立在 `Future` trait 之上：`async fn` 和 `async {}` 块不是「并发执行」，而是被编译器翻译成实现了 `Future` 的状态机。这一页从 `std::future` 出发，用零依赖的手写执行器把 `poll` 模型讲透。

## Future trait 与 poll

`Future` 只有一个必需方法 `poll`：

```rust
pub trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

`poll` 尝试把 future 推进到完成。它**不阻塞**——没完成就返回 `Poll::Pending`，并把自己注册到 `cx.waker()` 上；完成了就返回 `Poll::Ready(value)`。返回 `Pending` 后，只有当外部条件就绪、有人调用 `Waker::wake()` 时，执行器才会再次 `poll` 它。

`Poll` 是个枚举：

```rust
pub enum Poll<T> {
    Pending,
    Ready(T),
}
```

一个最简 Future 的实现——前两次 `poll` 返回 `Pending`，第三次返回 `Ready`：

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll, RawWaker, RawWakerVTable, Waker};

struct PollCounter {
    polls: u32,
    ready_at: u32,
}

impl Future for PollCounter {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        self.polls += 1;
        println!("poll 第 {} 次", self.polls);
        if self.polls >= self.ready_at {
            Poll::Ready("完成")
        } else {
            cx.waker().wake_by_ref(); // 没好就叫醒我，稍后再 poll
            Poll::Pending
        }
    }
}

fn noop_raw_waker() -> RawWaker {
    fn clone_ptr(data: *const ()) -> RawWaker { RawWaker::new(data, &VTABLE) }
    fn noop(_: *const ()) {}
    static VTABLE: RawWakerVTable = RawWakerVTable::new(clone_ptr, noop, noop, noop);
    RawWaker::new(std::ptr::null::<()>(), &VTABLE)
}

fn main() {
    // 证据 1：Future 是惰性的——构造后不 poll 就永远不跑
    let mut fut = Box::pin(PollCounter { polls: 0, ready_at: 3 });
    println!("构造了 future，还没有一行 poll 输出");

    let waker = unsafe { Waker::from_raw(noop_raw_waker()) };
    let mut cx = Context::from_waker(&waker);

    // 证据 2：手动驱动——第 1、2 次 Pending，第 3 次 Ready
    loop {
        match fut.as_mut().poll(&mut cx) {
            Poll::Ready(v) => { println!("Ready: {v}"); break; }
            Poll::Pending => println!("Pending，稍后再来"),
        }
    }
}
```

真实运行输出：

```text
构造了 future，还没有一行 poll 输出
poll 第 1 次
Pending，稍后再来
poll 第 2 次
Pending，稍后再来
poll 第 3 次
Ready: 完成
```

两个要点：

- **惰性执行**：`PollCounter { polls: 0, ready_at: 3 }` 构造后什么都没发生——async fn 和 async 块一样，不 poll 就不跑。`.await` 只是把「驱动 future」的责任推给上层，一直推到执行器（见[执行器与运行时](./executors-and-runtime)）。
- **`Pin<&mut Self>` 接收者**：`poll` 不接收 `&mut Self` 而接收 `Pin<&mut Self>`，因为 async 生成的状态机可能是自引用的，move 会导致悬垂（详见[Pin 与自引用](./pin-and-self-reference)）。

## async 块被编译成状态机

`async` 块里的每个 `.await` 都是一个「挂起点」：future 在这里把状态存进编译器生成的结构体，返回 `Pending`；下次 `poll` 时从对应状态恢复。await 点越多，状态机越大。可以用 `size_of_val` 直接量出来：

```rust
use std::mem::size_of_val;

async fn zero_awaits() -> u32 { 1 + 1 }

async fn with_one_yield() -> u32 {
    std::future::ready(1).await + 1
}

async fn with_two_yields() -> u32 {
    let a = std::future::ready(1).await;
    let b = std::future::ready(2).await;
    a + b
}

async fn with_three_yields() -> u32 {
    let a = std::future::ready(1).await;
    let b = std::future::ready(2).await;
    let c = std::future::ready(3).await;
    a + b + c
}

fn main() {
    println!("0 个 await: {} 字节", size_of_val(&zero_awaits()));
    println!("1 个 await: {} 字节", size_of_val(&with_one_yield()));
    println!("2 个 await: {} 字节", size_of_val(&with_two_yields()));
    println!("3 个 await: {} 字节", size_of_val(&with_three_yields()));
}
```

真实运行输出：

```text
0 个 await: 1 字节
1 个 await: 12 字节
2 个 await: 16 字节
3 个 await: 20 字节
```

每个 await 点大约让状态机增大 4 字节（一个状态标签 + 跨 await 保存的数据）。这直接证明了 async 块不是「线程」而是「编译期生成的状态机」。

更直观的对照：把同样的逻辑用手写 enum 状态机实现一遍，poll 序列与 async 块完全一致：

```rust
// 手写版：显式写出每个 await 点对应的状态
enum HandWritten {
    Start,
    AfterFirstAwait,
    AfterSecondAwait,
    Done,
}

impl Future for HandWritten {
    type Output = &'static str;
    fn poll(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        let this = &mut *self; // HandWritten: Unpin
        loop {
            match this {
                HandWritten::Start => {
                    println!("状态机: 进入第 1 个 await 前");
                    *this = HandWritten::AfterFirstAwait;
                    cx.waker().wake_by_ref();
                    return Poll::Pending;
                }
                HandWritten::AfterFirstAwait => {
                    println!("状态机: 第 1 个 await 恢复，进入第 2 个 await 前");
                    *this = HandWritten::AfterSecondAwait;
                    cx.waker().wake_by_ref();
                    return Poll::Pending;
                }
                HandWritten::AfterSecondAwait => {
                    println!("状态机: 第 2 个 await 恢复，返回结果");
                    *this = HandWritten::Done;
                    return Poll::Ready("async 块的结果");
                }
                HandWritten::Done => panic!("poll 在 Ready 之后被调用"),
            }
        }
    }
}
```

真实运行输出（async 块版本输出完全一致）：

```text
状态机: 进入第 1 个 await 前
状态机: 第 1 个 await 恢复，进入第 2 个 await 前
状态机: 第 2 个 await 恢复，返回结果
结果: async 块的结果
```

## 参考资料

- 官方文档：std 标准库 · Future in std::future：<https://doc.rust-lang.org/std/future/trait.Future.html>

## 相关页面

- [执行器与运行时](./executors-and-runtime)——谁负责 poll 这些状态机。
- [Pin 与自引用](./pin-and-self-reference)——为什么 `poll` 的接收者是 `Pin<&mut Self>`。
- [async 中的 Send 问题与 async trait](./async-send-and-async-trait)——状态机跨线程时的约束。
