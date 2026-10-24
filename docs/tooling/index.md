# Toolchain

cargo, rustfmt, clippy, rust-analyzer, rustup and MSRV policy — the everyday tool surface of Rust engineering.

- [Everyday cargo Workflows](cargo-workflow.md) — new/build/run/test/check, Cargo.toml and Cargo.lock, feature flags and the dependency tree.
- [rustfmt and Code Style](rustfmt-style.md) — default rules, common rustfmt.toml keys, `cargo fmt --check` in CI.
- [clippy and Lints](clippy-lints.md) — the three lint levels, common lint families, clippy.toml and real lint output.
- [rust-analyzer and Editors](rust-analyzer-editor.md) — LSP features, measured inlay hints, integration with rustfmt/clippy.
- [rustup and MSRV](rustup-msrv.md) — switching channels, managing components, the `rust-version` field and edition 2024 differences.
- [Cross-Compilation: Local Commands and Artifact Records](cross-compilation-practice.md) — `rustup target add`, musl static linking, `cross` containers and verifying the artifacts.

---

- [Ecosystem & Engineering](../ecosystem/) — workspace and publishing.
- [Macros](../macros/) — debugging macro expansion.
- [Glossary](../glossary) — Chinese–English pairs and authoritative sources for every core term on the site.
- [Notes Index](../knowledge) — index of key points across the site.
