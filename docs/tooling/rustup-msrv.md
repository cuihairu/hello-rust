# rustup and MSRV

rustup is Rust's toolchain manager, responsible for installing, switching, and updating toolchains and components across the stable / beta / nightly channels. Version measured in this environment: `rustup 1.29.1 (d95a37b6a 2026-08-13)`, installed toolchains: stable (default), nightly, 1.88.0, 1.96.0, 1.97.0, 1.98.1, 1.99.0.

## The three channels and switching

- **stable**: released every six weeks, the default choice for production environments;
- **beta**: a prerelease of the next stable, for early compatibility validation;
- **nightly**: built daily, providing unstable features (such as `-Z` flags and some rustfmt options).

```bash
rustup default
rustup toolchain list
rustup show
```

Actual run output:

```text
stable-x86_64-unknown-linux-gnu (default)
---
stable-x86_64-unknown-linux-gnu (active, default)
nightly-x86_64-unknown-linux-gnu
1.88.0-x86_64-unknown-linux-gnu
1.96.0-x86_64-unknown-linux-gnu
1.97.0-x86_64-unknown-linux-gnu
1.98.1-x86_64-unknown-linux-gnu
1.99.0-x86_64-unknown-linux-gnu
---
Default host: x86_64-unknown-linux-gnu
rustup home:  /home/cui/.rustup

installed toolchains
--------------------
stable-x86_64-unknown-linux-gnu (active, default)
nightly-x86_64-unknown-linux-gnu
1.88.0-x86_64-unknown-linux-gnu
1.96.0-x86_64-unknown-linux-gnu
1.97.0-x86_64-unknown-linux-gnu
1.98.1-x86_64-unknown-linux-gnu
1.99.0-x86_64-unknown-linux-gnu

active toolchain
----------------
name: stable-x86_64-unknown-linux-gnu
active because: it's the default toolchain
```

`rustup default <toolchain>` switches the default toolchain; `rustup run <toolchain> <cmd>` temporarily runs a command with the specified toolchain without changing the default; `rustup show` displays the currently active toolchain and installed targets.

## Component management

A toolchain is composed of components: `rustc`, `cargo`, `rustfmt`, `clippy`, `rust-analyzer`, `rust-src`, and more. Install with `rustup component add`, and check installed components with `rustup component list --installed`:

```bash
rustup component list --installed
```

Actual run output (excerpt):

```text
cargo-x86_64-unknown-linux-gnu
clippy-x86_64-unknown-linux-gnu
llvm-tools-x86_64-unknown-linux-gnu
rust-analyzer-x86_64-unknown-linux-gnu
rust-src
rust-std-aarch64-unknown-linux-gnu
rust-std-x86_64-unknown-linux-gnu
rust-std-x86_64-unknown-linux-musl
rustfmt-x86_64-unknown-linux-gnu
```

`rust-std-*` is the standard library for each target; installing one target enables cross-compilation to it. `rust-src` lets rust-analyzer jump to standard library source code.

## MSRV: the rust-version field

MSRV (Minimum Supported Rust Version) is the lowest supported Rust version a crate declares, written in the `rust-version` field of `Cargo.toml`:

```toml
[package]
name = "msrv-demo"
version = "0.1.0"
edition = "2021"
rust-version = "1.85"
```

Measured: building a crate with `rust-version = "1.90"` using the 1.88.0 toolchain fails outright:

```text
--- rustup run 1.88.0 cargo build (1.88 < 1.90) ---
error: rustc 1.88.0 is not supported by the following package:
  msrv-demo@0.1.0 requires rustc 1.90

=== EXIT: 101 ===
```

Whereas building with stable (1.99.0) succeeds. `rust-version` is a hard check in cargo — when the toolchain is below that version, the build errors out directly rather than silently passing.

The relationship between `edition` and `rust-version`: edition determines the language feature set (2021 / 2024), while `rust-version` determines the minimum compiler version. The two are independent — a crate on edition 2024 can declare `rust-version = "1.85"` (edition 2024 was stabilized with Rust 1.85).

## MSRV strategy in practice

- **Declare `rust-version`**: so cargo gives a clear error when the toolchain does not meet the requirement, instead of leaving the user to face obscure compilation errors;
- **CI matrix testing**: run both the MSRV and stable toolchains in CI to ensure the declaration is trustworthy;
- **Manage the MSRV of dependencies too**: `cargo update -Z minimal-versions` (nightly) resolves dependencies to the lowest compatible versions, verifying whether the MSRV declaration is broken by dependencies:

```text
--- nightly cargo update -Z minimal-versions ---
     Locking 0 packages to lowest compatible versions
=== EXIT: 0 ===
--- stable cargo update -Z minimal-versions (should fail) ---
error: the `-Z` flag is only accepted on the nightly channel of Cargo, but this is the `stable` channel
See https://doc.rust-lang.org/book/appendix-07-nightly-rust.html for more information about Rust release channels.
=== EXIT: 101 ===
```

The `-Z` flag is only available on nightly. Another approach is to use cargo-deny's `msrv` policy to check the MSRV compatibility of the dependency tree.

## Key differences between edition 2021 and 2024

Edition 2024 was stabilized with Rust 1.85. The main changes (verified by measurement, marked with a check mark):

- **`static_mut_refs` becomes a hard error**: taking a direct reference to a `static mut` is a warning in 2021 but an error in 2024:

```text
--- edition 2021 ---
warning: `msrv-demo` (bin "msrv-demo") generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.11s
=== EXIT: 0 ===
--- edition 2024 ---
  = note: `#[deny(static_mut_refs)]` (part of `#[deny(rust_2024_compatibility)]`) on by default
error: could not compile `msrv-demo` (bin "msrv-demo") due to 1 previous error
=== EXIT: 101 ===
```

- **`unsafe extern` blocks**: `extern` blocks must be written as `unsafe extern` (measured to compile successfully under 2024);
- **`unsafe_op_in_unsafe_fn`**: unsafe operations inside `unsafe fn` require an explicit `unsafe {}` block; the default is warn under 2024;
- **`gen` keyword reserved**: `gen` blocks remain an experimental feature in 1.99 (`error[E0658]: gen blocks are experimental`);
- **RPIT lifetime capture**: `impl Trait` return types capture all in-scope lifetimes by default;
- **`std::env::set_var` / `remove_var` become `unsafe`**;
- **MSRV-aware resolver (resolver v3)**: Cargo prefers compatible dependency versions based on `rust-version`.

Use `cargo fix --edition` for migration to handle most of the mechanical changes automatically.

## References

- Official docs: "The rustup book": <https://rust-lang.github.io/rustup/>

## Related pages

- [Everyday cargo Workflows](./cargo-workflow) — `Cargo.toml` and `Cargo.lock`.
- [rust-analyzer and Editors](./rust-analyzer-editor) — rust-analyzer installed as a rustup component.
- [Cross-Compilation: Local Commands and Artifact Records](./cross-compilation-practice) — `rustup target add` installs targets.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
