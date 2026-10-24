# Operator Overloading

Rust's operators are not special syntax but **aliases for method calls**: `a + b` is `Add::add(a, b)`, and `buf[i]` is `*Index::index(&buf, i)`. Implement the corresponding traits from `std::ops` and `std::cmp` for a custom type, and the operators come with it. This page walks through the full flow with vector arithmetic, then looks at two "syntactic-level" overloads: `Index` and `Deref`.

## Implementing vector arithmetic with `Add`/`Sub`/`Mul`/`Neg`

Every arithmetic trait carries an `Output` associated type (see [Associated types](./associated-types)) declaring "what type the result of the operation is":

```rust
use std::ops::{Add, Sub, Mul, Neg};

#[derive(Debug, Clone, Copy, PartialEq)]
struct Vec2 { x: f64, y: f64 }

impl Add for Vec2 {
    type Output = Self;
    fn add(self, rhs: Self) -> Self { Vec2 { x: self.x + rhs.x, y: self.y + rhs.y } }
}

impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self { Vec2 { x: self.x - rhs.x, y: self.y - rhs.y } }
}

// Rhs 指定为 f64：向量 × 标量
impl Mul<f64> for Vec2 {
    type Output = Self;
    fn mul(self, k: f64) -> Self { Vec2 { x: self.x * k, y: self.y * k } }
}

impl Neg for Vec2 {
    type Output = Self;
    fn neg(self) -> Self { Vec2 { x: -self.x, y: -self.y } }
}

fn main() {
    let a = Vec2 { x: 1.0, y: 2.0 };
    let b = Vec2 { x: 3.0, y: 4.0 };
    println!("a + b    = {:?}", a + b);
    println!("a - b    = {:?}", a - b);
    println!("a * 2.5  = {:?}", a * 2.5);
    println!("-a       = {:?}", -a);
}
```

Actual run output:

```text
a + b    = Vec2 { x: 4.0, y: 6.0 }
a - b    = Vec2 { x: -2.0, y: -2.0 }
a * 2.5  = Vec2 { x: 2.5, y: 5.0 }
-a       = Vec2 { x: -1.0, y: -2.0 }
```

Three details:

- The receiver for arithmetic operations is `self` (consumed by value), so the example derives `Copy` for `Vec2` — after `a + b`, `a` is still usable;
- `Mul<f64>` explicitly replaces the default type parameter `Rhs` with `f64` — the same pair of types can simultaneously define both "vector times scalar" and "vector times vector" multiplication;
- Compound assignment `+=` is controlled separately by the `AddAssign` family; it and `Add` are two distinct traits.

## `Index`/`IndexMut`: making `buf[i]` work

The `[]` indexing syntax corresponds to two traits: `Index` (read) and `IndexMut` (write). A custom container implementing them can use native indexing syntax:

```rust
use std::ops::{Index, IndexMut, Deref, DerefMut};

struct Buffer {
    data: Vec<u8>,
}

// Index：让 buf[i] 读语法生效
impl Index<usize> for Buffer {
    type Output = u8;
    fn index(&self, i: usize) -> &u8 { &self.data[i] }
}

// IndexMut：让 buf[i] = x 写语法生效
impl IndexMut<usize> for Buffer {
    fn index_mut(&mut self, i: usize) -> &mut u8 { &mut self.data[i] }
}

impl Deref for Buffer {
    type Target = [u8];
    fn deref(&self) -> &[u8] { &self.data }
}

impl DerefMut for Buffer {
    fn deref_mut(&mut self) -> &mut [u8] { &mut self.data }
}

fn main() {
    let mut buf = Buffer { data: vec![10, 20, 30] };
    println!("buf[1] = {}", buf[1]);
    buf[1] = 99;                                // 需要 IndexMut
    println!("after write, buf[1] = {}", buf[1]);
    println!("len via Deref = {}", buf.len());  // 方法调用自动解引用到 [u8]
}
```

Actual run output:

```text
buf[1] = 20
after write, buf[1] = 99
len via Deref = 3
```

## `Deref`/`DerefMut` and auto-dereferencing

The reason `buf.len()` works above is **deref coercion**: method resolution can't find `len` on `Buffer`, so it walks down through `Deref::deref` — `Buffer` becomes `[u8]`, and `len` hits. The same goes for `*x` and `&x` contexts; the reason `Box<T>` and `Rc<T>` act like `T` is this mechanism.

But `Deref` is for "smart pointer semantics," not for "inheritance." Adding `Deref` to a newtype seems to fix the "lost methods" problem from the [orphan rule](./orphan-rule-and-newtype) page, at the cost of leaking out **all** methods of the inner type (including ones that shouldn't be exposed) — it is generally only recommended for clear wrapper types.

## Operators that cannot be overloaded

The operator table in the reference lists every overloadable item (the traits in `std::ops`/`std::cmp`); anything not in the table cannot be overloaded:

- `&&`, `||` — short-circuit semantics must be guaranteed by the language; there is no corresponding trait;
- `.` field access — there is no mechanism to "intercept field access";
- `as` type casts, `&`/`&mut` borrows — the reference explicitly states "cannot be overloaded";
- `=` plain assignment is not overloadable (`==` goes through `PartialEq`, `+=` through `AddAssign`).

Overloading the call operator `()` is a special case: it is provided by the `Fn`/`FnMut`/`FnOnce` family, which is the closure mechanism itself — see [Closures and the `Fn` family](./closures-and-fn-trait-family).

## References

- Official docs: std standard library · std::ops: <https://doc.rust-lang.org/std/ops/>

## Related pages

- [Associated types](./associated-types) — the `Output` and default type parameter of every arithmetic trait.
- [Closures and the `Fn` family](./closures-and-fn-trait-family) — the mechanism behind overloading the call operator `()`.
- [The orphan rule and newtype](./orphan-rule-and-newtype) — the trade-offs of using `Deref` to compensate for lost methods.
- [Traits and implementations](../language-core/traits) — arithmetic traits are ordinary traits too.
- [Glossary](../glossary) — the Chinese-English cross-reference and authoritative sources for the site's core terminology.
