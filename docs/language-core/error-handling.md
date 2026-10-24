# Error Handling

Rust splits errors into two categories: **recoverable errors** are expressed explicitly in the type via `Result<T, E>`, and **unrecoverable errors** terminate via `panic!`. There are no exceptions and no `null` — error handling is part of the function signature, and a caller cannot pretend not to see it.

## Option and Result

- `Option<T>`: expresses "value present / value absent," used for normal business branches like "not found";
- `Result<T, E>`: expresses "success / failure," where `E` is the error type, used for operations that "may fail."

```rust
use std::error::Error;

fn parse_pair(s: &str) -> Result<(i32, i32), Box<dyn Error>> {
    let (a, b) = s.split_once(',').ok_or("missing comma")?;
    let x: i32 = a.trim().parse()?;
    let y: i32 = b.trim().parse()?;
    Ok((x, y))
}

fn main() {
    for input in ["3,4", "3,x", "3 4"] {
        match parse_pair(input) {
            Ok((x, y)) => println!("{input:?} => ok: {x} + {y} = {}", x + y),
            Err(e) => println!("{input:?} => err: {e}"),
        }
    }
}
```

Actual run output:

```text
"3,4" => ok: 3 + 4 = 7
"3,x" => err: invalid digit found in string
"3 4" => err: missing comma
```

## The ? operator: propagating errors upward

`?` is the soul of error handling: on success it unwraps the value inside `Ok`, and on failure it **returns immediately**, handing the error to the caller. It requires the function to return `Result` or `Option`:

```rust
fn f() -> Result<i32, String> {
    let x: Result<i32, String> = Ok(1)?;
    let y: Result<i32, String> = f()?;
    println!("{x} {y}");
}
```

Using `?` in a `main` that returns `()` fails to compile (measured on rustc 1.99.0):

```text
error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option`
```

`?` also performs error type conversion automatically: if the function returns `Box<dyn Error>`, `?` can wrap different error types such as `ParseIntError` and `String` into a `Box<dyn Error>` — this is why `parse_pair` above can mix `ok_or("missing comma")` (a `&str` error) with `.parse()?` (a `ParseIntError`).

## The boundary for using panic

`panic!` is for **unrecoverable** errors: continuing to run would violate an invariant (such as an out-of-bounds array access or division by zero). The default behavior is to unwind the stack and terminate the current thread.

```rust
fn main() {
    let v: Option<i32> = None;
    let x: i32 = v.expect("除数为零时本不该走这里");
    println!("{x}");
}
```

Actual run output:

```text
thread 'main' (3949320) panicked at p8_panic.rs:3:20:
除数为零时本不该走这里
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

The only difference between `expect` and `unwrap` is the panic message: `expect` lets you write down "why this should not fail," which is far more informative when debugging.

## Engineering practice: how to choose an error type

- **Library code**: define your own error type (implementing `std::error::Error`), or start out with `Box<dyn Error>`;
- **Application code**: `anyhow::Result` is the de facto standard, and `?` propagates any error directly;
- **Do not `panic!` on user input errors**: input errors are recoverable, so use `Result`;
- **`main` can return `Result`**: `fn main() -> Result<(), Box<dyn Error>>` makes `?` usable at the top level, printing the `Debug` representation on failure and exiting with a non-zero code.

## Notes and common pitfalls

- **`?` is not an exception**: it does not skip cleanup of intermediate stack frames; it is simply a syntactic sugar version of `match + return`;
- **`?` fails to compile when error types do not match**: for example, `?`-ing a `String` error inside `Result<_, ParseIntError>` reports E0277, and you need `map_err` or to unify everything into `Box<dyn Error>`;
- **`unwrap` is fine in tests, but be restrained in production**: test failures need explicit panics, while production code should prefer `match` / `unwrap_or` / `expect`.

## References

- Official docs: "The Rust Programming Language" Chapter 9 · Error Handling: <https://doc.rust-lang.org/book/ch09-00-error-handling.html>

## Related pages

- [Enums and Pattern Matching](./enums-and-pattern-matching) — `Option` and `Result` are both enums.
- [Traits and Implementations](./traits) — the `Error` trait and `From` conversions.
- [Ownership and Move Semantics](./ownership-and-move) — error values themselves also follow the move rules.
- [Glossary](../glossary) — core site-wide terminology with Chinese-English cross-reference and authoritative sources.
