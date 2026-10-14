# rust-analyzer 与编辑器

rust-analyzer 是 Rust 的语言服务器（LSP），为 VS Code、Neovim、Emacs 等编辑器提供智能功能。它与 rustc 共享类型系统实现，但不替代 rustc——它做静态分析，编译器做最终编译。本环境实测版本：`rust-analyzer 1.99.0 (b940084 2026-09-28)`，已通过 `rustup component add rust-analyzer` 安装。

## 安装

```bash
rustup component add rust-analyzer
```

真实运行输出：

```text
info: component rust-analyzer is up to date
=== EXIT: 0 ===
```

rust-analyzer 以组件形式随 rustup 分发，与工具链版本对齐。`rustup run stable rust-analyzer --version` 验证：

```text
rust-analyzer 1.99.0 (b940084 2026-09-28)
```

VS Code 装 `rust-analyzer` 扩展后自动找到 `~/.cargo/bin/rust-analyzer`（本环境路径）。

## LSP 能力

rust-analyzer 实现 Language Server Protocol，编辑器通过 JSON-RPC 与它通信。向它发送 `initialize` 请求，返回的能力列表（节选）：

```json
{
  "inlayHintProvider": { "resolveProvider": false },
  "documentFormattingProvider": true,
  "documentOnTypeFormattingProvider": {
    "firstTriggerCharacter": "."
  },
  "completionProvider": {
    "triggerCharacters": [":", ".", "'", "("]
  },
  "hoverProvider": true,
  "definitionProvider": true,
  "typeDefinitionProvider": true,
  "documentHighlightProvider": true,
  "renameProvider": { "prepareProvider": true },
  "semanticTokensProvider": { "range": true, "full": { "delta": true } },
  "diagnosticProvider": { "interFileDependencies": true }
}
```

关键能力：**inlay hints**（内联提示）、**completion**（补全）、**hover**（悬停）、**definition**（跳转定义）、**rename**（重命名）、**semantic tokens**（语义高亮）、**diagnostics**（诊断）、**formatting**（格式化）。`diagnosticProvider` 的 `interFileDependencies: true` 意味着它能跨文件关联分析——一个文件改动会影响其他文件的诊断。

## 实测：inlay hints

在 `fn main()` 里写几个 `let` 绑定，向 rust-analyzer 请求 inlay hints（LSP `textDocument/inlayHint`）：

真实运行输出：

```json
[
  {
    "position": { "line": 5, "character": 9 },
    "label": ": i32",
    "kind": 1,
    "textEdits": [
      {
        "range": { "start": { "line": 5, "character": 9 }, "end": { "line": 5, "character": 9 } },
        "newText": ": i32"
      }
    ],
    "paddingLeft": false,
    "paddingRight": false
  },
  {
    "position": { "line": 6, "character": 9 },
    "label": ": &str",
    "kind": 1
  },
  {
    "position": { "line": 7, "character": 9 },
    "label": [
      { "value": ": " },
      { "value": "Vec", "location": { "uri": "file:///home/cui/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/alloc/src/vec/mod.rs", "range": { "start": { "line": 435, "character": 11 }, "end": { "line": 435, "character": 14 } } } },
      { "value": "<i32>" }
    ],
    "kind": 1
  },
  {
    "position": { "line": 8, "character": 9 },
    "label": [
      { "value": ": " },
      { "value": "Result", "location": { "uri": "file:///home/cui/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/result.rs", "range": { "start": { "line": 557, "character": 9 }, "end": { "line": 557, "character": 15 } } } },
      { "value": "<u8, " },
      { "value": "ParseIntError", "location": { "uri": "file:///home/cui/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/lib/rustlib/src/rust/library/core/src/num/error.rs", "range": { "start": { "line": 80, "character": 11 }, "end": { "line": 80, "character": 24 } } } },
      { "value": ">" }
    ],
    "kind": 1
  }
]
```

`let x = 1` 旁边显示 `: i32`，`let v = vec![...]` 旁边显示 `: Vec<i32>`，`let r = parse_age("42")` 旁边显示完整类型 `: Result<u8, std::num::ParseIntError>`，其中 `Vec`、`Result`、`ParseIntError` 还带有指向标准库源码的链接（`location` 字段）。类型不显示在代码里时，inlay hints 让你不跳转就能看清每个变量的精确类型。

## 常用能力

- **自动补全**：输入 `.` 或 `::` 触发，给出当前类型的所有方法；
- **语义高亮**：`semanticTokensProvider` 把关键字、类型、函数、参数、字符串等着色，比普通词法高亮准确；
- **诊断**：编译错误、未使用变量、clippy lint 直接在编辑器内联显示；
- **跳转定义 / 查找引用**：基于语义分析，不是文本搜索；
- **重命名**：跨文件安全重命名符号；
- **代码补全后自动导入**：补全一个未引入的类型会自动在文件头加 `use`。

## 与 rustfmt / clippy 的联动

rust-analyzer 自身 `documentFormattingProvider` 可用——它内部调用 rustfmt 完成格式化，所以编辑器的「保存时格式化」等价于 `cargo fmt`。clippy 诊断则通过两种途径进入编辑器：rust-analyzer 内置的 clippy 诊断（需要 `rust-analyzer.check.command = "clippy"` 配置），或独立的 clippy LSP。配置示例：

```json
{
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.inlayHints.typeHints.enable": true
}
```

`check.command` 改成 `clippy` 后，编辑器的诊断面板会同时显示 rustc 错误和 clippy lint，和 CI 的 `cargo clippy` 结果一致。

## 工程实践

- **首次打开项目稍慢**：rust-analyzer 要构建整个依赖图的语义索引（本环境实测 `analysis-stats` 加载约 797ms，49MB 内存）；
- **大项目用 `cargo check` 预热**：编辑器诊断和 `cargo check` 共享缓存；
- **配置提交到仓库**：`.vscode/settings.json` 里的 rust-analyzer 配置提交，保证团队一致。

## 参考资料

- 官方文档：rust-analyzer 官网：<https://rust-analyzer.github.io/>

## 相关页面

- [rustfmt 与代码风格](./rustfmt-style)——rust-analyzer 的格式化后端。
- [clippy 与 lint](./clippy-lints)——`check.command = "clippy"` 接入编辑器。
- [rustup 与 MSRV](./rustup-msrv)——rust-analyzer 作为 rustup 组件安装。
