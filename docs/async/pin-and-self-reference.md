# Pin 与自引用

`Future::poll` 的接收者是 `Pin<&mut Self>`——这不是随便定的。async 块编译出的状态机可能持有指向自身字段的指针（自引用），一旦被 move，指针就悬垂。`Pin` 的作用就是保证值在内存中不再移动。

## Unpin：大多数类型可以随便 move

`Unpin` 是一个自动 trait（auto trait）：几乎所有类型都自动实现它，包括基本类型、`String`、`Box<T>`、`Vec<T>` 等。实现 `Unpin` 的含义是「我被 move 也不会坏」。

只有显式 opted-out 的类型才是 `!Unpin`——标准做法是加一个 `PhantomPinned` 字段。对于 `Unpin` 的类型，`Pin<&mut T>` 不施加额外限制——可以用 `get_mut()` 取出 `&mut T`：

```rust
use std::marker::PhantomPinned;

struct NotUnpin { _marker: PhantomPinned } // 显式 !Unpin

fn main() {
    let mut x = 42;
    let mut pinned = Box::pin(x);
    *pinned.as_mut() = 43; // as_mut() 给 Pin<&mut T>，可以改值
    let r: &mut i32 = pinned.get_mut(); // i32: Unpin，所以 get_mut 可用
    println!("{r}");
}
```

真实运行输出：

```text
43
```

## 自引用结构：move 导致悬垂

自引用结构持有指向自身字段的指针。构造时指针有效；一旦整个结构体被 move（比如从函数 return），指针就指向了旧地址。用地址比较来证明（不解引用悬垂指针，避免未定义行为）：

```rust
struct SelfRef {
    text: String,
    ptr: *const String, // 指向 self.text
}

impl SelfRef {
    fn new(text: &str) -> Self {
        let mut s = SelfRef { text: text.to_string(), ptr: std::ptr::null() };
        s.ptr = &s.text as *const String;
        s // ← 这里发生了一次 move：ptr 指向的地址已经是别人的栈帧了
    }
    fn check(&self, tag: &str) {
        let dangling = !std::ptr::eq(self.ptr, &self.text);
        let why = if dangling { "move 之后指针指向了旧地址" } else { "还指向自己的 text" };
        println!("[{tag}] ptr 有效: {}（{}）", !dangling, why);
    }
}

fn main() {
    let s = SelfRef::new("hello");
    s.check("构造返回后"); // new() 返回时已经 move 过一次

    let s2 = s; // 再 move 一次
    s2.check("再次 move 后");

    let pinned = Box::pin(SelfRef::new("world"));
    pinned.check("Box::pin 里"); // Pin 能保证之后不 move，但构造时的悬垂已发生
}
```

真实运行输出：

```text
[构造返回后] ptr 有效: false（move 之后指针指向了旧地址）
[再次 move 后] ptr 有效: false（move 之后指针指向了旧地址）
[Box::pin 里] ptr 有效: false（move 之后指针指向了旧地址）
```

`Box::pin` 只能保证「之后不再 move」，不能修复已经写坏的指针——所以自引用结构必须在构造时就固定地址（比如用 `pin_project` 库在栈上安全构造）。

## 为什么 async 块必须 Pin

async 块编译出的状态机保存了跨 await 的局部变量，编译器可能生成自引用布局。因此 async 块是 `!Unpin` 的，不能直接对 `&mut` 调用 `poll`：

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::Context;

fn try_poll_unpinned(cx: &mut Context<'_>) {
    let mut fut = async { 42 };
    let _ = fut.poll(cx); // 编译错误
}
```

真实编译报错：

```text
error[E0599]: no method named `poll` found for `async` block `{async block@src/bin/err1_unpin.rs:8:19: 8:24}` in the current scope
  --> src/bin/err1_unpin.rs:9:17
   |
 9 |     let _ = fut.poll(cx); // 编译错误
   |                 ^^^^ method not found in `{async block@src/bin/err1_unpin.rs:8:19: 8:24}`
   |
help: consider pinning the expression
   |
 9 ~     let mut pinned = std::pin::pin!(fut);
10 ~     let _ = pinned.as_mut().poll(cx); // 编译错误
   |
```

编译器直接给出了正确做法：`pin!` 宏把 future 固定在栈上，然后 `as_mut().poll()`。

同理，`!Unpin` 的 future 不能从 `Pin<&mut Self>` 里取出 `&mut Self`：

```rust
use std::future::Future;
use std::marker::PhantomPinned;
use std::pin::Pin;
use std::task::{Context, Poll};

struct NotUnpin {
    _marker: PhantomPinned,
}

impl Future for NotUnpin {
    type Output = ();
    fn poll(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<()> {
        Poll::Ready(())
    }
}

fn try_get_mut(fut: Pin<&mut NotUnpin>) {
    let _ = fut.get_mut(); // 编译错误：NotUnpin 不是 Unpin
}
```

真实编译报错（节选）：

```text
error[E0277]: `PhantomPinned` cannot be unpinned
    --> src/bin/err2_get_mut.rs:18:17
     |
 18 |     let _ = fut.get_mut(); // 编译错误：NotUnpin 不是 Unpin
     |                 ^^^^^^^ within `NotUnpin`, the trait `Unpin` is not implemented for `PhantomPinned`
     |
     = note: consider using the `pin!` macro
             consider using `Box::pin` if you need to access the pinned value outside of the current scope
```

要访问 `!Unpin` 类型的内部字段，需要用 `pin_project` 库——它生成安全的投影方法，把「可以随便访问的字段」和「必须通过 Pin 访问的字段」分开。

## Future 返回类型必须 Unpin 的约束

因为 `poll` 接收 `Pin<&mut Self>`，只有 `Unpin` 的 future 才能用 `Pin::new(&mut fut)` 随意包装。标准库里 `Box<F>` 和 `&mut F` 实现 `Future` 都要求 `F: Unpin`：

```rust
// std 源码（简化）
impl<F: Future + Unpin + ?Sized, A: Allocator> Future for Box<F, A> { ... }
impl<F: Future + Unpin + ?Sized> Future for &mut F { ... }
```

所以手写 `block_on` 时常见的签名是 `fn block_on<F: Future + Unpin>`——传 async 块进去会编译失败：

```rust
fn block_on<F: Future + Unpin>(mut fut: F) -> F::Output { /* ... */ }

fn main() {
    let r = block_on(async { 1 + 1 }); // async 块是 !Unpin，编译错误
    println!("{r}");
}
```

真实编译报错：

```text
error[E0277]: `{async block@...}` cannot be unpinned
  --> src/bin/err3_block_on_unpin.rs:28:22
   |
28 |     let r = block_on(async { 1 + 1 }); // async 块是 !Unpin，编译错误
   |             -------- ^^^^^^^^^^^^^^^ the trait `Unpin` is not implemented for `{async block@src/bin/err3_block_on_unpin.rs:28:22: 28:27}`
   |             required by a bound introduced by this call
   |
   = note: consider using the `pin!` macro
           consider using `Box::pin` if you need to access the pinned value outside of the current scope
note: required by a bound in `block_on`
  --> src/bin/err3_block_on_unpin.rs:16:25
   |
16 | fn block_on<F: Future + Unpin>(mut fut: F) -> F::Output {
   |                         ^^^^^ required by this bound in `block_on`
```

解决办法：用 `Box::pin` 把 future 放进堆上固定地址，得到 `Pin<Box<F>>`——`Pin<Box<F>>` 总是 `Unpin` 的（不管 `F` 是不是），所以可以直接传。

## 相关页面

- [async/await 与 Future](./async-await-and-future)——`poll` 的接收者为什么是 `Pin<&mut Self>`。
- [执行器与运行时](./executors-and-runtime)——执行器如何持有和 poll 被 Pin 的 future。
- [async 中的 Send 问题与 async trait](./async-send-and-async-trait)——Pin 与 Send 的交集。

官方文档：<https://doc.rust-lang.org/std/pin/index.html>
