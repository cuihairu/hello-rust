# Associated Types

**Associated types** are placeholder types inside a trait: a single line like `type Item;` hands the decision of "what this type is" to each implementor. They solve the same problem as generic parameters — "abstracting over a type" — but with different trade-offs. This page covers what they are, when to use them instead of a generic parameter, and two heavyweight examples from the standard library.

## `type Item`: letting the implementor decide "what is produced"

`Iterator` only declares "I produce a series of `Item`s"; what exactly is produced is decided by the implementor writing `type Item = ...`:

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

Actual run output:

```text
sum via vec iter = 6
sum via range    = 55
sum via chars    = 294
```

Three completely different iterators — `vec::IntoIter`, `Range`, `Map` — all implement the same `Iterator`, and the caller only ever faces the `I::Item` placeholder.

## Associated types vs generic parameters

If `Iterator` were written as a generic parameter `trait Iter<T>`, a single type could implement it for multiple `T`s; associated types guarantee **only one implementation per type**. The standard library chose the latter, so `1..=10` can only be "an iterator producing `i32`" — there is no ambiguity:

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

Actual run output:

```text
Some(1) Some("n=1")
```

Rule of thumb:

- **Use an associated type when there should only be one "answer" per type** — `Iterator::Item`, `Deref::Target`, and `Add::Output` all follow this idea;
- **Use a generic parameter when the same type needs multiple implementations** — `From<T>` and `AsRef<T>` are generic parameters; `String` implements both `AsRef<str>` and `AsRef<[u8]>`, one type with multiple implementations, each in its place.

## `FnOnce::Output`: the signature is the type

The `FnOnce<Args>` family also uses an associated type to describe the return value, so when you write `FnOnce(i32) -> R`, the compiler knows `F::Output == R`:

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

Actual run output:

```text
result = 42, type = i32
result = got 21, type = alloc::string::String
```

The same generic function is monomorphized separately for the two closures, and `F::Output` settles at compile time to `i32` and `String` respectively.

## Default type parameters: `Add<Rhs = Self>`

Associated types are often paired with **default type parameters**. `Add` is defined as `trait Add<Rhs = Self>` — if you don't write `Rhs` it defaults to `Self`, but if you write it explicitly you can define multiple additions for the same pair of types:

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

Actual run output:

```text
Millis(2500)
Millis(3)
```

Note that `Output` is also an associated type — "what adding yields" is decided by the implementor, and here `Seconds + Millis` directly yields `Millis` with no type conversion needed. For the full usage of operator overloading, see [Operator overloading](./operator-overloading).

## References

- Official docs: "The Rust Programming Language" Chapter 20 · Advanced Traits: <https://doc.rust-lang.org/book/ch20-02-advanced-traits.html>

## Related pages

- [Generic bounds and `where` clauses](./generic-constraints-and-where) — the syntactic foundation of `where I::Item: Display`.
- [Generics and monomorphization](../language-core/generics-and-monomorphization) — the full story of generic parameters.
- [Operator overloading](./operator-overloading) — arithmetic traits like `Add` and `Index` that carry associated types.
- [Trait objects](./trait-objects) — the compatibility issue between associated-type traits and `dyn`.
- [Glossary](../glossary) — the Chinese-English cross-reference and authoritative sources for the site's core terminology.
