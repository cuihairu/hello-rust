# Slices and &str

**A slice** is a view into a contiguous run of data: it does not own the data, it only records a "start pointer + length." It lets you safely refer to part of an array or a `String` without copying the data.

## Two kinds of slices

- `&[T]`: a slice of an arbitrary element type `T`;
- `&str`: a string slice, a semantic wrapper over `&[u8]` (guaranteeing the content is valid UTF-8).

A slice is a **fat pointer**: two words wide — a data pointer and a length. This allows slices to perform bounds checks safely, and they can also represent an empty slice.

## String slices and the classic first_word example

```rust
fn first_word(s: &String) -> &str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[..i];
        }
    }
    &s[..]
}

fn main() {
    let s = String::from("hello world");
    let w = first_word(&s);
    // s.clear(); // 错误：w 仍持有对 s 的不可变借用
    println!("first word = {w}");

    let arr = [1, 2, 3, 4, 5];
    let slice = &arr[1..4];
    println!("slice = {slice:?}"); // [2, 3, 4]
}
```

Actual run output:

```text
first word = hello
slice = [2, 3, 4]
```

Note the signature of `first_word`: the parameter is `&String` and the return type is `&str` — the return type is decoupled from the parameter type, so the function works on "the whole string" and "a string slice" alike. `&s[..i]` and `&s[..]` are slice syntax: `[..i]` is left-inclusive, right-exclusive; `[..]` is the full range.

## deref coercion: &String automatically converts to &str

When passing `&String` to a function that expects `&str`, Rust automatically performs **deref coercion** (dereference coercion):

```rust
fn main() {
    let s = String::from("hello");
    let r: &str = &s;        // deref coercion：&String → &str
    let r2: &str = &s[1..3]; // 切片也是 &str
    println!("{r}, {r2}");
}
```

Actual run output:

```text
hello, el
```

The deref coercion rules are transitive: `&String` → `&str` → `&[u8]`. They apply at function arguments, method calls, and similar positions, which is why mixing `&String` and `&str` is not awkward.

## Slices and borrowing work together

Slices are references and are governed by the [borrowing rules](./borrowing-and-references): the `w` returned by `first_word` above holds an immutable borrow of `s`, so `s.clear()` (which needs a mutable borrow) fails to compile while `w` is alive. This classic "cannot modify the string after first_word" example is precisely how the ownership model prevents the class of "iterator invalidation" bugs.

## Notes and common pitfalls

- **Slice bounds are checked at runtime**: if `i` is out of bounds in `&s[..i]`, it panics (`byte index out of bounds`); this cannot be prevented at compile time; use the `get` method to return an `Option`.
- **String slices must land on UTF-8 character boundaries**: slicing in the middle of a multi-byte character (such as Chinese) panics.
- **`&str` does not own the data**: its lifetime cannot exceed the referenced data, and returning a slice of a local `String` across a function boundary fails to compile (see [Lifetimes](./lifetimes)).

## References

- Official docs: "The Rust Programming Language" Chapter 4 · The Slice Type: <https://doc.rust-lang.org/book/ch04-03-slices.html>

## Related pages

- [Ownership and Move Semantics](./ownership-and-move) — slices do not transfer ownership, they only borrow.
- [Borrowing and References](./borrowing-and-references) — slices are governed by the same rules.
- [Lifetimes](./lifetimes) — annotations when a slice is returned.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
