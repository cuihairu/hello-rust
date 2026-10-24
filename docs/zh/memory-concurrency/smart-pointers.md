# 智能指针

引用只"借用"数据，智能指针则**拥有**数据并附带额外行为：`Box` 把值放进堆、`Rc`/`Arc` 做引用计数共享、它们都靠实现 `Deref` 与 `Drop` 融入语言。这一页的两个核心知识点：**Deref 自动解引用链**，与 **`Rc` 循环引用泄漏及 `Weak` 破环**。

## `Box<T>` 与 Deref 自动解引用

`Box` 最简单：把值分配到堆上，自身只留一个指针。实现了 `Deref` 后，方法调用与强制类型转换会沿着解引用链自动展开：

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

真实运行输出（rustc 1.99.0）：

```text
b = 5
s = hello, len = 5
r = hello
n = 5
```

`s.len()` 能工作，是因为编译器把 `Box<String>` 自动解引用成 `String` 再找方法；`let r: &str = &s` 走的是 **deref 强制转换**（deref coercion）——`&Box<String>` 先变 `&String` 再变 `&str`，一气呵成。

## `Rc<T>`：引用计数共享

`Rc`（reference counting）让多个 owner 共享同一份只读数据，`Rc::clone` 只把计数加一，不复制数据：

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

真实运行输出：

```text
a 创建后: strong = 1
clone 出 b 后: strong = 2
内层作用域 clone 出 c: strong = 3
内层作用域结束: strong = 2
drop(b) 后: strong = 1
```

计数归零（最后一个 strong 引用 drop）时数据才被释放。

## `Rc` 循环引用：真实的内存泄漏

`Rc` 互相指成环后，即使外部引用全部 drop，环内计数也永远到不了零——这是 Rust 里安全代码也能造出的内存泄漏：

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

真实运行输出（注意：没有任何 `Node(...) 被 drop`）：

```text
成环后: strong a = 2, strong b = 2
外部强引用全部 drop 后，两个 Node 的 Drop 从未运行（无输出）
```

`RefCell` 在这里的作用是让 `next` 可改（见[内部可变性](./interior-mutability)）。

## `Weak<T>` 破环

把环上的一条边换成 `Weak`（弱引用，不增加 strong 计数），环就断了：外部强引用 drop 时计数归零、数据正常析构。`Weak::upgrade` 返回 `Option<Rc<T>>`——目标可能已死，必须处理：

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

真实运行输出：

```text
用 Weak 成环后: strong a = 1, strong b = 1
Node(a) 被 drop
drop(a) 后: strong b = 1, b 指向的 a 可 upgrade? false
Node(b) 被 drop
drop(b) 后: 两个 Node 都已 drop（见上方输出）
```

惯例：**父持强引用（child 活不过父就自动释放），子持弱引用指回父**（双向链表、树、观察者都照此办理）。

## `Arc<T>`：线程安全版 `Rc`

`Rc` 的计数操作不是原子的，被标记为 `!Send`，跨线程共享要用 `Arc`（atomic reference counting）：

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

真实运行输出（三行 thread 输出的先后取决于调度，每次可能不同）：

```text
thread 0: len = 3
thread 2: len = 3
thread 1: len = 3
main: data = [1, 2, 3]
```

`Rc` 只读共享、`Arc` 跨线程只读共享；要**修改**共享数据，还得叠加 `Mutex`/`RwLock` 或原子类型（见 [Send 与 Sync](./send-and-sync)、[无畏并发](./threads-and-channels)）。

## 注意事项

- **`Rc`/`Arc` 是不可变共享**：想改内部值需要 `Cell`/`RefCell`/`Mutex` 组合，正是下一页主题。
- **检测环泄漏**：drop 后打印 `Rc::strong_count`，计数不归零即成环。

## 参考资料

- 官方文档：《The Rust Programming Language》第 15 章 · Smart Pointers：<https://doc.rust-lang.org/book/ch15-00-smart-pointers.html>

## 相关页面

- [Drop 与析构](./drop-and-destructors)——`Rc` 计数归零后如何调用内部值的 `Drop`。
- [内部可变性](./interior-mutability)——`RefCell` 与 `Rc`/`Arc` 的经典组合。
- [Send 与 Sync](./send-and-sync)——为什么 `Rc` 不能跨线程而 `Arc` 可以。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
