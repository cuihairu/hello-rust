# `impl Trait`

`impl Trait` 把「实现了某个 trait 的某个类型」写进签名：参数位置它是泛型的语法糖，返回位置它是**不透明类型**——调用方只知道能力、不知道具体类型。这一页讲两种位置的语义差别、返回闭包的标准写法，以及最容易踩坑的生命周期捕获规则。

## 参数位置：泛型参数的语法糖

`fn f(x: impl Debug)` 展开就是 `fn f<T: Debug>(x: T)`，每次调用按实参类型单态化，零成本：

```rust
use std::fmt::Debug;

// APIT：参数位置的 impl Trait 是泛型参数的语法糖
fn show_apit(x: impl Debug) {
    println!("{x:?}");
}

// 等价的泛型写法
fn show_generic<T: Debug>(x: T) {
    println!("{x:?}");
}

fn main() {
    show_apit(42);
    show_generic(42);
    show_apit("hello");
    show_generic("hello");
}
```

真实运行输出：

```text
42
42
"hello"
"hello"
```

表达力上泛型参数更强：两个参数要标注同一个类型（`fn max<T: Ord>(a: T, b: T)`）、或约束要写进 `where` 子句时，还得用泛型写法。

## 返回位置：隐藏具体类型

返回位置的 `impl Trait`（RPIT）语义完全不同：它是一个**固定但隐藏**的具体类型，所有返回路径必须是同一个类型。想按条件返回两种迭代器？编译器不接受——隐藏类型必须唯一：

```rust
fn pick(flag: bool) -> impl Iterator<Item = i32> {
    if flag {
        vec![1].into_iter()   // Vec<i32>::IntoIter
    } else {
        0..3                  // Range<i32>
    }
}

fn main() {
    for x in pick(true) { println!("{x}"); }
}
```

真实运行输出（节选，编译器建议部分略）：

```text
error[E0308]: `if` and `else` have incompatible types
 --> pick.rs:5:9
  |
2 | /     if flag {
3 | |         vec![1].into_iter()   // Vec<i32>::IntoIter
  | |         ------------------- expected because of this
4 | |     } else {
5 | |         0..3                  // Range<i32>
  | |         ^^^^ expected `IntoIter<{integer}>`, found `Range<{integer}>`
6 | |     }
  | |_____- `if` and `else` have incompatible types
  |
  = note: expected struct `std::vec::IntoIter<{integer}>`
             found struct `std::ops::Range<{integer}>`
help: you could change the return type to be a boxed trait object
  |
1 - fn pick(flag: bool) -> impl Iterator<Item = i32> {
1 + fn pick(flag: bool) -> Box<dyn Iterator<Item = i32>> {
```

报错的建议正是出路：类型真要运行时切换时用 `Box<dyn Trait>`，代价是堆分配加动态分发（见 [trait 对象](./trait-objects)）。

### 返回闭包

闭包类型是编译器生成的匿名类型，签名里**写不出它的名字**——RPIT 恰好不需要名字，所以它是返回闭包的标准姿势：

```rust
// 返回闭包：impl Trait 零成本，Box<dyn Fn> 灵活（可存进同一集合）；
// 注意每个闭包都要 move，否则它借用局部 x，函数返回后 x 已销毁
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| y + x
}

fn make_adder_boxed(x: i32) -> Box<dyn Fn(i32) -> i32> {
    Box::new(move |y| y + x)
}

fn main() {
    println!("impl Trait: {}", make_adder(5)(10));
    println!("Box<dyn>:   {}", make_adder_boxed(7)(10));
}
```

真实运行输出：

```text
impl Trait: 15
Box<dyn>:   17
```

不写 `move` 会怎样——闭包借用局部变量 `x`，而 `x` 在函数返回时销毁：

```rust
fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    |y| y + x   // 不 move：闭包借用 x，但 x 在函数返回时被销毁
}

fn main() {}
```

真实运行输出（节选，编译器建议部分略）：

```text
error[E0373]: closure may outlive the current function, but it borrows `x`, which is owned by the current function
 --> adder.rs:2:5
  |
2 |     |y| y + x   // 不 move：闭包借用 x，但 x 在函数返回时被销毁
  |     ^^^     - `x` is borrowed here
  |     |
  |     may outlive borrowed value `x`
help: to force the closure to take ownership of `x` (and any other referenced variables), use the `move` keyword
  |
2 |     move |y| y + x   // 不 move：闭包借用 x，但 x 在函数返回时被销毁
  |     ++++
```

## 生命周期捕获规则

RPIT 隐藏的类型可能**借用**输入参数。edition 2021 只捕获出现在 `impl Trait` 边界里的生命周期；隐藏类型额外捕获了边界外的生命周期时，要显式声明：

```rust
fn len_of(x: &str) -> impl Fn() -> usize {
    move || x.len()
}

fn main() {
    let s = String::from("hello");
    let f = len_of(&s);
    println!("len = {}", f());
}
```

真实运行输出（节选，编译器建议部分略）：

```text
error[E0700]: hidden type for `impl Fn() -> usize` captures lifetime that does not appear in bounds
 --> len_of.rs:3:5
  |
2 | fn len_of(x: &str) -> impl Fn() -> usize {
  |              ----     ------------------ opaque type defined here
  |              |
  |              hidden type `{closure@len_of.rs:3:5: 3:12}` captures the anonymous lifetime defined here
3 |     move || x.len()
  |     ^^^^^^^^^^^^^^^
```

照提示加 `use<'_>`（precise capturing，精确捕获），把匿名生命周期声明为被捕获：

```rust
fn len_of(x: &str) -> impl Fn() -> usize + use<'_> {
    move || x.len()
}

fn main() {
    let s = String::from("hello");
    let f = len_of(&s);
    println!("len = {}", f());
}
```

真实运行输出：

```text
len = 5
```

edition 2024 起这条规则放宽：RPIT 默认捕获作用域内**所有**生命周期，第一个版本不加 `use<'_>` 也能编译（本机 rustc 1.99.0、edition 2024 下实测通过）。`-> impl Iterator<Item = &str>` 这类写法则两个 edition 下都没问题——该生命周期出现在边界里，2021 就已捕获。

## 相关页面

- [泛型约束与 `where` 子句](./generic-constraints-and-where)——`impl Trait` 背后的约束系统。
- [闭包与 `Fn` 家族](./closures-and-fn-trait-family)——`impl Fn` 里的 `Fn` 到底是什么。
- [trait 对象](./trait-objects)——`Box<dyn Trait>` 路线的完整对比。
- [关联类型](./associated-types)——`impl Iterator<Item = i32>` 的语法解读。

官方文档：<https://doc.rust-lang.org/reference/types/impl-trait.html>
