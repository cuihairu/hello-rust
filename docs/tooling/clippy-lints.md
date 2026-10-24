# clippy and Lints

clippy is Rust's official linter, with over 700 lints covering dimensions such as style, correctness, and performance (version measured in this environment: `clippy 0.1.99 (b940084d7e 2026-09-28)`). It shares rustc's frontend, and `cargo clippy` layers lint checking on top of `cargo check`.

## Three lint levels: allow / warn / deny

Each lint has four optional levels: `allow` (disabled), `warn` (warning), `deny` (error), and `forbid` (error that cannot be overridden). The default level is determined by the lint itself — most are `allow`, some are `warn`. You can adjust levels in code using attributes:

```rust
#![deny(clippy::clone_on_copy)]

fn clone_on_copy(x: i32) -> i32 {
    x.clone()
}

fn main() {
    println!("{}", clone_on_copy(5));
}
```

Actual run output:

```text
--- deny lint: build fails ---
error: using `clone` on type `i32` which implements the `Copy` trait
 --> src/main.rs:4:5
  |
4 |     x.clone()
  |     ^^^^^^^^^ help: try removing the `clone` call: `x`
  |
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#clone_on_copy
note: the lint level is defined here
 --> src/main.rs:1:9
  |
1 | #![deny(clippy::clone_on_copy)]
  |         ^^^^^^^^^^^^^^^^^^^^^

error: could not compile `clippy-demo` (bin "clippy-demo") due to 1 previous error
=== EXIT: 101 ===
```

A lint marked `deny` appears as an `error` and causes `cargo clippy` to exit non-zero. But note — `cargo build` does not run clippy lints and still succeeds (measured `Finished` + `EXIT: 0`). clippy's lints are injected by `clippy-driver`; rustc itself does not know they exist. So CI must explicitly run `cargo clippy`.

## Common lint groups

clippy organizes its lints into groups. The ones enabled by default are `correctness`, `suspicious`, `style`, `complexity`, and `perf`. Other commonly used groups: `pedantic` (strict best practices, enabled selectively), `nursery` (experimental, may produce false positives), `restriction` (restrictive, enabled per-lint individually, not suitable for enabling as a whole group), and `cargo` (checks `Cargo.toml` itself).

Testing what each group independently catches with a single piece of code (`#![allow(clippy::all)]` disables the default groups first, then one group is enabled at a time; correctness / suspicious / perf produced no output for this example):

```text
=== clippy::style ===
length comparison to zero
writing `&String` instead of `&str` involves a new object where a slice will do
writing `&Vec` instead of `&[_]` involves a new object where a slice will do

=== clippy::complexity ===
using `clone` on type `i32` which implements the `Copy` trait

=== clippy::pedantic ===
this function could have a `#[must_use]` attribute

=== clippy::nursery ===
this could be a `const fn`
```

The corresponding lint names: `len_zero` (style), `ptr_arg` (style), `clone_on_copy` (complexity), `must_use_candidate` (pedantic), `missing_const_for_fn` (nursery). A whole group name cannot be used directly as a lint name — for example, `#![warn(clippy::style)]` is legal, but the `clippy::restriction` group is explicitly noted by the official docs as "not meant to be enabled as a group".

## Actual lint output

Intentionally writing code that triggers the default groups:

```rust
fn get_first(v: &Vec<i32>) -> i32 {
    v[0]
}

fn check_empty(s: &String) -> bool {
    s.len() == 0
}

fn clone_on_copy(x: i32) -> i32 {
    x.clone()
}

fn main() {
    let v = vec![1, 2, 3];
    println!("first: {}", get_first(&v));
    println!("empty: {}", check_empty(&String::from("abc")));
    println!("copy: {}", clone_on_copy(5));
}
```

Actual run output (4 warnings in total, 2 shown here, the rest have the same structure):

```text
warning: writing `&Vec` instead of `&[_]` involves a new object where a slice will do
 --> src/main.rs:1:17
  |
1 | fn get_first(v: &Vec<i32>) -> i32 {
  |                 ^^^^^^^^^
  |
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#ptr_arg
  = note: `#[warn(clippy::ptr_arg)]` on by default
help: change this to
  |
1 - fn get_first(v: &Vec<i32>) -> i32 {
1 + fn get_first(v: &[i32]) -> i32 {

warning: length comparison to zero
 --> src/main.rs:6:5
  |
6 |     s.len() == 0
  |     ^^^^^^^^^^^^ help: using `is_empty` is clearer and more explicit: `s.is_empty()`
  |
  = note: `#[warn(clippy::len_zero)]` on by default

warning: `clippy-demo` (bin "clippy-demo") generated 4 warnings (run `cargo clippy --fix --bin "clippy-demo" -p clippy-demo -- ` to apply 2 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.46s
=== EXIT: 0 ===
```

Each lint reports: the trigger location, the lint name (click the link to go to the official documentation), and a fix suggestion. `--fix` reports how many suggestions it can apply automatically.

## Custom clippy.toml

Some lints accept configuration, written in a `clippy.toml` at the crate root. Measuring `cognitive-complexity-threshold`:

```toml
cognitive-complexity-threshold = 0
```

Combined with `#![warn(clippy::cognitive_complexity)]`:

Actual run output:

```text
warning: the function has a cognitive complexity of (7/0)
 --> src/main.rs:3:4
  |
3 | fn classify(score: u32, bonus: bool, penalty: bool) -> &'static str {
  |    ^^^^^^^^
  |
  = help: you could split it up into multiple smaller functions
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#cognitive_complexity
note: the lint level is defined here
 --> src/main.rs:1:9
  |
1 | #![warn(clippy::cognitive_complexity)]
  |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: `clippy-demo` (bin "clippy-demo") generated 2 warnings
=== EXIT: 0 ===
```

clippy validates configuration key names — writing a non-existent key immediately errors out and lists all valid keys (measured `error: unknown field name`). `cognitive_complexity` belongs to the restriction group, defaults to `allow`, and must be explicitly set to warn.

## CI usage and --fix

The standard CI approach is to escalate warnings to errors:

```bash
cargo clippy -- -D warnings
```

Actual run output:

```text
error: could not compile `clippy-demo` (bin "clippy-demo") due to 1 previous error
=== EXIT: 101 ===
```

Arguments after `--` are passed to clippy-driver as rustc flags; `-D warnings` promotes all warn-level lints to deny. Local fixes can be delegated to auto-fix (`cargo clippy --fix --allow-dirty --allow-no-vcs`); measured results:

```text
--- before ---
fn check_empty(s: &String) -> bool { s.len() == 0 }
fn clone_on_copy(x: i32) -> i32 { x.clone() }
--- after ---
fn check_empty(s: &String) -> bool { s.is_empty() }
fn clone_on_copy(x: i32) -> i32 { x }
```

`ptr_arg` involves changes to function signatures, so `--fix` will not auto-fix it (it could break callers); manual confirmation is required.

## Notes and common pitfalls

- **`cargo build` does not run clippy**: clippy lints only take effect under `cargo clippy`; do not assume that a successful build means everything is fine;
- **Be cautious with whole-group deny**: `#![deny(clippy::pedantic)]` turns all pedantic lints into hard errors, and false positives will also block compilation. Prefer `#![warn(clippy::pedantic)]` combined with `cargo clippy -- -D warnings` for tiered control;
- **Lint names should follow `cargo clippy` output**: lint names change with versions (renamed, moved between groups). Do not write them from memory. All lint names on this page are based on clippy 0.1.99 measured output.

## References

- Official docs: Clippy official lint list: <https://rust-lang.github.io/rust-clippy/master/>

## Related pages

- [rustfmt and Code Style](./rustfmt-style) — formatting and linting are two complementary checks.
- [Everyday cargo Workflows](./cargo-workflow) — `cargo clippy` is a cargo subcommand.
- [rust-analyzer and Editors](./rust-analyzer-editor) — editors display clippy suggestions inline.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
