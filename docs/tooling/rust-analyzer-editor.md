# rust-analyzer and Editors

rust-analyzer is Rust's language server (LSP), providing intelligent features to editors such as VS Code, Neovim, and Emacs. It shares rustc's type system implementation but does not replace rustc — it performs static analysis, while the compiler does the final compilation. Version measured in this environment: `rust-analyzer 1.99.0 (b940084 2026-09-28)`, installed via `rustup component add rust-analyzer`.

## Installation

```bash
rustup component add rust-analyzer
```

Actual run output:

```text
info: component rust-analyzer is up to date
=== EXIT: 0 ===
```

rust-analyzer is distributed as a component alongside rustup, aligned with the toolchain version. Verifying with `rustup run stable rust-analyzer --version`:

```text
rust-analyzer 1.99.0 (b940084 2026-09-28)
```

After installing the `rust-analyzer` extension in VS Code, it automatically finds `~/.cargo/bin/rust-analyzer` (this environment's path).

## LSP capabilities

rust-analyzer implements the Language Server Protocol; editors communicate with it via JSON-RPC. Sending an `initialize` request returns a capabilities list (excerpt):

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

Key capabilities: **inlay hints** (inline hints), **completion**, **hover**, **definition** (go to definition), **rename**, **semantic tokens** (semantic highlighting), **diagnostics**, and **formatting**. The `interFileDependencies: true` in `diagnosticProvider` means it can perform cross-file correlation analysis — a change in one file affects diagnostics in other files.

## Measured: inlay hints

Writing a few `let` bindings in `fn main()` and requesting inlay hints from rust-analyzer (LSP `textDocument/inlayHint`):

Actual run output:

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

`: i32` is shown next to `let x = 1`, `: Vec<i32>` next to `let v = vec![...]`, and the full type `: Result<u8, std::num::ParseIntError>` next to `let r = parse_age("42")`, where `Vec`, `Result`, and `ParseIntError` also carry links to standard library source code (the `location` field). When types are not shown in the code, inlay hints let you see the exact type of every variable without navigating away.

## Common capabilities

- **Auto completion**: triggered by typing `.` or `::`, listing all methods of the current type;
- **Semantic highlighting**: `semanticTokensProvider` colors keywords, types, functions, parameters, strings, etc., more accurately than ordinary lexical highlighting;
- **Diagnostics**: compilation errors, unused variables, and clippy lints displayed inline in the editor;
- **Go to definition / find references**: based on semantic analysis, not text search;
- **Rename**: cross-file safe renaming of symbols;
- **Auto import after code completion**: completing a not-yet-imported type automatically adds a `use` statement at the top of the file.

## Integration with rustfmt / clippy

rust-analyzer's own `documentFormattingProvider` is available — it internally calls rustfmt to perform formatting, so the editor's "format on save" is equivalent to `cargo fmt`. clippy diagnostics reach the editor through two paths: rust-analyzer's built-in clippy diagnostics (requires `rust-analyzer.check.command = "clippy"` configuration), or a standalone clippy LSP. Configuration example:

```json
{
  "rust-analyzer.check.command": "clippy",
  "rust-analyzer.inlayHints.typeHints.enable": true
}
```

After changing `check.command` to `clippy`, the editor's diagnostics panel shows both rustc errors and clippy lints, consistent with CI's `cargo clippy` results.

## Engineering practice

- **Initial project open is slower**: rust-analyzer must build a semantic index of the entire dependency graph (measured `analysis-stats` loading about 797ms, 49MB memory in this environment);
- **Warm up large projects with `cargo check`**: editor diagnostics and `cargo check` share a cache;
- **Commit configuration to the repository**: commit rust-analyzer settings in `.vscode/settings.json` to keep the team consistent.

## References

- Official docs: rust-analyzer official site: <https://rust-analyzer.github.io/>

## Related pages

- [rustfmt and Code Style](./rustfmt-style) — rust-analyzer's formatting backend.
- [clippy and Lints](./clippy-lints) — `check.command = "clippy"` integrates clippy into the editor.
- [rustup and MSRV](./rustup-msrv) — rust-analyzer installed as a rustup component.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
