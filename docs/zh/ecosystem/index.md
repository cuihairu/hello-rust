# 生态与工程

把 Rust 代码变成可交付的工程产物：多 crate 组织、crates.io 发布、C 互操作、嵌入式裸机与 WebAssembly。

- [workspace 与多 crate 工程](./workspace.md) —— 用 `[workspace]` 统一组织多个 crate：共享 lockfile、统一版本、继承依赖。
- [发布 crate 到 crates.io](./publish-crate.md) —— 元数据字段、semver 策略（0.x 与 1.x 的破坏性变更差异）、`cargo publish --dry-run` 的检查清单。
- [FFI 与 C 互操作](./ffi-c-interop.md) —— `extern "C"`、`#[no_mangle]`、`#[repr(C)]` 与内存所有权边界的对称释放模式。
- [嵌入式 Rust](./embedded-nostd.md) —— `#![no_std]` 之后还剩什么、`#[no_main]` 与入口、最小 `alloc`、HAL 与 Embassy / RTIC 的定位。
- [WebAssembly](./wasm.md) —— `wasm32-unknown-unknown` 目标、`wasm-bindgen` 与 JS 交互、`wasm-pack` 构建 npm 包。

---

- [工具链](../tooling/) —— cargo 与 rustup 的日常用法。
- [语言对照](../comparison/) —— FFI 与 C 的逐项差异。
- [术语表](../glossary) —— 全站核心术语的中英对照与权威出处。
- [首页](../) —— 全站导航。
