# Traits and Implementations

**A trait** defines a set of method signatures; any type can `impl` it. It is Rust's unit of abstraction — handling values of different types through a single interface, and (with generics) usually **zero-cost**. This page covers defining traits, default implementations, `impl Trait` parameters, and common standard library traits.

## Definition and implementation

```rust
trait Summary {
    fn summarize(&self) -> String;        // 必须实现
    fn topic(&self) -> String {           // 带默认实现：可不覆盖
        String::from("(默认主题)")
    }
}

struct Article {
    title: String,
    body: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}: {}", self.title, self.body)
    }
}

fn notify(item: &impl Summary) {
    println!("{} | {}", item.topic(), item.summarize());
}

fn main() {
    let a = Article {
        title: String::from("Rust 所有权"),
        body: String::from("每个值有唯一 owner"),
    };
    notify(&a);
}
```

Actual run output:

```text
(默认主题) | Rust 所有权: 每个值有唯一 owner
```

Three key points:

- Methods in a `trait` with no body are **required**; methods with a body can use the default implementation;
- `impl Summary for Article` and `impl Article` (inherent methods) are two different kinds of impl block;
- `fn notify(item: &impl Summary)` is **syntactic sugar**, equivalent to `fn notify<S: Summary>(item: &S)` (see [Generics and Monomorphization](./generics-and-monomorphization)).

## Common standard library traits

Most standard library traits cover cross-cutting concerns like "bitwise copy, default construction, comparison, printing," and many can be `derive`d directly:

```rust
#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct Point { x: i32, y: i32 }

fn main() {
    let p = Point { x: 1, y: 2 };
    let q = p;                 // Copy：p 仍可用
    let r = p.clone();         // Clone：显式深拷贝
    let d = Point::default();  // Default
    println!("{p:?} {q:?} {r:?} {d:?}");
    println!("p == q: {}", p == q);
}
```

Actual run output:

```text
Point { x: 1, y: 2 } Point { x: 1, y: 2 } Point { x: 1, y: 2 } Point { x: 0, y: 0 }
p == q: true
```

A few common ones:

| trait | purpose | derive support |
|---|---|---|
| `Debug` | `{:?}` printing | yes |
| `Clone` / `Copy` | deep copy / bitwise copy | yes (`Copy` also requires `Clone`) |
| `Default` | `Default::default()` | yes |
| `PartialEq` / `Eq` | `==` comparison | yes |
| `PartialOrd` / `Ord` | ordering | yes (`Ord` also requires `PartialOrd` and `Eq`) |
| `Display` | `{}` user-facing printing | no, must be hand-written |
| `Drop` | destructor hook | no, must be hand-written |

## Notes and common pitfalls

- **Whether a trait method's receiver is `&self`, `&mut self`, or `self`** determines whether it borrows or consumes — traits like `Deref` and `Drop` are fixed to `&mut self` by design.
- **`derive` only handles "field-by-field" logic**: `#[derive(Eq)]` on a struct containing `f64` fails to compile (`f64` does not implement `Eq`, because of NaN), and needs a hand-written `impl`.
- **The orphan rule restricts cross-crate implementations**: you cannot `impl` an external trait for an external type (e.g. `impl std::fmt::Display for Vec<foo::Bar>`); see Part 2 on the orphan rule for details.

## References

- Official docs: "The Rust Programming Language" Chapter 10 · Defining Shared Behavior with Traits: <https://doc.rust-lang.org/book/ch10-02-traits.html>

## Related pages

- [Generics and Monomorphization](./generics-and-monomorphization) — the expanded form of `impl Trait`.
- [Enums and Pattern Matching](./enums-and-pattern-matching) — `derive` generates trait implementations for enums.
- [Error Handling](./error-handling) — the `Error` trait and `Box<dyn Error>`.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
