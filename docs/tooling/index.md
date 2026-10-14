# 第6部分：工具链

cargo、rustfmt、clippy、rust-analyzer、rustup 与 MSRV 策略——Rust 工程的日常工具面。

- [cargo 常用工作流](cargo-workflow.md) —— new/build/run/test/check、Cargo.toml 与 Cargo.lock、特性开关与依赖树。
- [rustfmt 与代码风格](rustfmt-style.md) —— 默认规则、rustfmt.toml 常见项、CI 里的 `cargo fmt --check`。
- [clippy 与 lint](clippy-lints.md) —— lint 三级、常用 lint 族、clippy.toml 与真实 lint 输出。
- [rust-analyzer 与编辑器](rust-analyzer-editor.md) —— LSP 能力、inlay hints 实测、与 rustfmt/clippy 联动。
- [rustup 与 MSRV](rustup-msrv.md) —— 三通道切换、组件管理、`rust-version` 字段与 edition 2024 差异。
- [交叉编译实战](cross-compilation-practice.md) —— `rustup target add`、musl 静态链接、`cross` 容器与产物验证。

---

- [生态与工程](../ecosystem/) —— workspace 与发布。
- [宏](../macros/) —— 宏展开调试。
- [术语表](../glossary) —— 全站核心术语的中英对照与权威出处。
- [知识点整理](../knowledge) —— 全站复习主线。
