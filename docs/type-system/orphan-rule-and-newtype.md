# The Orphan Rule and Newtype

You want to implement your own trait for `Vec<i32>`, or add a `Display` implementation for `Vec<i32>`? The compiler blocks the latter — behind this is **coherence**, colloquially the **orphan rule**: in an `impl` block, at least one of the trait or the type **must be defined in the current crate**. This page covers the rule itself, the real E0117 error, and the standard technique for working around it: newtype.

## Why this rule is needed

Suppose there were no restriction: your crate implements `Display` for `Vec<i32>`, another crate also implements `Display` for `Vec<i32>`, and a program depends on both crates simultaneously — when `to_string()` is called, whose implementation wins? Rust's answer is to **eliminate the possibility of a second implementation by rule**: globally, a type's implementation of a trait must be unique, and the compiler can guarantee this without knowing the contents of other crates.

## E0117: external trait + external type

`Display` and `Vec` are both from the standard library (both "external" relative to the current crate) — neither is yours, so implementing directly:

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

Actual run output:

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

## The allowed directions

The rule only requires "at least one is local," so both directions are legal — **local trait + external type**:

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

Actual run output:

```text
vec-of-i32
string
```

"Local type + external trait" is equally allowed — your own types implementing `Display` and `Iterator` are perfectly natural (see [Traits and implementations](../language-core/traits)).

## newtype: wrapping one layer makes it a local type

If you really want to "spruce up" the behavior of an external type, the standard technique is the **newtype pattern**: define a local struct that wraps just one layer, and both the trait and the type then satisfy the rule:

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

Actual run output:

```text
MyVec 1, 2, 3
```

Zero runtime overhead: wrapping and unwrapping just move the same value, no copy occurs, and after compiler optimization nothing is left behind (see [Zero-cost abstraction](./zero-cost-abstraction)).

### The cost: inner type methods are not auto-forwarded

A newtype is a wall: the dozens of `Vec` methods stay on the other side of it.

```rust
struct Wrapper(Vec<i32>);

fn main() {
    let w = Wrapper(vec![1, 2, 3]);
    println!("len = {}", w.len());       // 方法没有自动转发
}
```

Actual run output:

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

The only working approach is to explicitly reach through one field layer: `w.0.len()`, `w.0.iter()`, and so on. When there are many methods, you can add a `Deref` implementation to make method resolution reach through automatically (see the `Deref` section in [Operator overloading](./operator-overloading)).

## References

- Official docs: "The Rust Reference" · Implementations (Orphan rules section): <https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules>

## Related pages

- [Traits and implementations](../language-core/traits) — the basic rules of `impl`, with an introductory mention of the orphan rule.
- [Zero-cost abstraction](./zero-cost-abstraction) — why a newtype adds no runtime overhead.
- [Operator overloading](./operator-overloading) — how `Deref` compensates for "lost methods."
- [Glossary](../glossary) — the Chinese-English cross-reference and authoritative sources for the site's core terminology.
