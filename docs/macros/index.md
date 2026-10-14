# 第5部分：宏

声明式宏 `macro_rules!` 与过程宏——Rust 的元编程：在编译期生成代码。

- [声明式宏 `macro_rules!`](declarative-macros.md) —— 匹配器语法、`$(...)` 重复、卫生性与 `$crate`、`query!` DSL 实战。
- [过程宏](proc-macros.md) —— derive/attribute/function-like 三种形态、`TokenStream`/`Span`、`syn`/`quote` 分工、编译期开销与错误诊断。

---

- [异步](../async/) —— `select!`、`#[tokio::main]` 背后的宏。
- [工具链](../tooling/) —— 宏展开的调试工具。
- [术语表](../glossary) —— 全站核心术语的中英对照与权威出处。
- [知识点整理](../knowledge) —— 全站复习主线。
