# Ecosystem & Engineering

Turning Rust code into shippable engineering artifacts: multi-crate organization, publishing to crates.io, C interop, bare-metal embedded and WebAssembly.

- Workspaces and Multi-Crate Projects — use `[workspace]` to organise several crates: a shared lockfile, uniform versions, inherited dependencies.
- Publishing a Crate to crates.io — metadata fields, semver policy (how breaking-change semantics differ between 0.x and 1.x), the `cargo publish --dry-run` checklist.
- FFI and C Interop — `extern "C"`, `#[no_mangle]`, `#[repr(C)]` and the symmetric free pattern at the memory-ownership boundary.
- Embedded Rust — what is left after `#![no_std]`, `#[no_main]` and the entry point, a minimal `alloc`, where HAL and Embassy / RTIC fit.
- WebAssembly — the `wasm32-unknown-unknown` target, `wasm-bindgen` and talking to JS, `wasm-pack` for building an npm package.

---

- [Toolchain](../tooling/) — everyday cargo and rustup usage.
- [Comparing with Other Languages](../comparison/) — FFI and C, difference by difference.
- [Glossary](../glossary) — Chinese–English pairs and authoritative sources for every core term on the site.
- [Home](../) — navigation for the whole site.
