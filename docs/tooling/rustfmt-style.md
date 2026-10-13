# rustfmt 与代码风格

rustfmt 是 Rust 官方代码格式化工具，随 rustup 一起分发。它把「代码长什么样」从团队争论中抽离出来——所有人跑同一条命令，输出一致。本环境实测版本：`rustfmt 1.10.0-stable (b940084d7e 2026-09-28)`。

## 默认规则

rustfmt 的默认配置不需要任何配置文件即可工作。核心默认值（`rustfmt --print-config default` 实测输出）：

```text
max_width = 100
hard_tabs = false
tab_spaces = 4
newline_style = "Auto"
use_small_heuristics = "Default"
fn_call_width = 60
attr_fn_like_width = 70
struct_lit_width = 18
chain_width = 60
reorder_imports = true
reorder_modules = true
```

即：4 空格缩进、行宽上限 100、自动换行、import 按字母重排。对一段不规范的代码跑 `cargo fmt --check`：

```rust
use std::collections::HashMap;
fn main(){
let mut m:HashMap<String,i32>=HashMap::new();
m.insert("a".to_string(),1);
let x=1+2*3;
if x>5{println!("big");}
}
```

真实运行输出：

```text
--- rustfmt --check ---
Diff in /tmp/tooling-examples/fmt-demo/src/main.rs:1:
 use std::collections::HashMap;
-fn main(){
-let mut m:HashMap<String,i32>=HashMap::new();
-m.insert("a".to_string(),1);
-let x=1+2*3;
-if x>5{println!("big");}
+fn main() {
+    let mut m: HashMap<String, i32> = HashMap::new();
+    m.insert("a".to_string(), 1);
+    let x = 1 + 2 * 3;
+    if x > 5 {
+        println!("big");
+    }
 }

=== EXIT: 1 ===
```

`--check` 不修改文件，只打印 diff 并以退出码 1 表示「需要格式化」——这正是 CI 的用法。`cargo fmt`（不带 `--check`）直接改写文件。

## rustfmt.toml 常见配置项

在 crate 根目录放 `rustfmt.toml` 即可覆盖默认值。常见项：

```toml
edition = "2024"
max_width = 80
```

- `edition`：告诉 rustfmt 按哪个 edition 的语法解析（影响格式化行为）；
- `max_width`：行宽上限，默认 100；
- `tab_spaces`：缩进宽度，默认 4；
- `hard_tabs`：用 tab 缩进，默认 false；
- `imports_granularity`：import 合并粒度（nightly-only）；
- `group_imports`：import 分组顺序（nightly-only）。

实测 `max_width = 80` 生效：

```bash
cargo fmt
```

真实运行输出：

```text
--- cargo fmt (applies) ---
=== EXIT: 0 ===
fn main() {
    let long_function_name = some_function_with_a_long_name(
        argument_one,
        argument_two,
        argument_three,
    );
}
```

超过 80 列的函数调用被自动折行。

## nightly-only 配置项

`imports_granularity` 与 `group_imports` 是 nightly-only 选项。在 stable 上设置它们，rustfmt 会打印警告并忽略：

```toml
edition = "2024"
max_width = 80
imports_granularity = "Crate"
group_imports = "StdExternalCrate"
```

真实运行输出：

```text
--- stable rustfmt with nightly-only opts ---
Warning: can't set `imports_granularity = Crate`, unstable features are only available in nightly channel.
Warning: can't set `group_imports = StdExternalCrate`, unstable features are only available in nightly channel.
Diff in /tmp/tooling-examples/fmt-demo/src/main.rs:1:
 use std::collections::HashMap;
 use std::fmt::Display;
-fn main(){}
+fn main() {}

=== EXIT: 1 ===
```

警告明确说明「unstable features are only available in nightly channel」。想用这些选项，需要 `rustup run nightly cargo fmt` 或 `cargo +nightly fmt`。stable 上写这些配置项不会报错，只是静默失效——排查「配置怎么没生效」时先看有没有这条警告。

## CI 里的 cargo fmt --check

CI 中检查格式化的标准写法：

```bash
cargo fmt --check
```

真实运行输出（代码已格式化时）：

```text
--- cargo fmt --check after format ---
=== EXIT: 0 ===
--- cargo fmt -- --check ---
=== EXIT: 0 ===
```

`cargo fmt --check` 与 `cargo fmt -- --check` 等价，后者把 `--check` 透传给 rustfmt 二进制。退出码 0 表示全部合规，非 0 表示有差异。在 CI 里加这一步，能保证合并的代码都经过格式化。

## 工程实践

- **本地**：`cargo fmt` 一键格式化；`cargo fmt --check` 在提交前自检；
- **CI**：`cargo fmt --check` 作为独立步骤，失败即阻断合并；
- **配置**：团队统一 `rustfmt.toml` 并提交到仓库，避免每个人本地配置不同；
- **nightly 选项**：确需 `imports_granularity` 等选项时，CI 与本地都用 `cargo +nightly fmt`，并在 README 注明。

## 相关页面

- [cargo 常用工作流](./cargo-workflow)——`cargo fmt` 是 cargo 的子命令。
- [clippy 与 lint](./clippy-lints)——格式化之后的下一道静态检查。
- [rust-analyzer 与编辑器](./rust-analyzer-editor)——编辑器保存时自动调用 rustfmt。

官方文档：<https://rust-lang.github.io/rustfmt/>
