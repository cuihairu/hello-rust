# async/await and Future

Rust's async programming is built on the `Future` trait: `async fn` and `async {}` blocks are not "concurrent execution" — they are translated by the compiler into state machines that implement `Future`. This page starts from `std::future` and uses a hand-written, zero-dependency executor to explain the `poll` model thoroughly.

## The Future trait and poll

`Future` has only one required method, `poll`:

```rust
pub trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

`poll` tries to advance the future toward completion. It does **not block** — if it is not done it returns `Poll::Pending` and registers itself with `cx.waker()`; when it is done it returns `Poll::Ready(value)`. After returning `Pending`, the executor only polls it again once the external condition is ready and someone calls `Waker::wake()`.

`Poll` is an enum:

```rust
pub enum Poll<T> {
    Pending,
    Ready(T),
}
```

A minimal `Future` implementation — the first two `poll` calls return `Pending`, the third returns `Ready`:

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

Actual run output:

```text
构造了 future，还没有一行 poll 输出
poll 第 1 次
Pending，稍后再来
poll 第 2 次
Pending，稍后再来
poll 第 3 次
Ready: 完成
```

Two key points:

- **Lazy execution**: nothing happens after constructing `PollCounter { polls: 0, ready_at: 3 }` — async fns and async blocks are the same: they do not run until they are polled. `.await` only pushes the responsibility of "driving the future" up to the caller, all the way up to the executor (see [Executors and Runtimes](./executors-and-runtime)).
- **The `Pin<&mut Self>` receiver**: `poll` takes `Pin<&mut Self>` rather than `&mut Self`, because the state machine generated from async code may be self-referential, and moving it would cause dangling pointers (see [Pin and Self-Reference](./pin-and-self-reference) for details).

## async Blocks Are Compiled into State Machines

Every `.await` inside an `async` block is a "suspension point": the future stores its state in a compiler-generated struct and returns `Pending`; the next `poll` resumes from the corresponding state. The more await points, the larger the state machine. You can measure it directly with `size_of_val`:

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

Actual run output:

```text
0 个 await: 1 字节
1 个 await: 12 字节
2 个 await: 16 字节
3 个 await: 20 字节
```

Each await point adds roughly 4 bytes to the state machine (a state tag plus the data saved across the await). This directly proves that async blocks are not "threads" but "compile-time generated state machines".

A more intuitive comparison: implement the same logic as a hand-written enum state machine — the poll sequence is identical to the async block:

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

Actual run output (the async block version prints exactly the same):

```text
状态机: 进入第 1 个 await 前
状态机: 第 1 个 await 恢复，进入第 2 个 await 前
状态机: 第 2 个 await 恢复，返回结果
结果: async 块的结果
```

## References

- Official docs: std library · Future in std::future: <https://doc.rust-lang.org/std/future/trait.Future.html>

## Related pages

- [Executors and Runtimes](./executors-and-runtime) — who is responsible for polling these state machines.
- [Pin and Self-Reference](./pin-and-self-reference) — why the `poll` receiver is `Pin<&mut Self>`.
- [Send in Async and async trait](./async-send-and-async-trait) — the constraints when a state machine crosses threads.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
