# 内部可变性

借用规则要求"一个可变引用 XOR 多个不可变引用"，且由编译器静态检查。**内部可变性（interior mutability）**把这条检查移到运行时：类型对外表现得不可变（`&self` 就能改），内部用 `Cell`/`RefCell` 单独把关。核心知识点：**借用规则运行时化**及其 panic 语义，与**它在真实代码里的位置**。

## `Cell<T>`：Copy 类型的整体换值

`Cell` 不给引用，只给 `get`/`set` 整体读写，所以适合 `Copy` 类型。看它如何让 `&self` 方法修改计数：

```rust
use std::cell::Cell;

struct Counter {
    count: Cell<u32>,
}

impl Counter {
    fn new() -> Self {
        Counter { count: Cell::new(0) }
    }
    // 注意是 &self 而不是 &mut self
    fn inc(&self) {
        self.count.set(self.count.get() + 1);
    }
    fn get(&self) -> u32 {
        self.count.get()
    }
}

fn main() {
    let c = Counter::new();
    c.inc();
    c.inc();
    c.inc();
    println!("count = {}", c.get());
}
```

真实运行输出（rustc 1.99.0）：

```text
count = 3
```

`c` 从头到尾没声明 `mut`，`inc(&self)` 却改了内部值——借用冲突被 `Cell` 内部的"无引用、只换值"设计消解了。

## `RefCell<T>`：借用检查移到运行时

`RefCell` 允许 borrow 出真正的引用，规则照旧（多个 `borrow` 或一个 `borrow_mut`），但检查发生在**运行时**——违反即 panic：

```rust
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(String::from("hello"));
    let r1 = cell.borrow();
    println!("r1 = {r1}");
    let r2 = cell.borrow_mut(); // 运行时 panic：r1 仍活跃
    println!("r2 = {r2}");
}
```

真实运行输出（进程以 101 退出）：

```text
r1 = hello

thread 'main' (666320) panicked at p3_refcell_panic.rs:7:19:
RefCell already borrowed
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

同一份代码在编译期完全合法——`borrow_mut` 签名没有问题，冲突只有在真正发生时才炸。这就是"安全但可能 panic"的代价换来的灵活性。

## `try_borrow` 与 `Ref::map`

不想 panic，用 `try_borrow`/`try_borrow_mut` 拿 `Result`：

```rust
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(String::from("hello"));
    let r1 = cell.borrow();
    println!("r1 = {r1}");
    let result = cell.try_borrow_mut();
    match result {
        Ok(_) => println!("try_borrow_mut 成功"),
        Err(e) => println!("try_borrow_mut 失败: {e}"),
    }
    drop(r1);
    let result = cell.try_borrow_mut();
    match result {
        Ok(mut m) => {
            m.push_str(", world");
            println!("drop(r1) 后 try_borrow_mut 成功: {m}");
        }
        Err(e) => println!("try_borrow_mut 失败: {e}"),
    }
}
```

真实运行输出：

```text
r1 = hello
try_borrow_mut 失败: RefCell already borrowed
drop(r1) 后 try_borrow_mut 成功: hello, world
```

另一个实用工具是 `Ref::map`：把 `Ref<User>` 投影成 `Ref<String>`（指向某个字段），只锁定被访问的字段区域，多个不可变投影可以共存：

```rust
use std::cell::{Ref, RefCell};

struct User {
    name: String,
    age: u32,
}

fn main() {
    let user = RefCell::new(User { name: String::from("alice"), age: 30 });
    let name: Ref<'_, String> = Ref::map(user.borrow(), |u| &u.name);
    println!("name = {name}");
    let age: Ref<'_, u32> = Ref::map(user.borrow(), |u| &u.age);
    println!("age = {age}");
    drop((name, age));
    let mut u = user.borrow_mut();
    u.age += 1;
    println!("age after +1 = {}", u.age);
}
```

真实运行输出：

```text
name = alice
age = 30
age after +1 = 31
```

## 真实用途：缓存失效标记

`RefCell` 不是玩具——标准库在 `Mutex`、`OnceCell`、`lazy` 模式里都靠它。一个典型场景：只读 API 背后藏着可变的失效标记：

```rust
use std::cell::RefCell;

struct Cache {
    data: String,
    dirty: RefCell<bool>, // 通过 &self 就能修改
}

impl Cache {
    fn new(data: &str) -> Self {
        Cache { data: data.to_string(), dirty: RefCell::new(false) }
    }
    fn mark_dirty(&self) {
        *self.dirty.borrow_mut() = true;
    }
    fn reload(&self) {
        if *self.dirty.borrow() {
            println!("缓存失效，重新加载 {}", self.data);
            *self.dirty.borrow_mut() = false;
        } else {
            println!("缓存命中: {}", self.data);
        }
    }
}

fn main() {
    let cache = Cache::new("config.json");
    cache.reload();
    cache.mark_dirty();
    cache.reload();
    cache.reload();
}
```

真实运行输出：

```text
缓存命中: config.json
缓存失效，重新加载 config.json
缓存命中: config.json
```

`reload(&self)` 与 `mark_dirty(&self)` 都拿不可变接收者，缓存对象可以在 `Rc`/`Arc` 后面共享——没有内部可变性，这种 API 根本设计不出来。

## 注意事项

- **`Cell`/`RefCell` 都不是 `Sync`**：跨线程等价物是 `Mutex`/`RwLock`/原子类型。
- **panic 不是异常处理**：`borrow` 冲突 panic 说明逻辑写错了，生产代码用 `try_borrow` 探测。

## 相关页面

- [智能指针](./smart-pointers)——`Rc<RefCell<T>>` 共享可变数据的经典组合。
- [借用与引用](../language-core/borrowing-and-references)——被运行时化的那条静态规则。
- [无畏并发](./threads-and-channels)——`Mutex`/`RwLock` 是跨线程版本的"RefCell"。

官方文档：<https://doc.rust-lang.org/book/ch15-05-interior-mutability.html>
