# clippy 与 lint

clippy 是 Rust 的官方 linter，超过 700 条 lint 覆盖风格、正确性、性能等维度（本环境实测版本：`clippy 0.1.99 (b940084d7e 2026-09-28)`）。它和 rustc 共享前端，`cargo clippy` 在 `cargo check` 的基础上叠加 lint 检查。

## lint 三级：allow / warn / deny

每条 lint 有四个可选级别：`allow`（关闭）、`warn`（警告）、`deny`（错误）、`forbid`（错误且不可覆盖）。默认级别由 lint 自己决定——多数是 `allow`，一部分是 `warn`。可以在代码里用属性调整：

```rust
#![deny(clippy::clone_on_copy)]

fn clone_on_copy(x: i32) -> i32 {
    x.clone()
}

fn main() {
    println!("{}", clone_on_copy(5));
}
```

真实运行输出：

```text
--- deny lint: build fails ---
error: using `clone` on type `i32` which implements the `Copy` trait
 --> src/main.rs:4:5
  |
4 |     x.clone()
  |     ^^^^^^^^^ help: try removing the `clone` call: `x`
  |
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#clone_on_copy
note: the lint level is defined here
 --> src/main.rs:1:9
  |
1 | #![deny(clippy::clone_on_copy)]
  |         ^^^^^^^^^^^^^^^^^^^^^

error: could not compile `clippy-demo` (bin "clippy-demo") due to 1 previous error
=== EXIT: 101 ===
```

被 `deny` 的 lint 会以 `error` 出现并使 `cargo clippy` 退出码非零。但注意——`cargo build` 不跑 clippy lint，仍然成功（实测 `Finished` + `EXIT: 0`）。clippy 的 lint 由 `clippy-driver` 注入，rustc 本身不知道它们的存在。所以 CI 里必须显式跑 `cargo clippy`。

## 常用 lint 族

clippy 的 lint 按组（group）组织，默认开启的是 `correctness`、`suspicious`、`style`、`complexity`、`perf` 五组。其余常用组：`pedantic`（严格最佳实践，选择性开启）、`nursery`（实验性，可能误报）、`restriction`（限制性，按条单独开启，不适合整组启用）、`cargo`（检查 `Cargo.toml` 本身）。

用一段代码实测各组独立能抓到什么（`#![allow(clippy::all)]` 先关掉默认组再单开一组，correctness / suspicious / perf 对本例无输出）：

```text
=== clippy::style ===
length comparison to zero
writing `&String` instead of `&str` involves a new object where a slice will do
writing `&Vec` instead of `&[_]` involves a new object where a slice will do

=== clippy::complexity ===
using `clone` on type `i32` which implements the `Copy` trait

=== clippy::pedantic ===
this function could have a `#[must_use]` attribute

=== clippy::nursery ===
this could be a `const fn`
```

对应的 lint 名：`len_zero`（style）、`ptr_arg`（style）、`clone_on_copy`（complexity）、`must_use_candidate`（pedantic）、`missing_const_for_fn`（nursery）。整组名不能直接当 lint 名写，如 `#![warn(clippy::style)]` 是合法的，但 `clippy::restriction` 组官方明确提示「not meant to be enabled as a group」。

## 真实 lint 输出

故意写触发默认组的代码：

```rust
fn get_first(v: &Vec<i32>) -> i32 {
    v[0]
}

fn check_empty(s: &String) -> bool {
    s.len() == 0
}

fn clone_on_copy(x: i32) -> i32 {
    x.clone()
}

fn main() {
    let v = vec![1, 2, 3];
    println!("first: {}", get_first(&v));
    println!("empty: {}", check_empty(&String::from("abc")));
    println!("copy: {}", clone_on_copy(5));
}
```

真实运行输出（共 4 条警告，此处保留 2 条，其余结构相同）：

```text
warning: writing `&Vec` instead of `&[_]` involves a new object where a slice will do
 --> src/main.rs:1:17
  |
1 | fn get_first(v: &Vec<i32>) -> i32 {
  |                 ^^^^^^^^^
  |
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#ptr_arg
  = note: `#[warn(clippy::ptr_arg)]` on by default
help: change this to
  |
1 - fn get_first(v: &Vec<i32>) -> i32 {
1 + fn get_first(v: &[i32]) -> i32 {

warning: length comparison to zero
 --> src/main.rs:6:5
  |
6 |     s.len() == 0
  |     ^^^^^^^^^^^^ help: using `is_empty` is clearer and more explicit: `s.is_empty()`
  |
  = note: `#[warn(clippy::len_zero)]` on by default

warning: `clippy-demo` (bin "clippy-demo") generated 4 warnings (run `cargo clippy --fix --bin "clippy-demo" -p clippy-demo -- ` to apply 2 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.46s
=== EXIT: 0 ===
```

每条 lint 都给出：触发位置、lint 名（点击链接到官方文档）、修复建议。`--fix` 能自动修的会提示条数。

## 自定义 clippy.toml

部分 lint 接受配置，写在 crate 根目录的 `clippy.toml`。实测 `cognitive-complexity-threshold`：

```toml
cognitive-complexity-threshold = 0
```

配合 `#![warn(clippy::cognitive_complexity)]`：

真实运行输出：

```text
warning: the function has a cognitive complexity of (7/0)
 --> src/main.rs:3:4
  |
3 | fn classify(score: u32, bonus: bool, penalty: bool) -> &'static str {
  |    ^^^^^^^^
  |
  = help: you could split it up into multiple smaller functions
  = help: for further information visit https://rust-lang.github.io/rust-clippy/rust-1.99.0/index.html#cognitive_complexity
note: the lint level is defined here
 --> src/main.rs:1:9
  |
1 | #![warn(clippy::cognitive_complexity)]
  |         ^^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: `clippy-demo` (bin "clippy-demo") generated 2 warnings
=== EXIT: 0 ===
```

clippy 会校验配置键名——写一个不存在的键会直接报错并列出所有合法键（实测 `error: unknown field name`）。`cognitive_complexity` 属于 restriction 组，默认 `allow`，需显式 warn。

## CI 用法与 --fix

CI 标准写法是把警告升级为错误：

```bash
cargo clippy -- -D warnings
```

真实运行输出：

```text
error: could not compile `clippy-demo` (bin "clippy-demo") due to 1 previous error
=== EXIT: 101 ===
```

`--` 之后是传给 clippy-driver 的 rustc 参数，`-D warnings` 把所有 warn 级 lint 升为 deny。本地修复可以交给自动修复（`cargo clippy --fix --allow-dirty --allow-no-vcs`），实测效果：

```text
--- before ---
fn check_empty(s: &String) -> bool { s.len() == 0 }
fn clone_on_copy(x: i32) -> i32 { x.clone() }
--- after ---
fn check_empty(s: &String) -> bool { s.is_empty() }
fn clone_on_copy(x: i32) -> i32 { x }
```

`ptr_arg` 涉及函数签名变化，`--fix` 不会自动改（可能破坏调用方），需要人工确认。

## 注意事项与常见坑

- **`cargo build` 不跑 clippy**：clippy lint 只在 `cargo clippy` 下生效，别以为 build 通过就没问题；
- **整组 deny 要谨慎**：`#![deny(clippy::pedantic)]` 会把所有 pedantic lint 变成硬错误，误报也会阻断编译，建议 `#![warn(clippy::pedantic)]` 配合 `cargo clippy -- -D warnings` 分级管控；
- **lint 名以 `cargo clippy` 输出为准**：lint 命名随版本调整（改名、移组），不要凭记忆写，本页所有 lint 名都以 clippy 0.1.99 实测输出为准。

## 参考资料

- 官方文档：Clippy 官方 lint 列表：<https://rust-lang.github.io/rust-clippy/master/>

## 相关页面

- [rustfmt 与代码风格](./rustfmt-style)——格式化与 lint 是两道互补的检查。
- [cargo 常用工作流](./cargo-workflow)——`cargo clippy` 是 cargo 的子命令。
- [rust-analyzer 与编辑器](./rust-analyzer-editor)——编辑器内联显示 clippy 提示。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
