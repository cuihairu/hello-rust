# workspace 与多 crate 工程

当一个项目超过一个 crate，就该用 workspace 把它们组织在一起：共享一份 `Cargo.lock`、共享一个 `target/` 目录、共享统一的依赖版本。workspace 不是宏、不是插件，只是根目录 `Cargo.toml` 里的一个 `[workspace]` 表。

## 最小 workspace 的结构

根 `Cargo.toml` 只有 `[workspace]`，没有 `[package]`；每个成员 crate 有自己的 `Cargo.toml` 和 `src/`。

```toml
# 根 Cargo.toml
[workspace]
members = ["crates/app", "crates/util"]
resolver = "3"

[workspace.package]
version = "0.2.0"
edition = "2024"
license = "MIT"
```

```toml
# crates/app/Cargo.toml
[package]
name = "app"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
util = { workspace = true }
```

在根目录执行 `cargo build`，两个 crate 一起编译；`cargo run -p app` 从根目录直接运行指定成员。真实运行输出：

```text
   Compiling util v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/util)
   Compiling app v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/app)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.00s
```

```text
app: hello, world (via util::greet)
serde json: {"x":3,"y":4}
```

## 继承字段：`version.workspace = true`

`[workspace.package]` 里定义的字段，成员可以用 `字段名.workspace = true` 继承，避免每个 crate 各写一遍。官方列出的可继承字段包括 `version`、`edition`、`license`、`description`、`repository`、`rust-version` 等。

本环境 rustc 1.99.0 / cargo 1.99.0 实测：继承字段完全可用。该特性需要 cargo 1.64+（官方文档标注的 MSRV），本环境远超此门槛。

```bash
# 查看某个成员实际继承后的版本
cargo pkgid -p util
```

真实运行输出：

```text
path+file:///tmp/ecosystem-examples/ws-demo/crates/util#0.2.0
```

## workspace.dependencies：统一依赖声明

把依赖写在根 `[workspace.dependencies]` 里，成员用 `{ workspace = true }` 引用。好处是版本只写一遍、升级只改一处：

```toml
# 根 Cargo.toml
[workspace.dependencies]
serde = "1.0"
util = { path = "crates/util" }
```

```toml
# crates/app/Cargo.toml
[dependencies]
serde = { workspace = true, features = ["derive"] }
util = { workspace = true }
```

注意：`cargo add serde -p app` 默认把依赖写进成员自己的 `[dependencies]`，**不会**自动放进 `[workspace.dependencies]`。本环境 cargo 1.99 的 `cargo add` 也没有 `--workspace` 标志——实测 `cargo add serde --workspace` 报错：

```text
error: unexpected argument '--workspace' found
```

所以要用 `workspace = true` 继承，需要手动把依赖条目从成员移到根的 `[workspace.dependencies]`。

## 路径依赖 vs crates.io 依赖

workspace 内的成员互相依赖用 `path = "..."`（路径依赖）；外部依赖从 crates.io 拉取。`cargo tree` 能一眼区分两者——路径依赖带 `(file://...)` 标注，注册表依赖显示版本号：

真实运行输出：

```text
app v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/app)
├── serde v1.0.229
│   └── serde_core v1.0.229
├── serde_json v1.0.154
└── util v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/util)
```

路径依赖在 workspace 内自动成为成员（官方文档说明），无需在 `members` 里重复列出。但**路径依赖不能直接发布**：`cargo publish` 时要求所有依赖都有版本号，否则报错（详见[发布 crate](./publish-crate)）。发布前需要把 `path = "..."` 补上 `version = "0.2.0"` 的形式。

## 工程实践

- **成员目录扁平化**：官方推荐把所有成员放在 `crates/` 下，`members = ["crates/*"]` 用通配符；
- **共享 lockfile 与 target/**：workspace 根维护唯一 `Cargo.lock` 和 `target/`，避免重复编译；
- **`resolver = "3"`**：edition 2024 对应的 resolver，正确处理 feature 统一与 `default-features` 继承；
- **从成员目录运行 cargo 命令**：cargo 会自动向上查找 workspace 根，在 `crates/app/` 里执行 `cargo run` 也能正常工作。

真实运行输出（在 `crates/app/` 目录执行 `cargo run`）：

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 18.29s
     Running `target/debug/app`
app: hello, world (via util::greet)
serde json: {"x":3,"y":4}
```

## 参考资料

- 官方文档：《The Cargo Book》· Workspaces：<https://doc.rust-lang.org/cargo/reference/workspaces.html>

## 相关页面

- [发布 crate 到 crates.io](./publish-crate)——路径依赖与发布的冲突。
- [工具链](../tooling/)——cargo 与 rustup 的日常用法。
- [语言核心](../language-core/)——crate 与模块系统。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
