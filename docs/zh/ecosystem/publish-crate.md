# 发布 crate 到 crates.io

把 crate 发布到 crates.io 是 Rust 生态的核心交付动作。发布不可逆——版本一旦上传就不能覆盖或删除——所以 `cargo publish --dry-run` 是发布前最重要的验证手段。

## 元数据字段

`[package]` 里的元数据字段决定了 crate 在 crates.io 上的展示与可发现性。官方文档列出的关键字段：

| 字段 | 作用 |
|------|------|
| `description` | crate 描述，显示在 crates.io 列表页 |
| `license` 或 `license-file` | 许可证，crates.io 据此分类 |
| `documentation` | 文档 URL，默认指向 docs.rs |
| `repository` | 源码仓库 URL |
| `keywords` / `categories` | 搜索与分类标签 |
| `readme` | README 文件，显示在 crate 主页 |

一个最小可发布的 `Cargo.toml`：

```toml
[package]
name = "pub-demo"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "演示 cargo publish 元数据校验的最小 crate"
license = "MIT"
documentation = "https://docs.rs/pub-demo"
repository = "https://example.com/pub-demo"
keywords = ["demo", "publish"]
categories = ["development-tools"]
```

## semver 策略：0.x 与 1.x 的破坏性变更语义

semver 规则在 0.x 和 1.x 之间有本质差异：

- **1.x**：`major.minor.patch` 中，minor 位变化（1.0 → 1.1）是兼容的，major 位变化（1.0 → 2.0）才是破坏性变更；
- **0.x**：minor 位变化（0.1 → 0.2）就是破坏性变更，只有 patch 位变化（0.1.0 → 0.1.5）才兼容。

这意味着 0.x 阶段的 crate 可以把 API 大改放在 0.2、0.3 里而不违反 semver 承诺；但一旦发布 1.0，就必须严格遵守兼容性规则。官方建议：在破坏性变更前用 `#[deprecated]` 标记旧 API，给下游迁移窗口。

### yanked vs deprecated

- **yanked（撤回）**：作者或注册中心把某个版本从解析中移除。新项目的 `cargo update` 不会选中 yanked 版本，但已有 `Cargo.lock` 锁定的项目仍能构建——yanked 不是删除。注册中心索引中 `yanked` 是布尔字段，是唯一可变的条目。
- **deprecated（弃用）**：仅是警告性元数据，不影响版本解析，crate 仍可被正常依赖。

简言之：yanked 是硬撤回（影响解析），deprecated 是软警告（不影响解析）。

## cargo publish --dry-run 实测

`cargo publish` 执行五个步骤，`--dry-run` 完成前三个：

1. 对包执行验证检查；
2. 把源码压缩成 `.crate` 文件；
3. 解压到临时目录并验证能编译；
4. 上传到 crates.io（dry-run 跳过）；
5. 注册中心执行额外检查（dry-run 跳过）。

本环境实测（rustc 1.99.0 / cargo 1.99.0，已 `git init` 并提交）：

真实运行输出：

```text
   Packaging pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
    Packaged 6 files, 1.9KiB (1.2KiB compressed)
   Verifying pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
   Compiling pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo/target/package/pub-demo-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.10s
   Uploading pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
warning: aborting upload due to dry run
```

`cargo package --list` 可以查看将要打包的文件清单：

真实运行输出：

```text
.cargo_vcs_info.json
.gitignore
Cargo.lock
Cargo.toml
Cargo.toml.orig
src/lib.rs
```

注意 `Cargo.toml.orig` 是原始清单的备份，`Cargo.toml` 是 cargo 自动规范化后的版本（重排字段、展开 `path` 依赖为注册表依赖）。

## dry-run 输出里的检查清单

`--dry-run` 会在打包和验证阶段暴露以下问题，发布前应逐项确认：

**1. 缺少元数据警告**（不阻断但强烈建议修复）：

真实运行输出（无 `description`/`license` 等字段的 crate）：

```text
warning: manifest has no description, license, license-file, documentation, homepage or repository
  |
  = note: see https://doc.rust-lang.org/cargo/reference/manifest.html#package-metadata for more info
```

**2. 未提交的改动**（dry-run 默认拒绝打包脏工作区）：

真实运行输出：

```text
error: 2 files in the working directory contain changes that were not yet committed into git:

Cargo.toml
src/lib.rs

to proceed despite this and include the uncommitted changes, pass the `--allow-dirty` flag
```

**3. 路径依赖缺少版本号**（发布阻断错误）：

真实运行输出（依赖写成 `foo = { path = "../foo" }` 而无 `version`）：

```text
error: failed to verify manifest at `/tmp/ecosystem-examples/pub-path/Cargo.toml`

Caused by:
  all dependencies must have a version requirement specified when publishing.
```

修复：给路径依赖补上 `version = "0.1.0"`，发布时 cargo 会自动把 `path` 信息替换为注册表版本。

**4. 编译验证**：dry-run 会把打包后的代码解压到 `target/package/` 重新编译一次，确保发布产物本身能构建。

## 工程实践

- **发布前跑 `cargo publish --dry-run`**：验证元数据、打包内容、编译通过；
- **用 `cargo package --list` 检查打包内容**：确认没有意外包含大文件或敏感文件，用 `exclude` / `include` 控制；
- **版本号遵循 semver**：0.x 阶段 minor 位可破坏，1.x 阶段必须严格兼容；
- **发布后打 git tag**：官方建议每个发布版本对应一个 tag，配合 `cargo-release` 等工具自动化；
- **`.crate` 文件上限 10MB**：打包前检查体积。

## 参考资料

- 官方文档：《The Cargo Book》· Publishing on crates.io：<https://doc.rust-lang.org/cargo/reference/publishing.html>

## 相关页面

- [workspace 与多 crate 工程](./workspace)——路径依赖在 workspace 内自动成为成员。
- [工具链](../tooling/)——cargo 常用工作流。
- [语言核心](../language-core/)——crate 与模块系统。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
