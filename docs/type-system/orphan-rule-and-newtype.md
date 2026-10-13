# 孤儿规则与 newtype

想给 `Vec<i32>` 实现一个自己的 trait，或者给 `Display` 补一个 `Vec<i32>` 的实现？后者会被编译器拦下——这背后是 **coherence（一致性）规则**，俗称**孤儿规则（orphan rule）**：impl 块里的 trait 和类型，**至少有一个必须定义在当前 crate**。这一页讲规则本身、真实的 E0117 报错，以及绕过它的标准手法 newtype。

## 为什么需要这条规则

假设没有限制：你的 crate 给 `Vec<i32>` 实现了 `Display`，另一个 crate 也给 `Vec<i32>` 实现了 `Display`，两个程序同时依赖这两个 crate——调用 `to_string()` 时该用谁？Rust 的选择是**从规则上杜绝第二个实现出现的可能**：全局范围内，一个类型对一个 trait 的实现必须唯一，编译器无需知道其他 crate 的内容就能保证这一点。

## E0117：外部 trait + 外部类型

`Display` 和 `Vec` 都是标准库的（对当前 crate 是「外部」），两个都不是你的，直接 impl：

```rust
use std::fmt::{self, Display};

// 孤儿规则：trait 和类型至少有一个是本 crate 的
impl Display for Vec<i32> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "vec{:?}", self)
    }
}

fn main() {
    println!("{}", vec![1, 2, 3]);
}
```

真实运行输出：

```text
error[E0117]: only traits defined in the current crate can be implemented for types defined outside of the crate
 --> orphan.rs:4:1
  |
4 | impl Display for Vec<i32> {
  | ^^^^^^^^^^^^^^^^^--------
  |                  |
  |                  `Vec` is not defined in the current crate
  |
  = note: impl doesn't have any local type before any uncovered type parameters
  = note: for more information see https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules
  = note: define and implement a trait or new type instead

error: aborting due to 1 previous error

For more information about this error, try `rustc --explain E0117`.
```

## 允许的方向

规则只要求「至少一个是本地的」，所以两个方向都合法——**本地 trait + 外部类型**：

```rust
// 反方向：本地 trait + 外部类型是允许的
trait MyMarker {
    fn tag(&self) -> &'static str;
}

impl MyMarker for Vec<i32> {
    fn tag(&self) -> &'static str { "vec-of-i32" }
}

impl MyMarker for String {
    fn tag(&self) -> &'static str { "string" }
}

fn main() {
    println!("{}", vec![1, 2].tag());
    println!("{}", String::from("hi").tag());
}
```

真实运行输出：

```text
vec-of-i32
string
```

「本地类型 + 外部 trait」同样允许——你自己的类型实现 `Display`、`Iterator` 都是天经地义的（见 [trait 与实现](../language-core/traits)）。

## newtype：包一层就变成本地类型

真想给外部类型的行为「加点料」，标准手法是 **newtype 模式**：定义一个只包一层的本地结构体，trait 和类型就都满足了规则：

```rust
use std::fmt::{self, Display};

// newtype：定义一个本地包装类型，绕过孤儿规则
struct MyVec(Vec<i32>);

impl Display for MyVec {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "MyVec ")?;
        for (i, x) in self.0.iter().enumerate() {
            if i > 0 { write!(f, ", ")?; }
            write!(f, "{x}")?;
        }
        Ok(())
    }
}

fn main() {
    println!("{}", MyVec(vec![1, 2, 3]));
}
```

真实运行输出：

```text
MyVec 1, 2, 3
```

运行时零开销：包装和解包只是移动同一个值，不发生拷贝，编译器优化后不留下任何痕迹（见[零成本抽象](./zero-cost-abstraction)）。

### 代价：内部类型的方法不会自动转发

newtype 是一堵墙：`Vec` 的几十个方法都留在了墙的另一边。

```rust
struct Wrapper(Vec<i32>);

fn main() {
    let w = Wrapper(vec![1, 2, 3]);
    println!("len = {}", w.len());       // 方法没有自动转发
}
```

真实运行输出：

```text
error[E0599]: no method named `len` found for struct `Wrapper` in the current scope
 --> newtype_loss.rs:6:28
  |
2 | struct Wrapper(Vec<i32>);
  | -------------- method `len` not found for this struct
...
6 |     println!("len = {}", w.len());       // 方法没有自动转发
  |                            ^^^ method not found in `Wrapper`
  |
  = help: items from traits can only be used if the trait is implemented and in scope
  = note: the following trait defines an item `len`, perhaps you need to implement it:
          candidate #1: `ExactSizeIterator`
help: one of the expressions' fields has a method of the same name
  |
6 |     println!("len = {}", w.0.len());       // 方法没有自动转发
  |                            ++

error: aborting due to 1 previous error

For more information about this error, try `rustc --explain E0599`.
```

能用的办法只有显式穿透一层字段：`w.0.len()`、`w.0.iter()`……方法多的时候可以再补一个 `Deref` 实现，让方法解析自动穿透（见[运算符重载](./operator-overloading)里的 `Deref` 一节）。

## 相关页面

- [trait 与实现](../language-core/traits)——impl 的基本规则，孤儿规则的入门提及。
- [零成本抽象](./zero-cost-abstraction)——newtype 为什么不增加运行时开销。
- [运算符重载](./operator-overloading)——`Deref` 补救「方法丢失」的办法。

官方文档：<https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules>
