# Lifetimes

**A lifetime** is the validity period of a reference. The compiler requires every reference to carry a lifetime annotation, to guarantee that "a reference never outlives the data it points to" — i.e. to rule out dangling references. This page covers why annotations are needed, how to write `'a`, and when they can be omitted.

## Why annotations are needed

Consider a case the compiler cannot decide automatically:

```rust
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}
```

The returned reference could come from `x` or from `y`, and the compiler cannot determine which lifetime the return value should follow, so it requires an explicit annotation.

## 'a annotations: describing constraints, not extending life

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("xyz");
        result = longest(s1.as_str(), s2.as_str());
        println!("longest = {result}"); // s2 还活着时合法
    } // s2 在此 drop；若在此之后再用 result 将编译失败
    // println!("{result}"); // 取消注释即编译错误
}
```

Actual run output:

```text
longest = long string
```

`'a` means: **there exists some lifetime `'a` such that `x`, `y`, and the return value all live at least that long**. It describes the constraint between the three; it does not make any value live longer — uncomment the final `println!("{result}")` and the compiler points out that `result`'s validity cannot exceed that of `s2`.

## Elision rules: common signatures need none

Most function signatures satisfy the **elision rules**; the compiler infers them automatically, and no manual annotation is needed:

1. Each reference parameter gets its own lifetime;
2. If there is only one input lifetime, it is assigned to all output lifetimes;
3. If there are multiple input lifetimes, but one of them is `&self` / `&mut self`, then `self`'s lifetime is assigned to all output lifetimes.

```rust
fn first_word(s: &str) -> &str {
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}

fn main() {
    let s = String::from("hello world");
    println!("first word = {}", first_word(&s)); // 省略标注也能编译
}
```

Actual run output:

```text
first word = hello
```

Rule 2 kicks in: the single input lifetime is assigned to the return value. Method signatures (rule 3) are the most common elision case, which is why patterns like `fn get(&self) -> &T` are everywhere.

## 'static: valid for the entire program

`'static` is a special lifetime: the data is valid for the entire program run. It covers string literals (compiled into the binary) and `static` constants:

```rust
fn main() {
    let s: &'static str = "程序整个生命周期都在的字符串";
    println!("{s}");
}
```

Actual run output:

```text
程序整个生命周期都在的字符串
```

Note: `'static` as a **constraint** (e.g. `T: 'static`) means "contains no non-'static references," which is a different thing from "the value truly lives forever." Do not conflate the two.

## Notes and common pitfalls

- **Annotations do not change how long any value lives**: `'a` is just a constraint declaration for the compiler; a wrong one only causes a compile failure, never a runtime issue.
- **Structs holding references must be annotated**: `struct Parser<'a> { input: &'a str }` — the lifetime parameter on a struct is mandatory.
- **Lifetime parameters sit alongside generic parameters**: `fn f<'a, T: 'a>(x: &'a T)` — a generic bound can require `T: 'a`.

## References

- Official docs: "The Rust Programming Language" Chapter 10 · Validating References with Lifetimes: <https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html>

## Related pages

- [Borrowing and References](./borrowing-and-references) — lifetimes are the static form of the borrowing rules.
- [Slices and &str](./slices-and-str) — a classic annotation case when a slice is returned.
- [Traits and Implementations](./traits) — the relationship between trait objects and lifetimes is covered in Part 2 on the type system.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
