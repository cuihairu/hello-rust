# 关联类型

**关联类型（associated type）** 是 trait 里的占位类型：`type Item;` 这样一行声明，把「这个类型是什么」的决定权交给每个实现者。它和泛型参数解决的是同一个问题——「抽象出一个类型」——但取舍不同。这一页讲它是什么、什么时候用它而不是泛型参数，以及标准库里的两个重量级例子。

## `type Item`：把「产出什么」交给实现者

`Iterator` 只声明了「我产出一系列 `Item`」，具体产出什么，由实现者写 `type Item = ...` 决定：

```rust
// Iterator 的核心：关联类型 Item 把「产出什么类型」交给实现者决定
fn sum_of<I: Iterator>(mut iter: I) -> i32
where
    I::Item: Into<i32>,
{
    let mut total = 0;
    while let Some(x) = iter.next() {
        total += x.into();
    }
    total
}

fn main() {
    let v = vec![1i32, 2, 3];
    println!("sum via vec iter = {}", sum_of(v.into_iter()));
    println!("sum via range    = {}", sum_of(1..=10));
    println!("sum via chars    = {}", sum_of("abc".chars().map(|c| c as i32)));
}
```

真实运行输出：

```text
sum via vec iter = 6
sum via range    = 55
sum via chars    = 294
```

三种完全不同的迭代器——`vec::IntoIter`、`Range`、`Map`——都实现了同一个 `Iterator`，调用方只面对 `I::Item` 这个占位符。

## 关联类型 vs 泛型参数

如果把 `Iterator` 改成泛型参数 `trait Iter<T>`，一个类型就能同时对多个 `T` 实现；关联类型则保证**一个类型只有一份实现**。标准库选了后者，所以 `1..=10` 只能是「产出 `i32` 的迭代器」，不存在歧义：

```rust
// 假设用泛型参数而不是关联类型：一个类型可实现多次，调用时必须标注
trait IterGeneric<T> {
    fn next_g(&mut self) -> Option<T>;
}

struct Counter { n: u32 }

impl IterGeneric<u32> for Counter {
    fn next_g(&mut self) -> Option<u32> { self.n += 1; Some(self.n) }
}
impl IterGeneric<String> for Counter {
    fn next_g(&mut self) -> Option<String> { Some(format!("n={}", self.n)) }
}

fn main() {
    let mut c = Counter { n: 0 };
    // 歧义：next_g 该用哪个实现？必须显式标注
    let a: Option<u32> = IterGeneric::<u32>::next_g(&mut c);
    let b: Option<String> = IterGeneric::<String>::next_g(&mut c);
    println!("{a:?} {b:?}");
}
```

真实运行输出：

```text
Some(1) Some("n=1")
```

经验法则：

- **每个类型只该有一种「答案」时用关联类型**——`Iterator::Item`、`Deref::Target`、`Add::Output` 都是这个思路；
- **同一类型需要多份实现时用泛型参数**——`From<T>`、`AsRef<T>` 就是泛型参数，`String` 同时实现 `AsRef<str>` 和 `AsRef<[u8]>`，一个类型多份实现各得其所。

## `FnOnce::Output`：签名即类型

`FnOnce<Args>` 家族也用关联类型描述返回值，所以写 `FnOnce(i32) -> R` 时，编译器就知道 `F::Output == R`：

```rust
use std::fmt::Display;

// FnOnce 的关联类型 Output 描述「调用后返回什么」
fn call_and_describe<F, R>(f: F)
where
    F: FnOnce(i32) -> R,
    R: Display,
{
    let out: F::Output = f(21);
    println!("result = {out}, type = {}", std::any::type_name::<F::Output>());
}

fn main() {
    call_and_describe(|x| x * 2);
    call_and_describe(|x| format!("got {x}"));
}
```

真实运行输出：

```text
result = 42, type = i32
result = got 21, type = alloc::string::String
```

同一个泛型函数对两种闭包分别单态化，`F::Output` 在编译期就落定为 `i32` 和 `String`。

## 默认类型参数：`Add<Rhs = Self>`

关联类型常和**默认类型参数**搭配。`Add` 的定义是 `trait Add<Rhs = Self>`——不写 `Rhs` 就默认是 `Self`，写出来则可以为同一对类型定义多种加法：

```rust
use std::ops::Add;

#[derive(Debug, Clone, Copy)]
struct Millis(u64);
#[derive(Debug, Clone, Copy)]
struct Seconds(u64);

// Rhs 用默认值：Millis + Millis
impl Add for Millis {
    type Output = Millis;
    fn add(self, rhs: Millis) -> Millis { Millis(self.0 + rhs.0) }
}

// Rhs 换成别的类型：Seconds + Millis
impl Add<Millis> for Seconds {
    type Output = Millis;
    fn add(self, rhs: Millis) -> Millis { Millis(self.0 * 1000 + rhs.0) }
}

fn main() {
    println!("{:?}", Seconds(2) + Millis(500));
    println!("{:?}", Millis(1) + Millis(2));
}
```

真实运行输出：

```text
Millis(2500)
Millis(3)
```

注意 `Output` 也是关联类型——「相加得什么」由实现者决定，这里 `Seconds + Millis` 直接得到 `Millis`，不需要类型转换。运算符重载的完整用法见[运算符重载](./operator-overloading)。

## 参考资料

- 官方文档：《The Rust Programming Language》第 20 章 · Advanced Traits：<https://doc.rust-lang.org/book/ch20-02-advanced-traits.html>

## 相关页面

- [泛型约束与 `where` 子句](./generic-constraints-and-where)——`where I::Item: Display` 的语法基础。
- [泛型与单态化](../language-core/generics-and-monomorphization)——泛型参数一侧的完整讲法。
- [运算符重载](./operator-overloading)——`Add`、`Index` 等带关联类型的运算 trait。
- [trait 对象](./trait-objects)——关联类型 trait 与 `dyn` 的兼容问题。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
