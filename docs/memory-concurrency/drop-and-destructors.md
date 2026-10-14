# Drop 与析构

Rust 没有垃圾回收，也没有独立的析构阶段：owner 离开作用域时自动调用 `Drop::drop`，这是 RAII 模式的落点——文件、锁、连接都靠它释放。这一页讲两件事：**drop 顺序的确定性**，以及 **dropck** 如何防止析构函数使用已失效的数据。

## 变量逆序、字段正序

同一作用域内的变量按声明**逆序**析构；结构体自身实现 `Drop` 时，先跑完它的 `drop` 方法体，再按字段**声明顺序**析构各字段。一个程序同时验证两条规则：

```rust
struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

#[allow(dead_code)]
struct Pair {
    first: Tracer,
    second: Tracer,
}

impl Drop for Pair {
    fn drop(&mut self) {
        println!("Pair::drop 开始");
    }
}

fn main() {
    let _a = Tracer("a");
    let _p = Pair { first: Tracer("first"), second: Tracer("second") };
    let _b = Tracer("b");
    println!("main body done");
}
```

真实运行输出（rustc 1.99.0）：

```text
main body done
dropping b
Pair::drop 开始
dropping first
dropping second
dropping a
```

`_b` 在 `_p` 之后声明所以先析构；`Pair` 的 `drop` 方法体跑完，`first` 再先于 `second`。逆序不是巧合而是语言保证：后声明的变量可能引用前面的数据，逆序让被引用者活得比引用者久。

## `std::mem::drop`：提前释放

不想等作用域结束，就调用 `std::mem::drop` 显式交出所有权并立即析构（也是尽早释放锁、文件句柄的常用手段）：

```rust
struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

fn main() {
    let s = Tracer("s");
    println!("before drop");
    drop(s); // 显式提前 drop
    println!("after drop");
}
```

真实运行输出：

```text
before drop
dropping s
after drop
```

## `ManuallyDrop`：豁免自动析构

有些场景析构必须延后或转交（FFI 接管缓冲区、手写容器）。`ManuallyDrop<T>` 包裹后离开作用域**不再**自动调用 `Drop`：

```rust
use std::mem::ManuallyDrop;

struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

fn main() {
    let _md = ManuallyDrop::new(Tracer("md"));
    println!("离开作用域时不会打印 dropping md");
}
```

真实运行输出（进程退出，全程没有 `dropping md`）：

```text
离开作用域时不会打印 dropping md
```

想真正释放时，用 `ManuallyDrop::take(&mut md)` 取回所有权再 drop——这是一条 unsafe 路径：忘了 `take` 是泄漏，重复 `take` 是未定义行为。

## dropck 与 `#[may_dangle]`

析构函数可能访问借来的数据，所以编译器（drop check）要求：**被借用的数据活得比会执行 `Drop` 的借用者久**。stable 上这段代码编译不过：

```rust
struct Inspector<'a, T: ?Sized>(&'a T, &'static str);

impl<'a, T: ?Sized> Drop for Inspector<'a, T> {
    fn drop(&mut self) {
        println!("Inspector drop: {}", self.1);
    }
}

struct World<T>(T);

fn main() {
    let mut world = World(42);
    let _inspector = Inspector(&world, "hello");
    world.0 = 43;
    println!("world.0 = {}", world.0);
}
```

真实编译报错（stable，rustc 1.99.0）：

```text
error[E0506]: cannot assign to `world.0` because it is borrowed
  --> p1_dropck_plain2.rs:14:5
   |
13 |     let _inspector = Inspector(&world, "hello");
   |                                ------ `world.0` is borrowed here
14 |     world.0 = 43;
   |     ^^^^^^^^^^^^ `world.0` is assigned to here but it was already borrowed
15 |     println!("world.0 = {}", world.0);
16 | }
   | - borrow might be used here, when `_inspector` is dropped and runs the `Drop` code for type `Inspector`
```

问题：`Inspector` 的 `drop` 借着 `&'a T` **可能**访问 `world`，借用因此一直活到 `_inspector` 析构，挡住了 `world.0 = 43`。但这个 `drop` 实际只读静态字符串 `self.1`，没碰 `&'a T`——规则保守了。

`#[may_dangle]`（机制来自 RFC 1238 nonparametric dropck，属性来自 RFC 1327 dropck-param-eyepatch）是给 unsafe 作者的逃生舱：向编译器承诺"Drop 不访问该生命周期/类型参数持有的数据"。至今是 nightly 特性：

```rust
#![feature(dropck_eyepatch)]

struct Inspector<'a, T: ?Sized>(&'a T, &'static str);

// 承诺：drop 里绝不触碰 'a 与 T 持有的数据（只读 self.1 静态字符串）
unsafe impl<#[may_dangle] 'a, #[may_dangle] T: ?Sized> Drop for Inspector<'a, T> {
    fn drop(&mut self) {
        println!("Inspector drop: {}", self.1);
    }
}

struct World<T>(T);

fn main() {
    let mut world = World(42);
    let _inspector = Inspector(&world, "hello");
    world.0 = 43; // may_dangle 前提下合法
    println!("world.0 = {}", world.0);
}
```

真实运行输出（nightly rustc 编译通过）：

```text
world.0 = 43
Inspector drop: hello
```

标准库的 `Vec` 就用它放宽了"元素 move 走之后 Drop 不得再访问"的限制。承诺若撒谎（drop 里真去读了悬垂数据），就是未定义行为。

## 注意事项

- **不要在 drop 里 panic**：析构链中二次 panic 会直接 abort。
- **`Copy` 与 `Drop` 互斥**：实现了 `Drop` 的类型不能再实现 `Copy`。
- **drop 顺序是语言保证**，依赖它写的代码（先释放依赖、后释放资源）是安全的。

## 参考资料

- 官方文档：《The Rustonomicon》· Drop Check：<https://doc.rust-lang.org/nomicon/dropck.html>

## 相关页面

- [所有权与移动语义](../language-core/ownership-and-move)——drop 发生在所有权语义的地基上。
- [智能指针](./smart-pointers)——`Box`/`Rc`/`Arc` 的释放都由 `Drop` 实现。
- [无畏并发](./threads-and-channels)——锁的释放同样靠 drop（RAII 守卫）。
