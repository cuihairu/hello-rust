# WebAssembly

WebAssembly (wasm) is Rust's delivery path besides native binaries: compile to a `.wasm` module and run it in the browser, Node.js, or a wasm runtime. `wasm32-unknown-unknown` is the wasm target officially maintained by Rust; it shares the "no OS" scenario with embedded, but its positioning is entirely different.

## The wasm32-unknown-unknown target

`wasm32-unknown-unknown` means: wasm 32-bit architecture, unknown operating system, unknown environment. It is a **bare target inside a sandbox** — no OS-level APIs, no filesystem, no threads (the standard thread API is unavailable), and a program can interact with the host only through exported functions and linear memory.

```bash
rustc --print target-list | grep wasm32
```

Actual run output (rustc 1.99.0 in this environment):

```text
wasm32-unknown-emscripten
wasm32-unknown-unknown
wasm32-wali-linux-musl
wasm32-wasip1
wasm32-wasip1-threads
wasm32-wasip2
wasm32-wasip3
wasm32v1-none
wasm64-unknown-unknown
```

`wasm32-unknown-unknown` is installed in this environment (confirmed with `rustup target list --installed`) and can be compiled to directly.

### Verifying the build artifact

Compile a wasm library directly with `rustc` and inspect the artifact:

```bash
rustc --target wasm32-unknown-unknown --edition=2024 --crate-type cdylib --emit=asm -o - src/lib.rs
```

Actual run output (excerpt, showing wasm target features):

```text
	.section	.custom_section.target_features,"",@
	.int8	8
	.int8	43
	.int8	11
	.ascii	"bulk-memory"
	.int8	43
	.int8	15
	.ascii	"bulk-memory-opt"
```

The `file` command confirms the artifact format:

```text
nostd.o: WebAssembly (wasm) binary module version 0x1 (MVP)
```

## wasm-bindgen: talking to JS

Bare wasm can only pass integers and memory pointers. `wasm-bindgen` lets Rust and JS exchange high-level types like strings, arrays, and closures, and it generates TypeScript bindings automatically.

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("hello from wasm, {name}")
}

#[wasm_bindgen]
pub fn sum_array(values: &[i32]) -> i32 {
    values.iter().sum()
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn log_from_rust(msg: &str) {
    log(&format!("[wasm] {msg}"));
}
```

`#[wasm_bindgen]` marks functions exported to JS; inside the `extern "C"` block, `#[wasm_bindgen(js_namespace = console)]` imports JS's `console.log`.

## wasm-pack: building an npm package

`wasm-pack` compiles a Rust crate into a package you can publish straight to npm: it generates the `.wasm` binary, JS glue code, TypeScript type definitions, and `package.json`.

```bash
wasm-pack build --target web
```

Actual run output (wasm-pack 0.15.0 in this environment):

```text
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.02s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 0.39s
[INFO]: 📦   Your wasm pkg is ready to publish at /tmp/ecosystem-examples/wasm-demo/pkg.
```

Contents of the generated `pkg/` directory:

```text
.gitignore
package.json
wasm_demo.d.ts
wasm_demo.js
wasm_demo_bg.wasm
wasm_demo_bg.wasm.d.ts
```

Key fields of `package.json`:

```json
{
  "name": "wasm-demo",
  "type": "module",
  "version": "0.1.0",
  "main": "wasm_demo.js",
  "types": "wasm_demo.d.ts"
}
```

`file` confirms the wasm artifact:

```text
pkg/wasm_demo_bg.wasm: WebAssembly (wasm) binary module version 0x1 (MVP)
```

## wasm versus embedded

Both wasm and embedded are often paired with `no_std`, but their positioning is entirely different:

| Dimension | wasm32-unknown-unknown | Embedded (e.g. thumbv7em) |
|------|----------------------|----------------------|
| Runtime environment | Browser / wasm runtime (hosted) | Bare-metal chip (no host) |
| Memory model | Linear memory, managed by the JS host | Physical memory, managed by yourself |
| Interaction | Exported functions + linear memory | Registers / peripheral interrupts |
| Typical toolchain | wasm-pack, wasm-bindgen | probe-rs, OpenOCD |
| Threads | Standard threads unavailable (special targets needed) | Usually single-threaded or an RTOS |
| Positioning | Run compute logic in a sandbox | Directly control hardware |

The two share the `no_std` + `alloc` stack, but wasm has a JS host providing I/O, while embedded is entirely self-sufficient.

## Engineering practices

- **Use `wasm-pack build`, not manual `cargo build`**: wasm-pack invokes the `wasm-bindgen` CLI to generate the glue code and type definitions;
- **`--target web` targets the browser**, `--target nodejs` targets Node.js, `--target bundler` targets bundlers;
- **Verify the artifact**: `file` confirms it is a wasm binary, and `wasm-objdump` (requires wabt) can inspect section info;
- **Size optimization**: wasm artifacts are size-sensitive; optimize with `wasm-opt` and `opt-level = "z"`;
- **`no_std` compatibility**: wasm targets support `no_std`, but some `wasm-bindgen` features depend on std.

## References

- Official docs: *Rust and WebAssembly* (the official book): <https://rustwasm.github.io/docs/book/>

## Related pages

- [Embedded Rust](./embedded-nostd) — the other branch of OS-less targets.
- [Async](../async/) — async in wasm and interop with JS Promises.
- [Toolchain](../tooling/) — rustup and cross-compilation.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
