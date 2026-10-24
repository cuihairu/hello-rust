# Enums and Pattern Matching

Rust's `enum` is an **algebraic data type**: each variant can carry data of a different type. The accompanying `match` requires **exhaustive** coverage of all branches, and the compiler checks for you at compile time whether any branch was missed — this is the foundation by which Rust eliminates null pointers and unhandled states.

## Enums carrying data

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

Actual run output:

```text
area = 12.57
area = 12.00
area = 0.00
```

The same `area` function handles three data shapes, and each branch's destructuring corresponds exactly to the variant definition. If you omit `Shape::Point` in the `match`, the compiler reports `non-exhaustive patterns` (E0004) and refuses to compile — no need to wait until runtime to discover the missed case.

## `Option<T>`: eliminating null pointers with the type system

The standard library's `Option` is simply a two-variant enum (`Some(T)` / `None`). Rust has no `null`; "no value" must be expressed explicitly in the type.

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

Actual run output:

```text
x = Some(2.5)
y = None
x * 2 = Some(5.0)
z = 0
```

Common `Option` methods: `map` (transform the value inside `Some`), `unwrap_or` (take the value or supply a default), `unwrap_or_else` (the lazy version of supplying a default), `expect` (take the value; panics with a custom message on `None`).

## match, if let, and exhaustiveness

- **match**: use it when there are many branches and all cases need to be covered; the compiler enforces exhaustiveness.
- **if let**: syntactic sugar for when you only care about one branch; equivalent to a match with a single matching arm, where the unmatched case returns `None`.
- **Patterns**: destructuring is not limited to enums — `if let Some(x) = opt`, `let [first, second, rest @ ..] = arr`, and `Some(1 | 2)` (an or-pattern) are all patterns.

```rust
fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1..=5 => "small",   // 范围模式
        _ => "other",       // 通配符兜底
    }
}
```

## Notes and common pitfalls

- **`unwrap()` is a source of panics**: `None.unwrap()` panics. In production code, prefer `match` / `map` / `unwrap_or` to express default behavior; `expect` is suited to "this should never be None" cases, with the reason spelled out.
- **match must be exhaustive unless there is a wildcard `_`**: a missed branch is a compile error, not a runtime bug; a `_` wildcard will mask variants added in the future, so use it cautiously.
- **Enum variants can carry fields of different sizes and types**: after compilation `Shape` is compiled as a "tag + union," wasting no extra memory — this is also the core value of algebraic data types.

## References

- Official docs: "The Rust Programming Language" Chapter 6 · Defining an Enum: <https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html>

## Related pages

- [Error Handling](./error-handling) — `Option` and `Result` are both two-variant enums.
- [Traits and Implementations](./traits) — derive macros like `derive(Debug)` generate trait implementations for enums.
- [Ownership and Move Semantics](./ownership-and-move) — move semantics of values inside match arms.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
