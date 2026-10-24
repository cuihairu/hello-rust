# Pin and Self-Reference

The receiver of `Future::poll` is `Pin<&mut Self>` — this is not arbitrary. The state machine compiled from an async block may hold pointers to its own fields (self-reference), and once it is moved, those pointers dangle. `Pin` exists precisely to guarantee that a value is never moved again in memory.

## Unpin: Most Types Can Be Moved Freely

`Unpin` is an auto trait: almost every type implements it automatically, including primitive types, `String`, `Box<T>`, `Vec<T>`, and so on. Implementing `Unpin` means "moving me will not break me".

Only types that explicitly opt out are `!Unpin` — the standard idiom is to add a `PhantomPinned` field. For `Unpin` types, `Pin<&mut T>` imposes no extra restrictions — you can use `get_mut()` to get an `&mut T`:

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

Actual run output:

```text
43
```

## Self-Referential Structures: Move Causes Dangling

A self-referential structure holds a pointer to one of its own fields. The pointer is valid while it is being constructed; but once the whole struct is moved (for example when returned from a function), the pointer points at the old address. This proves it by comparing addresses (without dereferencing the dangling pointer, to avoid undefined behavior):

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

Actual run output:

```text
[构造返回后] ptr 有效: false（move 之后指针指向了旧地址）
[再次 move 后] ptr 有效: false（move 之后指针指向了旧地址）
[Box::pin 里] ptr 有效: false（move 之后指针指向了旧地址）
```

`Box::pin` can only guarantee "no more moves from here on" — it cannot repair a pointer that was already written incorrectly. So a self-referential structure must be pinned at construction time (for example by using the `pin_project` crate to construct it safely on the stack).

## Why async Blocks Must Be Pinned

The state machine compiled from an async block stores local variables across await points, and the compiler may produce a self-referential layout. Therefore async blocks are `!Unpin`, and you cannot call `poll` on a plain `&mut`:

```rust
use std::future::Future;
use std::pin::Pin;
use std::task::Context;

fn try_poll_unpinned(cx: &mut Context<'_>) {
    let mut fut = async { 42 };
    let _ = fut.poll(cx); // 编译错误
}
```

Actual compiler error:

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

The compiler spells out the correct approach directly: the `pin!` macro pins the future on the stack, then `as_mut().poll()`.

Similarly, an `!Unpin` future cannot yield an `&mut Self` out of `Pin<&mut Self>`:

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

Actual compiler error (excerpt):

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

To access the internal fields of an `!Unpin` type you need the `pin_project` crate — it generates safe projection methods that separate "fields you may access freely" from "fields you must access through Pin".

## The Constraint That a Future's Output Type Must Be Unpin

Because `poll` takes `Pin<&mut Self>`, only `Unpin` futures can be wrapped freely with `Pin::new(&mut fut)`. In the standard library, both `Box<F>` and `&mut F` implement `Future` only when `F: Unpin`:

```rust
// std 源码（简化）
impl<F: Future + Unpin + ?Sized, A: Allocator> Future for Box<F, A> { ... }
impl<F: Future + Unpin + ?Sized> Future for &mut F { ... }
```

That is why a hand-written `block_on` commonly has the signature `fn block_on<F: Future + Unpin>` — passing an async block into it fails to compile:

```rust
fn block_on<F: Future + Unpin>(mut fut: F) -> F::Output { /* ... */ }

fn main() {
    let r = block_on(async { 1 + 1 }); // async 块是 !Unpin，编译错误
    println!("{r}");
}
```

Actual compiler error:

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

The fix: use `Box::pin` to place the future on the heap at a fixed address, giving you a `Pin<Box<F>>` — `Pin<Box<F>>` is always `Unpin` (regardless of whether `F` is), so you can pass it directly.

## References

- Official docs: std library · std::pin: <https://doc.rust-lang.org/std/pin/index.html>

## Related pages

- [async/await and Future](./async-await-and-future) — why the `poll` receiver is `Pin<&mut Self>`.
- [Executors and Runtimes](./executors-and-runtime) — how an executor holds and polls pinned futures.
- [Send in Async and async trait](./async-send-and-async-trait) — where Pin and Send intersect.
- [Glossary](../glossary) — Chinese-English glossary and authoritative sources for core terms across the site.
