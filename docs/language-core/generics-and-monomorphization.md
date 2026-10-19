# 泛型与单态化

**泛型**让一份代码服务多种类型：`fn largest<T>(...)` 对 `i32` 和 `char` 都能工作。Rust 的泛型是**编译期多态**——编译器为每个实际使用的具体类型生成一份专用代码，这叫**单态化（monomorphization）**，因此没有运行时开销。

## 泛型函数与结构体

```rust
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut max = &list[0];
    for item in list {
        if item > max { max = item; }
    }
    max
}

struct Pair<T> { first: T, second: T }

impl<T> Pair<T> {
    fn new(first: T, second: T) -> Self { Self { first, second } }
}

impl<T: PartialOrd + std::fmt::Display> Pair<T> {
    fn show_max(&self) {
        if self.first > self.second {
            println!("max = {}", self.first);
        } else {
            println!("max = {}", self.second);
        }
    }
}

fn main() {
    let nums = [34, 50, 25];
    println!("largest int = {}", largest(&nums));
    let chars = ['y', 'm', 'a'];
    println!("largest char = {}", largest(&chars));
    let p = Pair::new(3, 9);
    p.show_max();
}
```

真实运行输出：

```text
largest int = 50
largest char = y
max = 9
```

三个要点：

- `T: PartialOrd` 是 **trait bound**：泛型参数 `T` 必须实现 `PartialOrd` 才能用 `>` 比较；
- `impl<T> Pair<T>` 是「对所有 `T` 实现」，`impl<T: PartialOrd + Display> Pair<T>` 是「只对满足约束的 `T` 实现」；
- 泛型参数可以出现在返回类型里（`-> &T`），返回值与参数共享同一个 `T`。

## 单态化：编译期展开，零运行时开销

泛型函数在编译时按实际类型各生成一份。用 `nm` 查看符号表可以实证（rustc 1.99.0，`-C opt-level=0` 编译）：

```rust
fn id<T>(x: T) -> T { x }
fn main() {
    let a = id(42);
    let b = id("str");
    println!("{a} {b}");
}
```

真实运行输出：

```text
42 str
```

符号表中出现两个独立符号：

```text
0000000000014a78 t p7_mono::id::<i32>
0000000000014a70 t p7_mono::id::<&str>
```

`id::<i32>` 与 `id::<&str>` 是两份独立机器码——泛型在编译期被「实例化」为具体函数，运行时直接调用，没有虚函数表、没有动态分发。这就是「零成本抽象」的含义：你写的是泛型，跑的是专用代码。

## 与动态分发的对比

单态化的代价是**代码体积**：每个实例化类型都生成一份代码。若类型数量不可控（如 trait 对象 `Box<dyn Trait>`），则改用运行时分发的动态派发——权衡见第 2 部分类型系统。

## 注意事项与常见坑

- **trait bound 写在 `where` 子句更清晰**：`fn f<T: A + B, U: C>(...)` 复杂时用 `fn f<T, U>(...) where T: A + B, U: C`；
- **泛型参数默认没有 `Sized` 约束**：`fn f<T>(x: T)` 要求 `T` 编译期已知大小；`fn f<T: ?Sized>(x: &T)` 才接受 `str`、`[T]` 这类动态大小类型；
- **单态化会拖慢编译**：大量实例化（如泛型 + 迭代器链）会显著增加编译时间，必要时用 `dyn Trait` 收敛。

## 参考资料

- 官方文档：《The Rust Programming Language》第 10 章 · Generic Data Types：<https://doc.rust-lang.org/book/ch10-01-syntax.html>

## 相关页面

- [trait 与实现](./traits)——`impl Trait` 是泛型参数的语法糖。
- [所有权与移动语义](./ownership-and-move)——泛型函数里值的 move 规则不变。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
- [项目笔记索引](../knowledge)——全站要点索引。
