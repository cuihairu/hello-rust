# rustup 与 MSRV 策略

rustup 是 Rust 工具链管理器，负责安装、切换、更新 stable / beta / nightly 三通道的工具链与组件。本环境实测版本：`rustup 1.29.1 (d95a37b6a 2026-08-13)`，已装工具链：stable（默认）、nightly、1.88.0、1.96.0、1.97.0、1.98.1、1.99.0。

## 三通道与切换

- **stable**：每六周发布一次，生产环境默认选择；
- **beta**：下一个 stable 的预发布版，提前验证兼容性；
- **nightly**：每日构建，提供 unstable 特性（如 `-Z` 参数、部分 rustfmt 选项）。

```bash
rustup default
rustup toolchain list
rustup show
```

真实运行输出：

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

`rustup default <toolchain>` 切换默认工具链；`rustup run <toolchain> <cmd>` 临时用指定工具链跑命令而不改默认；`rustup show` 显示当前激活的工具链与已装 target。

## 组件管理

工具链由组件（component）组成：`rustc`、`cargo`、`rustfmt`、`clippy`、`rust-analyzer`、`rust-src` 等。`rustup component add` 安装，`rustup component list --installed` 查看已装：

```bash
rustup component list --installed
```

真实运行输出（节选）：

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

`rust-std-*` 是各 target 的标准库，装一个 target 就能交叉编译到它。`rust-src` 让 rust-analyzer 能跳转到标准库源码。

## MSRV：rust-version 字段

MSRV（Minimum Supported Rust Version）是 crate 声明的最低支持 Rust 版本，写在 `Cargo.toml` 的 `rust-version` 字段：

```toml
[package]
name = "msrv-demo"
version = "0.1.0"
edition = "2021"
rust-version = "1.85"
```

实测：用 1.88.0 工具链构建 `rust-version = "1.90"` 的 crate 会直接失败：

```text
--- rustup run 1.88.0 cargo build (1.88 < 1.90) ---
error: rustc 1.88.0 is not supported by the following package:
  msrv-demo@0.1.0 requires rustc 1.90

=== EXIT: 101 ===
```

而用 stable（1.99.0）构建成功。`rust-version` 是 cargo 的硬性检查——工具链低于该版本时构建直接报错，不会静默通过。

`edition` 与 `rust-version` 的关系：edition 决定语言特性集（2021 / 2024），`rust-version` 决定最低编译器版本。两者独立——edition 2024 的 crate 可以声明 `rust-version = "1.85"`（edition 2024 随 Rust 1.85 稳定）。

## MSRV 策略实践

- **声明 `rust-version`**：让 cargo 在工具链不满足时给出清晰错误，而不是让用户面对晦涩的编译错误；
- **CI 矩阵测试**：在 CI 里同时跑 MSRV 和 stable 两个工具链，确保声明可信；
- **依赖的 MSRV 也要管**：`cargo update -Z minimal-versions`（nightly）把依赖解析到最低兼容版本，验证 MSRV 声明是否被依赖破坏：

```text
--- nightly cargo update -Z minimal-versions ---
     Locking 0 packages to lowest compatible versions
=== EXIT: 0 ===
--- stable cargo update -Z minimal-versions (should fail) ---
error: the `-Z` flag is only accepted on the nightly channel of Cargo, but this is the `stable` channel
See https://doc.rust-lang.org/book/appendix-07-nightly-rust.html for more information about Rust release channels.
=== EXIT: 101 ===
```

`-Z` 参数只在 nightly 可用。另一个思路是用 `cargo-deny` 的 `msrv` 策略检查依赖树的 MSRV 兼容性。

## edition 2021 与 2024 差异要点

edition 2024 随 Rust 1.85 稳定，主要变化（实测验证的标 ✓）：

- **`static_mut_refs` 硬错误** ✓：对 `static mut` 直接取引用在 2021 是警告，2024 是错误：

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

- **`unsafe extern` 块** ✓：`extern` 块需写成 `unsafe extern`（实测 2024 下编译通过）；
- **`unsafe_op_in_unsafe_fn`**：`unsafe fn` 内的 unsafe 操作需显式 `unsafe {}` 块，2024 下默认 warn；
- **`gen` 关键字保留**：`gen` 块在 1.99 仍是实验特性（`error[E0658]: gen blocks are experimental`）；
- **RPIT 生命周期捕获**：`impl Trait` 返回类型默认捕获所有在作用域内的生命周期；
- **`std::env::set_var` / `remove_var` 变为 `unsafe`**；
- **MSRV-aware resolver（resolver v3）**：Cargo 按 `rust-version` 偏好选择兼容的依赖版本。

迁移用 `cargo fix --edition` 自动处理大部分机械改动。

## 参考资料

- 官方文档：《The rustup book》：<https://rust-lang.github.io/rustup/>

## 相关页面

- [cargo 常用工作流](./cargo-workflow)——`Cargo.toml` 与 `Cargo.lock`。
- [rust-analyzer 与编辑器](./rust-analyzer-editor)——rust-analyzer 作为 rustup 组件安装。
- [交叉编译实战](./cross-compilation-practice)——`rustup target add` 安装 target。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
