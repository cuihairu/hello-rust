# Smart Pointers

References merely "borrow" data; smart pointers **own** the data and attach extra behavior: `Box` puts a value on the heap, `Rc`/`Arc` do reference-counted sharing, and they all integrate with the language by implementing `Deref` and `Drop`. The two core takeaways of this page: **the Deref auto-dereference chain**, and **`Rc` reference cycles leaking memory, with `Weak` to break the cycle**.

## `Box<T>` and Deref auto-dereferencing

`Box` is the simplest: it allocates the value on the heap and keeps only a pointer itself. Once it implements `Deref`, method calls and coercions expand automatically along the dereference chain:

```rust
fn main() {
    let b = Box::new(5);
    println!("b = {b}");
    let s = Box::new(String::from("hello"));
    // 自动解引用：Box<String> 直接调用 String 的方法
    println!("s = {s}, len = {}", s.len());
    // Deref 强制转换：&Box<String> -> &String -> &str
    let r: &str = &s;
    println!("r = {r}");
    let n: &i32 = &b;
    println!("n = {n}");
}
```

Actual run output (rustc 1.99.0):

```text
b = 5
s = hello, len = 5
r = hello
n = 5
```

`s.len()` works because the compiler auto-dereferences `Box<String>` into `String` before looking up the method; `let r: &str = &s` goes through **deref coercion** — `&Box<String>` first becomes `&String` and then `&str`, in one smooth chain.

## `Rc<T>`: reference-counted sharing

`Rc` (reference counting) lets multiple owners share the same read-only data; `Rc::clone` merely increments the count without copying the data:

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("shared"));
    println!("a 创建后: strong = {}", Rc::strong_count(&a));
    let b = Rc::clone(&a);
    println!("clone 出 b 后: strong = {}", Rc::strong_count(&a));
    {
        let c = Rc::clone(&a);
        println!("内层作用域 clone 出 c: strong = {}", Rc::strong_count(&c));
    }
    println!("内层作用域结束: strong = {}", Rc::strong_count(&a));
    drop(b);
    println!("drop(b) 后: strong = {}", Rc::strong_count(&a));
}
```

Actual run output:

```text
a 创建后: strong = 1
clone 出 b 后: strong = 2
内层作用域 clone 出 c: strong = 3
内层作用域结束: strong = 2
drop(b) 后: strong = 1
```

The data is released only when the count reaches zero (the last strong reference is dropped).

## `Rc` reference cycles: a real memory leak

Once `Rc`s point at each other in a cycle, even if every external reference is dropped, the counts inside the cycle never reach zero — this is a memory leak that perfectly safe Rust can produce:

```rust
use std::cell::RefCell;
use std::rc::Rc;

struct Node {
    name: &'static str,
    next: Option<Rc<RefCell<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("Node({}) 被 drop", self.name);
    }
}

fn main() {
    let a = Rc::new(RefCell::new(Node { name: "a", next: None }));
    let b = Rc::new(RefCell::new(Node { name: "b", next: None }));
    a.borrow_mut().next = Some(Rc::clone(&b));
    b.borrow_mut().next = Some(Rc::clone(&a));
    println!("成环后: strong a = {}, strong b = {}", Rc::strong_count(&a), Rc::strong_count(&b));
    drop(a);
    drop(b);
    println!("外部强引用全部 drop 后，两个 Node 的 Drop 从未运行（无输出）");
}
```

Actual run output (note: no `Node(...) 被 drop` at all):

```text
成环后: strong a = 2, strong b = 2
外部强引用全部 drop 后，两个 Node 的 Drop 从未运行（无输出）
```

The role of `RefCell` here is to make `next` mutable (see [interior mutability](./interior-mutability)).

## `Weak<T>` breaks the cycle

Replace one edge of the cycle with `Weak` (a weak reference that does not increment the strong count), and the cycle is broken: when the external strong references are dropped the count reaches zero and the data is destructed normally. `Weak::upgrade` returns `Option<Rc<T>>` — the target may already be dead, so you must handle that case:

```rust
use std::cell::RefCell;
use std::rc::{Rc, Weak};

struct Node {
    name: &'static str,
    next: Option<Weak<RefCell<Node>>>,
}

impl Drop for Node {
    fn drop(&mut self) {
        println!("Node({}) 被 drop", self.name);
    }
}

fn main() {
    let a = Rc::new(RefCell::new(Node { name: "a", next: None }));
    let b = Rc::new(RefCell::new(Node { name: "b", next: None }));
    a.borrow_mut().next = Some(Rc::downgrade(&b));
    b.borrow_mut().next = Some(Rc::downgrade(&a));
    println!("用 Weak 成环后: strong a = {}, strong b = {}", Rc::strong_count(&a), Rc::strong_count(&b));
    drop(a);
    println!("drop(a) 后: strong b = {}, b 指向的 a 可 upgrade? {}", Rc::strong_count(&b), b.borrow().next.as_ref().and_then(|w| w.upgrade()).is_some());
    drop(b);
    println!("drop(b) 后: 两个 Node 都已 drop（见上方输出）");
}
```

Actual run output:

```text
用 Weak 成环后: strong a = 1, strong b = 1
Node(a) 被 drop
drop(a) 后: strong b = 1, b 指向的 a 可 upgrade? false
Node(b) 被 drop
drop(b) 后: 两个 Node 都已 drop（见上方输出）
```

The convention: **the parent holds strong references (the child cannot outlive the parent and is released automatically), the child holds a weak reference back to the parent** (doubly linked lists, trees, and observers all follow this pattern).

## `Arc<T>`: the thread-safe `Rc`

`Rc`'s count operations are not atomic, so it is marked `!Send`; to share across threads you need `Arc` (atomic reference counting):

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3]);
    let mut handles = vec![];
    for i in 0..3 {
        let d = Arc::clone(&data);
        handles.push(thread::spawn(move || {
            println!("thread {i}: len = {}", d.len());
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("main: data = {:?}", data);
}
```

Actual run output (the order of the three thread lines depends on scheduling and may differ each run):

```text
thread 0: len = 3
thread 2: len = 3
thread 1: len = 3
main: data = [1, 2, 3]
```

`Rc` is for read-only sharing, `Arc` for read-only sharing across threads; to **mutate** shared data you additionally need `Mutex`/`RwLock` or atomic types (see [Send and Sync](./send-and-sync) and [fearless concurrency](./threads-and-channels)).

## Notes and common pitfalls

- **`Rc`/`Arc` are immutable sharing**: mutating the inner value requires combining them with `Cell`/`RefCell`/`Mutex`, which is exactly the topic of the next page.
- **Detecting cycle leaks**: after dropping, print `Rc::strong_count`; a count that never reaches zero means a cycle.

## References

- Official docs: "The Rust Programming Language" chapter 15 · Smart Pointers: <https://doc.rust-lang.org/book/ch15-00-smart-pointers.html>

## Related pages

- [Drop and destructors](./drop-and-destructors) — how `Rc` calls the inner value's `Drop` once the count reaches zero.
- [Interior mutability](./interior-mutability) — the classic combination of `RefCell` with `Rc`/`Arc`.
- [Send and Sync](./send-and-sync) — why `Rc` cannot cross threads while `Arc` can.
- [Glossary](../glossary) — the site-wide bilingual glossary of core terms with authoritative sources.
