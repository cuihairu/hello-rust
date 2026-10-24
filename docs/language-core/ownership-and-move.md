# Ownership and Move Semantics

Rust does not use a garbage collector to manage memory; instead it uses **ownership** rules to guarantee memory safety at compile time: every value has exactly one owner, and when the owner leaves scope the value is dropped (freed). This page covers the three rules and move semantics, the foundation for everything that follows — borrowing, lifetimes, and smart pointers.

## The three rules

1. Every value has exactly one owner (variable);
2. A value can have only one owner at any given time;
3. When the owner leaves scope, the value is dropped.

## move: assignment transfers ownership

Heap-allocated types like `String` undergo a **move** on assignment: the original variable gives up ownership and cannot be used afterward.

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 的所有权 move 给 s2
    // println!("{s1}"); // 取消注释即编译错误
    println!("s2 = {s2}");
}
```

Actual run output:

```text
s2 = hello
```

Uncommenting `println!("{s1}")` causes the compiler to refuse to compile (measured on rustc 1.99.0):

```text
error[E0382]: borrow of moved value: `s1`
 --> p1_move_err.rs:4:16
  |
2 |     let s1 = String::from("hello");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here
4 |     println!("{s1}");
  |                ^^ value borrowed here after move
```

The error message also points out the key fact: `String` does not implement the `Copy` trait, so it moves rather than copies.

## Copy types: assignment copies

Types that implement the `Copy` trait (integers, floats, bool, char, and tuples/arrays containing only Copy types) are copied bit-by-bit on assignment, and the original variable remains usable:

```rust
fn main() {
    let x = 5;
    let y = x; // i32 是 Copy 类型：复制而非 move
    println!("x = {x}, y = {y}"); // 两个变量都还能用
}
```

Actual run output:

```text
x = 5, y = 5
```

The division of labor between `Copy` and `Clone`: `Copy` is an implicit bit-by-bit copy (the old variable remains usable), while `Clone` is an explicit deep copy via `.clone()` (the old variable remains usable, but may allocate new memory).

## drop: freed when scope ends

When the owner leaves scope, Rust automatically calls `Drop` (which for `String` frees the heap memory):

```rust
fn main() {
    {
        let s = String::from("离开作用域即 drop");
        println!("{s}");
    } // s 在这里被 drop，堆内存释放
    println!("作用域已结束");
}
```

Actual run output:

```text
离开作用域即 drop
作用域已结束
```

Drop order is deterministic: variables are dropped in **reverse** order of declaration, and nested scopes drop the innermost first. This determinism is the foundation of the RAII pattern — file handles, locks, and connections are all released automatically when they leave scope.

## Function arguments and return values move too

Ownership rules apply beyond `let` assignments: passing a `String` into a function, or returning it from one, both result in a move.

```rust
fn take_ownership(s: String) {
    println!("got: {s}");
} // s 在这里 drop

fn main() {
    let s = String::from("hello");
    take_ownership(s); // s move 进函数
    // println!("{s}"); // 编译错误：s 已 move
}
```

## Notes and common pitfalls

- **move is not a bug, it is a guardrail**: a `use of moved value` compile error means you are using a value whose ownership has been given away; either redesign, or explicitly call `.clone()`.
- **clone is not a silver bullet**: deep copies have runtime cost; before cloning large objects frequently, consider whether ownership can simply be transferred.
- **Copy types have no drop semantics**: when an integer leaves scope nothing happens, so `Copy` and `Drop` are mutually exclusive (a type that implements `Drop` cannot implement `Copy`).

## References

- Official docs: "The Rust Programming Language" Chapter 4 · What is Ownership?: <https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html>

## Related pages

- [Borrowing and References](./borrowing-and-references) — use a value without transferring ownership.
- [Slices and &str](./slices-and-str) — a view into heap data.
- [Lifetimes](./lifetimes) — annotations for a reference's validity period.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
- [Project notes index](../knowledge) — site-wide index of key points.
