# WebAssembly

WebAssembly（wasm）是 Rust 除原生二进制外的另一条交付路径：编译成 `.wasm` 模块，在浏览器、Node.js 或 wasm 运行时里执行。`wasm32-unknown-unknown` 是 Rust 官方维护的 wasm 目标，与嵌入式同为「无 OS」场景，但定位完全不同。

## wasm32-unknown-unknown 目标

`wasm32-unknown-unknown` 的含义是：wasm 32 位架构、unknown 操作系统、unknown 环境。它是一个**沙箱内的裸目标**——没有 OS 级 API、没有文件系统、没有线程（标准线程 API 不可用），程序只能通过导出函数和线性内存与宿主交互。

```bash
rustc --print target-list | grep wasm32
```

真实运行输出（本环境 rustc 1.99.0）：

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

`wasm32-unknown-unknown` 是本环境已安装的目标（`rustup target list --installed` 确认），可直接编译。

### 编译产物验证

用 `rustc` 直接编译一个 wasm 库并查看产物：

```bash
rustc --target wasm32-unknown-unknown --edition=2024 --crate-type cdylib --emit=asm -o - src/lib.rs
```

真实运行输出（节选，显示 wasm 目标特性）：

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

`file` 命令确认产物格式：

```text
nostd.o: WebAssembly (wasm) binary module version 0x1 (MVP)
```

## wasm-bindgen：与 JS 交互

裸 wasm 只能传递整数和内存指针。`wasm-bindgen` 让 Rust 与 JS 之间可以传递字符串、数组、闭包等高级类型，并自动生成 TypeScript 绑定。

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

`#[wasm_bindgen]` 标记导出给 JS 的函数；`extern "C"` 块里用 `#[wasm_bindgen(js_namespace = console)]` 导入 JS 的 `console.log`。

## wasm-pack：构建 npm 包

`wasm-pack` 把 Rust crate 编译成可直接发布到 npm 的包：生成 `.wasm` 二进制、JS 胶水代码、TypeScript 类型定义和 `package.json`。

```bash
wasm-pack build --target web
```

真实运行输出（本环境 wasm-pack 0.15.0）：

```text
[INFO]: 🎯  Checking for the Wasm target...
[INFO]: 🌀  Compiling to Wasm...
    Finished `release` profile [optimized] target(s) in 0.02s
[INFO]: ⬇️  Installing wasm-bindgen...
[INFO]: Optimizing wasm binaries with `wasm-opt`...
[INFO]: ✨   Done in 0.39s
[INFO]: 📦   Your wasm pkg is ready to publish at /tmp/ecosystem-examples/wasm-demo/pkg.
```

生成的 `pkg/` 目录内容：

```text
.gitignore
package.json
wasm_demo.d.ts
wasm_demo.js
wasm_demo_bg.wasm
wasm_demo_bg.wasm.d.ts
```

`package.json` 关键字段：

```json
{
  "name": "wasm-demo",
  "type": "module",
  "version": "0.1.0",
  "main": "wasm_demo.js",
  "types": "wasm_demo.d.ts"
}
```

`file` 确认 wasm 产物：

```text
pkg/wasm_demo_bg.wasm: WebAssembly (wasm) binary module version 0x1 (MVP)
```

## wasm 与嵌入式的对比

wasm 和嵌入式都常与 `no_std` 搭配，但定位截然不同：

| 维度 | wasm32-unknown-unknown | 嵌入式（如 thumbv7em） |
|------|----------------------|----------------------|
| 运行环境 | 浏览器 / wasm 运行时（有宿主） | 裸机芯片（无宿主） |
| 内存模型 | 线性内存，由 JS 宿主管理 | 物理内存，自己管理 |
| 交互方式 | 导出函数 + 线性内存 | 寄存器 / 外设中断 |
| 典型工具链 | wasm-pack、wasm-bindgen | probe-rs、OpenOCD |
| 线程 | 标准线程不可用（需特殊 target） | 通常单线程或 RTOS |
| 定位 | 在沙箱里跑计算逻辑 | 直接控制硬件 |

两者共享 `no_std` + `alloc` 的技术栈，但 wasm 有 JS 宿主提供 I/O，嵌入式则完全自给自足。

## 工程实践

- **用 `wasm-pack build` 而非手动 `cargo build`**：wasm-pack 会调用 `wasm-bindgen` CLI 生成胶水代码和类型定义；
- **`--target web` 面向浏览器**，`--target nodejs` 面向 Node.js，`--target bundler` 面向打包器；
- **验证产物**：`file` 确认是 wasm 二进制，`wasm-objdump`（需安装 wabt）可查看段信息；
- **体积优化**：wasm 产物对体积敏感，用 `wasm-opt` 和 `opt-level = "z"` 优化；
- **`no_std` 兼容**：wasm 目标支持 `no_std`，但 `wasm-bindgen` 的部分功能依赖 std。

## 参考资料

- 官方文档：《Rust and WebAssembly》官方书：<https://rustwasm.github.io/docs/book/>

## 相关页面

- [嵌入式 Rust](./embedded-nostd)——同为无 OS 目标的另一分支。
- [异步](../async/)——wasm 里的 async 与 JS Promise 互操作。
- [工具链](../tooling/)——rustup 与交叉编译。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
