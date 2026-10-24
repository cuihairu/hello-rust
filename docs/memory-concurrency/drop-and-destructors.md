# Drop and Destructors

Rust has no garbage collection, and no separate destructor phase: when an owner leaves scope, `Drop::drop` is called automatically — this is where the RAII pattern lands, and files, locks, and connections all rely on it for release. This page covers two things: **the determinism of drop order**, and how **dropck** prevents a destructor from using data that has already become invalid.

## Reverse variable order, forward field order

Variables within the same scope are dropped in **reverse** declaration order; when a struct itself implements `Drop`, its `drop` method body runs to completion first, then the fields are dropped in their **declaration order**. One program verifies both rules:

```rust
struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

#[allow(dead_code)]
struct Pair {
    first: Tracer,
    second: Tracer,
}

impl Drop for Pair {
    fn drop(&mut self) {
        println!("Pair::drop 开始");
    }
}

fn main() {
    let _a = Tracer("a");
    let _p = Pair { first: Tracer("first"), second: Tracer("second") };
    let _b = Tracer("b");
    println!("main body done");
}
```

Actual run output (rustc 1.99.0):

```text
main body done
dropping b
Pair::drop 开始
dropping first
dropping second
dropping a
```

`_b` is declared after `_p`, so it drops first; once `Pair`'s `drop` body has run, `first` precedes `second`. Reverse order is not a coincidence but a language guarantee: a variable declared later may reference data from earlier, and reverse order keeps the referent alive longer than the referrer.

## `std::mem::drop`: early release

If you don't want to wait for the end of the scope, call `std::mem::drop` to hand over ownership explicitly and drop immediately (also the common way to release a lock or file handle early):

```rust
struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

fn main() {
    let s = Tracer("s");
    println!("before drop");
    drop(s); // 显式提前 drop
    println!("after drop");
}
```

Actual run output:

```text
before drop
dropping s
after drop
```

## `ManuallyDrop`: opt out of automatic drop

In some situations a drop must be deferred or handed off (FFI taking over a buffer, a hand-rolled container). After wrapping in `ManuallyDrop<T>`, leaving scope **no longer** calls `Drop` automatically:

```rust
use std::mem::ManuallyDrop;

struct Tracer(&'static str);

impl Drop for Tracer {
    fn drop(&mut self) {
        println!("dropping {}", self.0);
    }
}

fn main() {
    let _md = ManuallyDrop::new(Tracer("md"));
    println!("离开作用域时不会打印 dropping md");
}
```

Actual run output (the process exits, and `dropping md` is never printed throughout):

```text
离开作用域时不会打印 dropping md
```

To actually release it, use `ManuallyDrop::take(&mut md)` to take back ownership and then drop it — this is an unsafe path: forgetting `take` is a leak, and `take`ing twice is undefined behavior.

## dropck and `#[may_dangle]`

A destructor may access borrowed data, so the compiler (drop check) requires: **the borrowed data outlives the borrower that will run `Drop`**. On stable, this code does not compile:

```rust
struct Inspector<'a, T: ?Sized>(&'a T, &'static str);

impl<'a, T: ?Sized> Drop for Inspector<'a, T> {
    fn drop(&mut self) {
        println!("Inspector drop: {}", self.1);
    }
}

struct World<T>(T);

fn main() {
    let mut world = World(42);
    let _inspector = Inspector(&world, "hello");
    world.0 = 43;
    println!("world.0 = {}", world.0);
}
```

Actual compiler error (stable, rustc 1.99.0):

```text
error[E0506]: cannot assign to `world.0` because it is borrowed
  --> p1_dropck_plain2.rs:14:5
   |
13 |     let _inspector = Inspector(&world, "hello");
   |                                ------ `world.0` is borrowed here
14 |     world.0 = 43;
   |     ^^^^^^^^^^^^ `world.0` is assigned to here but it was already borrowed
15 |     println!("world.0 = {}", world.0);
16 | }
   | - borrow might be used here, when `_inspector` is dropped and runs the `Drop` code for type `Inspector`
```

The problem: `Inspector`'s `drop` could access `world` through the `&'a T` borrow, so the borrow lives on until `_inspector` is dropped, blocking `world.0 = 43`. But this particular `drop` only reads the static string `self.1` and never touches `&'a T` — the rule is conservative.

`#[may_dangle]` (the mechanism comes from RFC 1238 nonparametric dropck; the attribute from RFC 1327 dropck-param-eyepatch) is an escape hatch for unsafe authors: it promises the compiler that "Drop does not access the data held by that lifetime/type parameter." To date it is still a nightly feature:

```rust
#![feature(dropck_eyepatch)]

struct Inspector<'a, T: ?Sized>(&'a T, &'static str);

// 承诺：drop 里绝不触碰 'a 与 T 持有的数据（只读 self.1 静态字符串）
unsafe impl<#[may_dangle] 'a, #[may_dangle] T: ?Sized> Drop for Inspector<'a, T> {
    fn drop(&mut self) {
        println!("Inspector drop: {}", self.1);
    }
}

struct World<T>(T);

fn main() {
    let mut world = World(42);
    let _inspector = Inspector(&world, "hello");
    world.0 = 43; // may_dangle 前提下合法
    println!("world.0 = {}", world.0);
}
```

Actual run output (nightly rustc compiles through):

```text
world.0 = 43
Inspector drop: hello
```

The standard library's `Vec` uses it to relax the restriction that "after the elements are moved out, Drop must not access them again." If the promise is a lie (the drop actually reads dangling data), it is undefined behavior.

## Notes and common pitfalls

- **Do not panic in a drop**: a second panic in the destructor chain aborts directly.
- **`Copy` and `Drop` are mutually exclusive**: a type that implements `Drop` cannot also implement `Copy`.
- **Drop order is a language guarantee**, so code that relies on it (release dependents first, then the resources) is safe.

## References

- Official docs: "The Rustonomicon" · Drop Check: <https://doc.rust-lang.org/nomicon/dropck.html>

## Related pages

- [Ownership and move semantics](../language-core/ownership-and-move) — drop happens on the foundation of ownership semantics.
- [Smart pointers](./smart-pointers) — the release of `Box`/`Rc`/`Arc` is all implemented by `Drop`.
- [Fearless concurrency](./threads-and-channels) — releasing locks also relies on drop (RAII guards).
- [Glossary](../glossary) — the site-wide bilingual glossary of core terms with authoritative sources.
