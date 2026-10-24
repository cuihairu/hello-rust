# Declarative Macros `macro_rules!`

**Declarative macros** are defined with `macro_rules!` and are essentially "pattern matching + template replacement": the compiler matches the token sequence at each macro call site against the rules one by one, and upon a match generates code according to the template. They do not operate on the AST, only on tokens, so they can express code generation of any "syntactic shape".

## Matcher syntax: `$name:fragment`

A matcher consists of literal tokens, metavariables `$name:fragment`, and repetitions `$(...)`. `fragment` specifies which kind of Rust syntactic fragment the metavariable matches. Common ones:

| fragment | Meaning |
|---|---|
| `ident` | An identifier or keyword |
| `expr` | An expression |
| `ty` | A type |
| `pat` | A pattern (includes top-level or-patterns as of 2021) |
| `stmt` | A statement (**excluding** the trailing semicolon; writing `let y = 3;` reports `no rules expected ';'`) |
| `block` | A block expression |
| `literal` | A literal |
| `meta` | Attribute content |
| `tt` | A single TokenTree |

Demonstrating the matching behavior of each fragment with a set of single-arm macros (rustc 1.99.0, `--edition 2021`):

```rust
macro_rules! f_ident { ($i:ident) => { println!("ident = {}", stringify!($i)); }; }
macro_rules! f_ty    { ($t:ty)    => { println!("ty    = {}", stringify!($t)); }; }
macro_rules! f_pat   { ($p:pat)   => { println!("pat   = {}", stringify!($p)); }; }
macro_rules! f_stmt  { ($s:stmt)  => { println!("stmt  = {}", stringify!($s)); }; }
macro_rules! f_block { ($b:block) => { println!("block = {}", stringify!($b)); }; }
fn main() {
    f_ident!(x);
    f_ty!(i32);
    f_pat!(Some(1));
    f_stmt!(let y = 3);
    f_block!({ let a = 1; a + 1 });
}
```

Actual run output:

```text
ident = x
ty    = i32
pat   = Some(1)
stmt  = let y = 3
block = { let a = 1; a + 1 }
```

### Arm order and "hard parse errors"

Multi-arm macros try arms in order, and **the first arm that successfully matches wins**. But a key detail: if an arm encounters a **syntax error** (rather than a "no match") while parsing a metavariable, the compiler aborts the entire macro call immediately and does not try subsequent arms. For example, putting the `ty` arm before the `pat` arm and calling `demo!(Some(1))` yields:

```text
error: expected type, found `1`
 --> demo_order.rs:5:24
  |
2 |     ($t:ty)  => { println!("ty  = {}", stringify!($t)); };
  |      ----- while parsing argument for this `ty` macro fragment
...
5 | fn main() { demo!(Some(1)); }
  |                        ^ expected type
```

`Some(1)` is not a valid type; the `ty` arm fails to parse and produces a hard error, and the `pat` arm never gets a chance to be tried. **Conclusion: put fragments that are prone to parse failure later, or just use single-arm macros.** Also, `expr` is the most permissive fragment and can swallow nearly any expression tokens — in a multi-arm macro, if the `expr` arm comes first, the later `ty` / `meta` / `block` arms will never be reached; measured with `demo!(i32)`, `demo!(42)`, and `demo!(derive(Debug))`, all were intercepted by the `expr` arm.

## Repetition: `$(...)`, separators, and `*` `+` `?`

`$(...)` marks a matcher as repeatable, followed by a repetition marker: `*` (any number of times, including zero), `+` (at least one time), and `?` (zero or one time, **cannot take a separator**). A separator can be any token except delimiters and `*` / `+` / `?`; the most common are `,` and `;`. Nested repetitions are allowed.

```rust
macro_rules! vec3 {
    ($($x:expr),+) => {{
        let v: Vec<i32> = vec![$($x),+];
        println!("$(...),+ => {:?} (len={})", v, v.len());
        v
    }};
    ($($x:expr),* $(,)?) => {{
        let items: Vec<i32> = vec![$($x),*];
        println!("$(...)*  => {:?} (len={})", items, items.len());
        items
    }};
}
fn main() {
    let a = vec3!(1, 2, 3);
    let b = vec3!(42);
    let _ = (a, b);
    let c = vec3!(7, 8, 9,);
    let d = vec3!();
    let _ = (c, d);
}
```

Actual run output:

```text
$(...),+ => [1, 2, 3] (len=3)
$(...),+ => [42] (len=1)
$(...)*  => [7, 8, 9] (len=3)
$(...)*  => [] (len=0)
```

A few real limitations encountered: **a bare `,?` is illegal** — `?` can only modify a `$(...)` repetition group, and an "optional comma" must be written as `$(,)?`; **an `expr` can only be followed by `=>`, `,`, or `;`** — `($x:expr $(,)? $y:expr)` reports `` `$x:expr` may be followed by `$y:expr`, which is not allowed for `expr` fragments ``; **repetitions in the transcriber must match the matcher** — the number of occurrences, kinds, and nesting order of metavariables in the transcriber must match the matcher exactly, or else it is a compilation error.

## Hygiene and `$crate`

`macro_rules!` uses **mixed-site hygiene**: **local variables** and **labels** introduced by macro expansion are resolved at the macro definition site, while other symbols (function names, type names, etc.) are resolved at the call site. This means names like `tmp` introduced inside a macro will not conflict with same-named variables in the caller.

```rust
macro_rules! swap {
    ($a:ident, $b:ident) => {{
        let tmp = $a;   // 这个 tmp 有独立的语法上下文
        $a = $b;
        $b = tmp;
    }};
}
macro_rules! use_helper {
    ($x:expr) => { $crate::helper::double($x) };
}
mod helper {
    pub fn double(x: i32) -> i32 { x * 2 }
}
fn main() {
    let mut a = 1; let mut b = 2; let tmp = 100;
    swap!(a, b);
    println!("a={} b={} tmp={}", a, b, tmp);
    println!("use_helper!(5) = {}", use_helper!(5));
}
```

Actual run output:

```text
a=2 b=1 tmp=100
use_helper!(5) = 10
```

The `tmp` inside `swap!` shares the same name as the caller's `tmp = 100` but they do not affect each other — this is hygiene in action. `$crate` is a special metavariable that always points to **the crate that defined the macro**, used to refer to items internal to the defining crate from the expanded code. Note that `$crate` only affects name resolution, **not visibility** — the referenced item must still be visible from the call site.

## A `query!` DSL macro example

Compiling a SQL-like DSL into a `Query` struct is a typical use of declarative macros. This macro combines the use of `ident` fragments (column and table names), `$(...),+` repetition (multiple columns, multiple conditions), `stringify!` to convert identifiers into string literals, and the ordered matching of two arms (the arm without a WHERE clause comes first):

```rust
#![allow(dead_code)]
#[derive(Debug)]
struct Query { table: &'static str, columns: Vec<&'static str>, filters: Vec<String> }
macro_rules! query {
    (SELECT $($col:ident),+ FROM $table:ident) => {{
        let mut q = Query { table: stringify!($table), columns: vec![], filters: vec![] };
        q.columns = vec![$(stringify!($col)),+];
        q
    }};
    (SELECT $($col:ident),+ FROM $table:ident WHERE $($field:ident = $val:expr),+) => {{
        let mut q = Query { table: stringify!($table), columns: vec![], filters: vec![] };
        q.columns = vec![$(stringify!($col)),+];
        q.filters = vec![$(format!("{} = {}", stringify!($field), $val)),+];
        q
    }};
}
fn main() {
    let q1 = query!(SELECT id, name FROM users);
    println!("q1 = {:?}", q1);
    let q2 = query!(SELECT id, name, age FROM users WHERE age = 18);
    println!("q2 = {:?}", q2);
    let q3 = query!(SELECT id FROM orders WHERE user_id = 42, status = "paid");
    println!("q3 = {:?}", q3);
}
```

Actual run output:

```text
q1 = Query { table: "users", columns: ["id", "name"], filters: [] }
q2 = Query { table: "users", columns: ["id", "name", "age"], filters: ["age = 18"] }
q3 = Query { table: "orders", columns: ["id"], filters: ["user_id = 42", "status = paid"] }
```

## Macro expansion output

Using nightly's `rustc -Zunpretty=expanded` you can see the actual expansion (`cargo expand` is the equivalent tool, requiring `cargo install cargo-expand`). Note that `expr` fragments get **parenthesized** upon expansion — when `$x * $x` replaces `$x` with `3 + 4`, it becomes `(3 + 4) * (3 + 4)`, avoiding operator precedence errors:

```rust
macro_rules! sq { ($x:expr) => { $x * $x }; }
fn main() { let n = sq!(3 + 4); }
```

Actual run output (`rustc +nightly --edition 2021 -Zunpretty=expanded`):

```text
fn main() {
    let n = (3 + 4) * (3 + 4);
    { ::std::io::_print(format_args!("{0}\n", n)); };
}
```

## References

- Official docs: "The Rust Reference" · Macros by example: <https://doc.rust-lang.org/reference/macros-by-example.html>

## Related pages

- [Traits and Implementations](../language-core/traits) — `derive` is a special case of a macro generating an `impl`.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
- [Project Notes Index](../knowledge) — an index of key points across the site.
