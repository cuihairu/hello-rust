# 枚举与模式匹配

Rust 的 `enum` 是**代数数据类型**：每个变体可以携带不同类型的数据。配套的 `match` 要求**穷尽**所有分支，编译器在编译期替你检查「有没有漏掉的分支」——这是 Rust 消灭空指针与未处理状态的根基。

## enum 携带数据

```rust
enum Shape {
    Circle(f64),                       // 元组变体：半径
    Rectangle { w: f64, h: f64 },      // 结构体变体：宽和高
    Point,                             // 无数据变体
}

fn area(s: &Shape) -> f64 {
    match s {
        Shape::Circle(r) => std::f64::consts::PI * r * r,
        Shape::Rectangle { w, h } => w * h,
        Shape::Point => 0.0,
    }
}

fn main() {
    let shapes = [Shape::Circle(2.0), Shape::Rectangle { w: 3.0, h: 4.0 }, Shape::Point];
    for s in &shapes {
        println!("area = {:.2}", area(s));
    }
}
```

真实运行输出：

```text
area = 12.57
area = 12.00
area = 0.00
```

同一个 `area` 函数处理三种数据形态，每个分支的解构方式与变体定义严格对应。若在 `match` 里漏掉 `Shape::Point`，编译器报 `non-exhaustive patterns`（E0004）拒绝编译——不需要运行到运行时才发现漏处理。

## `Option<T>`：用类型系统消灭空指针

标准库的 `Option` 就是两变体枚举（`Some(T)` / `None`）。Rust 没有 `null`，「无值」必须在类型里显式表达。

```rust
fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 { None } else { Some(a / b) }
}

fn main() {
    let x = divide(10.0, 4.0);
    let y = divide(10.0, 0.0);
    println!("x = {:?}", x);                       // Some(2.5)
    println!("y = {:?}", y);                       // None
    println!("x * 2 = {:?}", x.map(|v| v * 2.0)); // Some(5.0)
    let z = y.unwrap_or(0.0);
    println!("z = {z}");                          // 0
}
```

真实运行输出：

```text
x = Some(2.5)
y = None
x * 2 = Some(5.0)
z = 0
```

`Option` 的常用方法：`map`（对 `Some` 内的值做转换）、`unwrap_or`（取值或给默认值）、`unwrap_or_else`（给默认值的惰性版本）、`expect`（取值，`None` 时 panic 并带自定义消息）。

## match、if let 与穷尽性

- **match**：分支多、需要覆盖全部情况时用；编译器强制穷尽。
- **if let**：只关心一个分支时的语法糖，等价于只有一个匹配分支的 match，未匹配的情况返回 `None`。
- **模式**：解构不只是枚举——`if let Some(x) = opt`、`let [first, second, rest @ ..] = arr`、`Some(1 | 2)`（或模式）都属于模式。

```rust
fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1..=5 => "small",   // 范围模式
        _ => "other",       // 通配符兜底
    }
}
```

## 注意事项与常见坑

- **`unwrap()` 是 panic 之源**：`None.unwrap()` 会 panic。生产代码优先用 `match` / `map` / `unwrap_or` 表达默认行为；`expect` 适合「理论上不该为 None」并写明原因。
- **match 必须穷尽，除非有通配符 `_`**：漏分支是编译错误而非运行时 bug，`_` 通配符会掩盖将来新增的变体，谨慎使用。
- **枚举变体可以携带不同大小与类型的字段**，编译后 `Shape` 会被编译成「标签 + 联合体（union）」，不额外浪费内存——这也是代数数据类型的核心价值。

## 相关页面

- [错误处理](./error-handling)——`Option` 与 `Result` 都是两变体枚举。
- [trait 与实现](./traits)——`derive(Debug)` 等派生宏为枚举生成 trait 实现。
- [所有权与移动语义](./ownership-and-move)——match 分支里值的 move 语义。

官方文档：<https://doc.rust-lang.org/book/ch06-01-kinds-of-values.html>
