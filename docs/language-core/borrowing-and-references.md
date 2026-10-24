# Borrowing and References

If every use of a value required giving up ownership first, code would come to a standstill. **Borrowing** lets you use a value temporarily through a reference (`&T` / `&mut T`) without taking ownership — the reference becomes invalid automatically when the scope ends, and the value itself is unaffected.

## Two kinds of references

- `&T`: a shared reference, read-only; any number can exist at the same time;
- `&mut T`: a mutable reference, read-write; only one can exist at a time.

```rust
fn main() {
    let mut s = String::from("hello");

    let r1 = &s; // 共享引用
    let r2 = &s; // 同时多个共享引用：允许
    println!("r1 = {r1}, r2 = {r2}");

    let r3 = &mut s; // 可变引用
    r3.push_str(", world");
    println!("r3 = {r3}");
}
```

Actual run output:

```text
r1 = hello, r2 = hello
r3 = hello, world
```

## Borrowing rules: a compile-time data race guardrail

At any given time, for the same piece of data, there is either only shared references, or only one mutable reference — the two cannot coexist:

```rust
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    let r2 = &mut s; // 错误：r1 仍活跃时不能创建 &mut s
    println!("{r1} {r2}");
}
```

The compiler refuses to compile (measured on rustc 1.99.0):

```text
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
 --> p2_err.rs:4:14
  |
3 |     let r1 = &s;
  |              -- immutable borrow occurs here
4 |     let r2 = &mut s;
  |              ^^^^^^ mutable borrow occurs here
5 |     println!("{r1} {r2}");
  |                -- immutable borrow later used here
```

Together with the rule that "a reference cannot outlive the data it points to," this eliminates data races at compile time — no runtime locks are needed to discover races, because they cannot be written in the first place.

## NLL: non-lexical lifetimes

Early Rust required a reference's lifetime to cover its entire lexical scope, even if the last use had already ended long before. Modern Rust uses **NLL (Non-Lexical Lifetimes)**: a reference's lifetime ends at its **last use**:

```rust
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    println!("{r1}"); // r1 最后一次使用
    let r2 = &mut s; // NLL：r1 已不再活跃，可以创建可变引用
    r2.push_str("!");
    println!("{r2}");
}
```

Actual run output:

```text
hello
hello!
```

NLL lets natural patterns like "read-only check first, mutable modification after" compile directly, without having to wrap the read operation in an extra scope.

## Dangling references: caught at compile time

A reference cannot point to freed memory. If a function returns a reference to a local variable, the compiler refuses outright:

```rust
fn dangle<'a>() -> &'a String {
    let s = String::from("hello");
    &s // 错误：s 在函数返回时被 drop，返回的引用将悬垂
}
```

The compiler refuses to compile (measured on rustc 1.99.0):

```text
error[E0515]: cannot return reference to local variable `s`
 --> p2_dangle2.rs:3:5
  |
3 |     &s
  |     ^^ returns a reference to data owned by the current function
```

(If the lifetime annotation is omitted, you get E0106 `missing lifetime specifier` first, the prerequisite error for E0515.) The correct approach is to move ownership out, or to use a reference passed in by the caller (see [Lifetimes](./lifetimes)).

## Notes and common pitfalls

- **No shared references are allowed while a mutable reference is active**: this includes reads of the original variable inside `println!`; the compiler judges precisely based on the "last use."
- **NLL is not a panacea**: complex borrows across branches or functions can still fail; when they do, start by drawing out each reference's "last use" point.
- **The borrow checker is compile-time only**: dynamic runtime borrowing (e.g. `RefCell`) is a separate mechanism; see Part 3 on memory and concurrency.

## References

- Official docs: "The Rust Programming Language" Chapter 4 · References and Borrowing: <https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html>

## Related pages

- [Ownership and Move Semantics](./ownership-and-move) — borrowing is the alternative to moving.
- [Lifetimes](./lifetimes) — annotations when passing references across functions.
- [Traits and Implementations](./traits) — `&self` / `&mut self` are common receivers for trait methods.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
