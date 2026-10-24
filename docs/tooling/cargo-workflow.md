# Everyday cargo Workflows

cargo is Rust's package manager and build tool: dependency resolution, compilation, testing, documentation, and publishing are all handled by a single command. Day-to-day development only uses five subcommands — `new`, `build`, `run`, `test`, `check` — plus two files, `Cargo.toml` and `Cargo.lock`.

## The five core subcommands

`cargo new` generates a crate skeleton, `cargo build` compiles, `cargo run` compiles and runs, `cargo test` runs tests, and `cargo check` performs type checking only without producing a binary (much faster than build).

```bash
cd /tmp/tooling-examples
cargo new workflow-demo
cargo new --lib lib-demo
```

Actual run output:

```text
    Creating binary (application) `workflow-demo` package
note: see more `Cargo.toml` keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
    Creating library `lib-demo` package
note: see more `Cargo.toml` keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html
```

`cargo new` generates a binary crate (`src/main.rs`) by default; adding `--lib` generates a library crate (`src/lib.rs`). The default edition is 2024 (measured on cargo 1.99.0).

```bash
cd /tmp/tooling-examples/workflow-demo
cargo build
cargo run
cargo test
cargo check
```

Actual run output (the four commands run in sequence, blank lines compressed):

```text
   Compiling workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.16s
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.01s
     Running `target/debug/workflow-demo`
Hello, world!
   Compiling workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `test` profile [unoptimized + debuginfo] target(s) in 0.13s
     Running unittests src/main.rs (target/debug/deps/workflow_demo-6238b68263f48a0b)
running 0 tests
test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.00s
    Checking workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.04s
```

`cargo check` prints `Checking` rather than `Compiling` — it does not produce object files and only performs borrow checking and type checking, making it the fastest compilation feedback outside of an IDE. `cargo test` compiles before running; a new crate has no tests by default and prints `running 0 tests`.

## Cargo.toml structure

`Cargo.toml` is the crate's manifest file. Its minimal structure has only three sections: `[package]` (name, version, edition), `[dependencies]` (dependencies), and optionally `[features]` (feature toggles).

```toml
[package]
name = "workflow-demo"
version = "0.1.0"
edition = "2024"

[dependencies]
```

`name` determines the crate's identifier on crates.io, `version` follows semantic versioning, and `edition` determines the language feature set (2015 / 2018 / 2021 / 2024). Direct dependencies are listed under `[dependencies]`, with support for shorthand (`"serde"`) and expanded (`{ version = "1", features = ["derive"] }`) syntax.

## Feature toggles and optional dependencies

A feature is a compile-time switch exposed by a crate, used to enable optional functionality on demand. An optional dependency automatically creates a feature with the same name. Here is a minimal example, measured:

```toml
[package]
name = "workflow-demo"
version = "0.1.0"
edition = "2024"

[features]
json = ["dep:serde"]

[dependencies]
serde = { version = "1", optional = true }
```

```rust
fn main() {
    #[cfg(feature = "json")]
    println!("json feature on: {}", serde_json_value());
    #[cfg(not(feature = "json"))]
    println!("json feature off");
}

#[cfg(feature = "json")]
fn serde_json_value() -> i32 { 42 }
```

Actual run output:

```text
--- build without feature ---
   Compiling workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.10s
     Running `target/debug/workflow-demo`
json feature off
--- build with feature ---
   Compiling serde_core v1.0.229 / serde v1.0.229
   Compiling workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 3.56s
     Running `target/debug/workflow-demo`
json feature on: 42
```

Without the feature, serde does not participate in compilation at all; only after enabling it is serde fetched and compiled. `dep:serde` is the explicit reference syntax for optional dependencies (Rust 1.60+), which turns an optional dependency into a feature without implicitly creating a same-named feature.

`cargo tree` gives a clear view of the dependency graph. Without the feature (actual run output):

```text
workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
└── serde v1.0.229
    └── serde_core v1.0.229
```

serde 1.0.229 ships with only `serde_core` by default. Now enable the derive feature:

```bash
cargo build --features serde/derive
cargo tree --features serde/derive
```

Actual run output (build log compressed, full tree preserved):

```text
 Downloading crates ...
  Downloaded unicode-ident v1.0.27
  Downloaded syn v3.0.9
   Compiling proc-macro2 v1.0.107 / quote v1.0.47 / unicode-ident v1.0.27
   Compiling serde v1.0.229 / syn v3.0.9 / serde_derive v1.0.229
   Compiling workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 11.23s
workflow-demo v0.1.0 (/tmp/tooling-examples/workflow-demo)
└── serde v1.0.229
    ├── serde_core v1.0.229
    └── serde_derive v1.0.229 (proc-macro)
        ├── proc-macro2 v1.0.107
        │   └── unicode-ident v1.0.27
        ├── quote v1.0.47
        │   └── proc-macro2 v1.0.107 (*)
        └── syn v3.0.9
            ├── proc-macro2 v1.0.107 (*)
            ├── quote v1.0.47 (*)
            └── unicode-ident v1.0.27
```

`serde/derive` pulls in `serde_derive` (a procedural macro crate) and its dependencies `proc-macro2`, `quote`, and `syn`. `(*)` indicates that the dependency has been deduplicated. `cargo tree` is the go-to tool for investigating dependency bloat and understanding feature propagation.

## The role of Cargo.lock and commit strategy

`Cargo.lock` is the precise dependency snapshot automatically generated by cargo, locking the version and checksum of every dependency. It is created on the first `cargo build`, then reused by subsequent `cargo build` runs, and only updated when dependencies change.

An actual Cargo.lock excerpt (from the serde project):

```toml
# This file is automatically @generated by Cargo.
# It is not intended for manual editing.
version = 4

[[package]]
name = "serde"
version = "1.0.229"
source = "registry+https://github.com/rust-lang/crates.io-index"
checksum = "4148590afebada386688f18773da617792bf2ef03ffc1e4cbd2b1d45b023e0ba"
dependencies = [
 "serde_core",
]
```

Official commit strategy recommendations (cargo FAQ):

- **Binary / application projects**: commit `Cargo.lock` to guarantee reproducible builds, keeping CI and release artifacts consistent;
- **Library projects**: the current official recommendation is also to commit it (so that CI and documentation builds are reproducible), but when depended upon by downstream crates the lockfile is ignored and does not constrain consumers;
- When in doubt, commit it.

`version = 4` is the current lockfile format (written by default since Cargo 1.83); older versions of cargo cannot parse v4 lockfiles.

## Engineering practice

- **`cargo check` for fast feedback**: `cargo build` for producing artifacts, `cargo run` only for local debugging;
- **Keep dependencies lean**: audit regularly with `cargo tree`, enable features on demand (`default-features = false`, then enable individually);
- **`cargo update -p <crate>`** upgrades a single dependency, avoiding a global `cargo update` that drags in unrelated changes;
- **`cargo tree -e features`** shows the transitive dependency relationships of features — an essential tool for diagnosing "why did compilation get slower".

## References

- Official docs: "The Cargo Book" · Introduction: <https://doc.rust-lang.org/cargo/>

## Related pages

- [rustfmt and Code Style](./rustfmt-style) — formatting and CI checks.
- [clippy and Lints](./clippy-lints) — static checking and lint severity levels.
- [rustup and MSRV](./rustup-msrv) — the `rust-version` field and toolchain management.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
