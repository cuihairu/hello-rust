# rustfmt and Code Style

rustfmt is Rust's official code formatter, distributed alongside rustup. It removes "what should the code look like" from team debate — everyone runs the same command and gets the same output. Version measured in this environment: `rustfmt 1.10.0-stable (b940084d7e 2026-09-28)`.

## Default rules

rustfmt's default configuration works without any configuration file. The core defaults (actual output of `rustfmt --print-config default`):

```text
max_width = 100
hard_tabs = false
tab_spaces = 4
newline_style = "Auto"
use_small_heuristics = "Default"
fn_call_width = 60
attr_fn_like_width = 70
struct_lit_width = 18
chain_width = 60
reorder_imports = true
reorder_modules = true
```

That is: 4-space indentation, a 100-column line width limit, automatic wrapping, and imports reordered alphabetically. Running `cargo fmt --check` on some badly formatted code:

```rust
use std::collections::HashMap;
fn main(){
let mut m:HashMap<String,i32>=HashMap::new();
m.insert("a".to_string(),1);
let x=1+2*3;
if x>5{println!("big");}
}
```

Actual run output:

```text
--- rustfmt --check ---
Diff in /tmp/tooling-examples/fmt-demo/src/main.rs:1:
 use std::collections::HashMap;
-fn main(){
-let mut m:HashMap<String,i32>=HashMap::new();
-m.insert("a".to_string(),1);
-let x=1+2*3;
-if x>5{println!("big");}
+fn main() {
+    let mut m: HashMap<String, i32> = HashMap::new();
+    m.insert("a".to_string(), 1);
+    let x = 1 + 2 * 3;
+    if x > 5 {
+        println!("big");
+    }
 }

=== EXIT: 1 ===
```

`--check` does not modify files; it only prints the diff and exits with code 1 to indicate "formatting needed" — this is exactly how it is used in CI. `cargo fmt` (without `--check`) rewrites the files in place.

## Common rustfmt.toml configuration options

Placing a `rustfmt.toml` in the crate root directory overrides the defaults. Common options:

```toml
edition = "2024"
max_width = 80
```

- `edition`: tells rustfmt which edition's syntax to parse (affects formatting behavior);
- `max_width`: line width limit, default 100;
- `tab_spaces`: indentation width, default 4;
- `hard_tabs`: use tab indentation, default false;
- `imports_granularity`: import merging granularity (nightly-only);
- `group_imports`: import grouping order (nightly-only).

Measuring `max_width = 80` in effect:

```bash
cargo fmt
```

Actual run output:

```text
--- cargo fmt (applies) ---
=== EXIT: 0 ===
fn main() {
    let long_function_name = some_function_with_a_long_name(
        argument_one,
        argument_two,
        argument_three,
    );
}
```

Function calls exceeding 80 columns are automatically wrapped.

## nightly-only configuration options

`imports_granularity` and `group_imports` are nightly-only options. Setting them on stable causes rustfmt to print a warning and ignore them:

```toml
edition = "2024"
max_width = 80
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
```

Actual run output:

```text
--- stable rustfmt with nightly-only opts ---
Warning: can't set `imports_granularity = Crate`, unstable features are only available in nightly channel.
Warning: can't set `group_imports = StdExternalCrate`, unstable features are only available in nightly channel.
Diff in /tmp/tooling-examples/fmt-demo/src/main.rs:1:
 use std::collections::HashMap;
 use std::fmt::Display;
-fn main(){}
+fn main() {}

=== EXIT: 1 ===
```

The warning explicitly states "unstable features are only available in nightly channel". To use these options, you need `rustup run nightly cargo fmt` or `cargo +nightly fmt`. Writing these configuration options on stable does not produce an error — they silently take no effect. When debugging "why did my config not take effect", first check whether this warning appeared.

## cargo fmt --check in CI

The standard way to check formatting in CI:

```bash
cargo fmt --check
```

Actual run output (when the code is already formatted):

```text
--- cargo fmt --check after format ---
=== EXIT: 0 ===
--- cargo fmt -- --check ---
=== EXIT: 0 ===
```

`cargo fmt --check` and `cargo fmt -- --check` are equivalent; the latter passes `--check` through to the rustfmt binary. An exit code of 0 means everything is compliant; non-zero means there are differences. Adding this step to CI ensures all merged code has been formatted.

## Engineering practice

- **Locally**: `cargo fmt` for one-click formatting; `cargo fmt --check` for a self-check before committing;
- **CI**: `cargo fmt --check` as a standalone step, blocking merges on failure;
- **Configuration**: the team shares a single `rustfmt.toml` committed to the repository, avoiding inconsistent local configurations;
- **nightly options**: when `imports_granularity` or similar options are truly needed, use `cargo +nightly fmt` in both CI and locally, and note this in the README.

## References

- Official docs: Rustfmt official documentation: <https://rust-lang.github.io/rustfmt/>

## Related pages

- [Everyday cargo Workflows](./cargo-workflow) — `cargo fmt` is a cargo subcommand.
- [clippy and Lints](./clippy-lints) — the next layer of static checking after formatting.
- [rust-analyzer and Editors](./rust-analyzer-editor) — editors invoke rustfmt automatically on save.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
