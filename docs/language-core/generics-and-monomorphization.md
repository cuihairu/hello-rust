# Generics and Monomorphization

**Generics** let one piece of code serve many types: `fn largest<T>(...)` works for both `i32` and `char`. Rust's generics are **compile-time polymorphism** — the compiler generates a specialized copy for every concrete type actually used, a process called **monomorphization**, so there is no runtime overhead.

## Generic functions and structs

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

Actual run output:

```text
largest int = 50
largest char = y
max = 9
```

Three key points:

- `T: PartialOrd` is a **trait bound**: the generic parameter `T` must implement `PartialOrd` for the `>` comparison to work;
- `impl<T> Pair<T>` means "implement for all `T`," while `impl<T: PartialOrd + Display> Pair<T>` means "implement only for `T` satisfying the bounds";
- A generic parameter can appear in the return type (`-> &T`); the return value and the parameter share the same `T`.

## Monomorphization: expanded at compile time, zero runtime overhead

Generic functions are instantiated per actual type at compile time. You can verify this by inspecting the symbol table with `nm` (rustc 1.99.0, compiled with `-C opt-level=0`):

```rust
fn id<T>(x: T) -> T { x }
fn main() {
    let a = id(42);
    let b = id("str");
    println!("{a} {b}");
}
```

Actual run output:

```text
42 str
```

Two independent symbols appear in the symbol table:

```text
0000000000014a78 t p7_mono::id::<i32>
0000000000014a70 t p7_mono::id::<&str>
```

`id::<i32>` and `id::<&str>` are two independent pieces of machine code — generics are "instantiated" into concrete functions at compile time and called directly at runtime, with no vtable and no dynamic dispatch. This is what "zero-cost abstraction" means: you write generic code, and what runs is specialized code.

## Compared with dynamic dispatch

The cost of monomorphization is **code size**: every instantiated type generates its own copy. When the number of types is unbounded (as with trait objects like `Box<dyn Trait>`), switch to dynamic dispatch at runtime — the trade-offs are covered in Part 2 on the type system.

## Notes and common pitfalls

- **Writing trait bounds in a `where` clause is clearer**: for complex cases like `fn f<T: A + B, U: C>(...)`, use `fn f<T, U>(...) where T: A + B, U: C`;
- **Generic parameters have a `Sized` bound by default**: `fn f<T>(x: T)` requires `T` to have a known size at compile time; use `fn f<T: ?Sized>(x: &T)` to accept dynamically sized types like `str` and `[T]`;
- **Monomorphization slows compilation**: heavy instantiation (e.g. generics + iterator chains) can significantly increase compile time; converge to `dyn Trait` when necessary.

## References

- Official docs: "The Rust Programming Language" Chapter 10 · Generic Data Types: <https://doc.rust-lang.org/book/ch10-01-syntax.html>

## Related pages

- [Traits and Implementations](./traits) — `impl Trait` is syntactic sugar for generic parameters.
- [Ownership and Move Semantics](./ownership-and-move) — move rules for values are unchanged inside generic functions.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
- [Project notes index](../knowledge) — site-wide index of key points.
