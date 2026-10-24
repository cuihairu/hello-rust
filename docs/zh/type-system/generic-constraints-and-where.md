# 泛型约束与 `where` 子句

**泛型约束（trait bound）** 告诉编译器「这个类型参数必须会做哪些事」。没有约束，编译器无法知道 `T` 上能调用什么方法；有了约束，泛型才能在编译期被安全地实例化。这一页讲多重约束、`where` 子句，以及用约束写出**条件实现**。

## 多重约束与 `+` 分隔

用 `+` 把多个 trait 连起来，类型参数必须**同时**满足所有约束：

```rust
use std::fmt::Display;

// + 分隔多个约束：既要能打印、又要能比较
fn max_and_show<T: PartialOrd + Display>(a: T, b: T) {
    if a > b {
        println!("max = {a}");
    } else {
        println!("max = {b}");
    }
}

fn main() {
    max_and_show(3, 9);
    max_and_show("apple", "banana");
    max_and_show(2.5, 2.5);
}
```

真实运行输出：

```text
max = 9
max = banana
max = 2.5
```

漏写约束时，编译器会直接指出「`T` 上不能做这个操作」，并给出补约束的建议。

## `where` 子句：把约束搬出参数列表

约束一多，写在尖括号里的签名就没法读了。`where` 子句把**参数列表**和**约束**分成两段：

```rust
use std::fmt::Debug;

fn dump_pair<T, U>(t: T, u: U) -> String
where
    T: Clone + Debug + PartialEq,
    U: Into<String> + Ord,
{
    let again = t.clone();          // 需要 Clone
    let same = t == again;          // 需要 PartialEq
    let text: String = u.into();    // 需要 Into<String>
    format!("{t:?} cloned={same} {text}") // 需要 Debug
}

fn main() {
    println!("{}", dump_pair((1, 2), "hi"));
}
```

真实运行输出：

```text
(1, 2) cloned=true hi
```

`where` 不只是排版工具，它还能表达尖括号里写不出的约束——比如约束某个类型的**关联类型**：

```rust
use std::fmt::Display;

fn print_all<I>(iter: I)
where
    I: Iterator,
    I::Item: Display,
{
    for x in iter {
        print!("{x} ");
    }
    println!();
}

fn main() {
    print_all(vec![1, 2, 3].into_iter());
    print_all(["a", "b"].into_iter());
}
```

真实运行输出：

```text
1 2 3 
a b 
```

`I::Item: Display` 意思是「不管这个迭代器产出什么，产出物必须能打印」。`where` 还能约束 `Self` 本身——标准库的 `Iterator::collect` 就带着 `where Self: Sized`，表示「不是 `Sized` 的类型没有这个方法」。

## 条件实现

bound 也可以写在 `impl` 上：**只有 `T` 满足条件时，这个实现才存在**。这就是 `Option<T>` 自动拥有 `Describe` 的方式：

```rust
trait Describe {
    fn describe(&self) -> String;
}

struct Point { x: i32, y: i32 }

impl Describe for Point {
    fn describe(&self) -> String { format!("Point({}, {})", self.x, self.y) }
}

// 条件实现：Option<T> 只在 T: Describe 时才有 describe 方法
impl<T: Describe> Describe for Option<T> {
    fn describe(&self) -> String {
        match self {
            Some(v) => format!("Some({})", v.describe()),
            None => String::from("None"),
        }
    }
}

fn main() {
    let some: Option<Point> = Some(Point { x: 1, y: 2 });
    let none: Option<Point> = None;
    println!("{}", some.describe());
    println!("{}", none.describe());
}
```

真实运行输出：

```text
Some(Point(1, 2))
None
```

标准库正是这样做的：`Vec<T>: Clone`、`Option<T>: Debug` 都是条件实现，所以只要元素可拷贝，容器就可拷贝。这也解释了为什么 `#[derive(Eq)]` 对含 `f64` 字段的结构体会失败——条件不满足时实现就不存在（见 [trait 与实现](../language-core/traits)）。

## 漏写约束时的真实报错

```rust
struct NotComparable {
    name: String,
}

fn max_of<T>(a: T, b: T) -> T {
    if a > b { a } else { b }
}

fn main() {
    let x = NotComparable { name: String::from("x") };
    let y = NotComparable { name: String::from("y") };
    println!("{}", max_of(x, y).name);
}
```

真实运行输出：

```text
error[E0369]: binary operation `>` cannot be applied to type `T`
 --> missing_bound.rs:6:10
  |
6 |     if a > b { a } else { b }
  |        - ^ - T
  |        |
  |        T
  |
help: consider restricting type parameter `T` with trait `PartialOrd`
  |
5 | fn max_of<T: std::cmp::PartialOrd>(a: T, b: T) -> T {
  |            ++++++++++++++++++++++

error: aborting due to 1 previous error

For more information about this error, try `rustc --explain E0369`.
```

报错发生在**编译期**：约束缺失不是运行时崩溃，而是根本编译不过。这正是泛型约束的意义——把「类型必须满足的条件」写成契约。

## 参考资料

- 官方文档：《The Rust Programming Language》第 10 章 · Defining Shared Behavior with Traits：<https://doc.rust-lang.org/book/ch10-02-traits.html>

## 相关页面

- [trait 与实现](../language-core/traits)——约束里 `+` 连接的这些东西是什么。
- [泛型与单态化](../language-core/generics-and-monomorphization)——约束如何驱动单态化。
- [关联类型](./associated-types)——`where I::Item: Display` 里关联类型的完整讲法。
- [`impl Trait`](./impl-trait)——另一种写约束的语法。
