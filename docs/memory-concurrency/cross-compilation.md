# 交叉编译

Rust 的"一次编译，多平台发布"不靠虚拟机：rustc 自带几百个 target，`cargo build --target <triple>` 直接产出目标平台的二进制。核心知识点：**target triple 的结构与查询**，以及**真实的交叉构建全流程（含 linker 配置）**——本页所有命令与输出均为本环境（rustc 1.99.0，x86_64 Linux 宿主）实测。

本页侧重 target triple、标准库/linker 关系和多平台构建原理；本机逐 target 的命令、产物与限制记录见[交叉编译实战](../tooling/cross-compilation-practice)。两页视角不同，互为补充。

## target triple：arch-vendor-os-env

每个 target 是四段式的 triple：`x86_64-unknown-linux-gnu` = 架构-供应商-操作系统-环境（glibc）；环境段换成 `musl` 即静态 libc，`windows-gnu` 即 MinGW。查全部内置 target（真实输出）：

```text
$ rustc --print target-list | wc -l
331
$ rustc --print target-list | head -5
aarch64-apple-darwin
aarch64-apple-ios
aarch64-apple-ios-macabi
aarch64-apple-ios-sim
aarch64-apple-tvos
```

写错 target 名（漏掉 `linux`）会得到纠错提示（真实输出）：

```text
error: error loading target specification: could not find specification for target "x86_64-unknown-musl"
  |
  = help: run `rustc --print target-list` for a list of built-in targets
  = help: did you mean `x86_64-unknown-linux-musl`?
```

## `rustup target add`：装目标平台的 std

交叉编译需要两样东西：**目标平台的标准库**（rustup 装）和**目标平台的 linker**（系统装）。本环境已装列表（真实输出）：

```text
$ rustup target list --installed
aarch64-apple-darwin
aarch64-linux-android
aarch64-unknown-linux-gnu
aarch64-unknown-linux-musl
riscv64gc-unknown-linux-gnu
wasm32-unknown-unknown
x86_64-pc-windows-gnu
x86_64-unknown-linux-musl
（其余略）
```

安装命令 `rustup target add <triple>`；对已装 target 会提示 `component rust-std for target ... is up to date`。

## musl：静态链接实测

musl 目标最大的价值是**静态链接**——产出的二进制不依赖目标机的 libc。真实构建与验证输出：

```text
$ cargo build --release --target x86_64-unknown-linux-musl
   Compiling hello v0.1.0 (/tmp/mem-conc-examples/hello)
    Finished `release` profile [optimized] target(s) in 1.02s
$ file target/x86_64-unknown-linux-musl/release/hello
...: ELF 64-bit LSB pie executable, x86-64, ... static-pie linked, not stripped
$ ldd target/x86_64-unknown-linux-musl/release/hello
	statically linked
$ ./target/x86_64-unknown-linux-musl/release/hello
Hello, world!
```

不需要任何 linker 配置：musl 目标的默认 linker 就是 `cc` + rust-lld（同架构）。`ldd` 报 `statically linked` 即零依赖，这类二进制可以直接扔进 `FROM scratch` 的 Docker 镜像。

## linker 配置：`.cargo/config.toml` 的 `[target.<triple>]`

不同架构默认 linker（宿主的 `cc`）不能链接目标架构的产物。对 aarch64 直接构建，真实报错：

```text
error: linking with `cc` failed: exit status: 1
  = note: （rustc 拼出的完整 linker 命令，略）
  = note: rust-lld: error: --fix-cortex-a53-843419 is only supported on AArch64
          collect2: error: ld returned 1 exit status

error: could not compile `hello` (bin "hello") due to 1 previous error
```

解法是在项目 `.cargo/config.toml` 里给该 target 指定交叉 gcc：

```toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

再次构建即成功，并可用 qemu-user 直接在宿主机运行目标二进制（本环境已装 `qemu-aarch64`，真实输出）：

```text
$ cargo build --release --target aarch64-unknown-linux-gnu
    Finished `release` profile [optimized] target(s) in 0.66s
$ file target/aarch64-unknown-linux-gnu/release/hello
...: ELF 64-bit LSB pie executable, ARM aarch64, ... dynamically linked, interpreter /lib/ld-linux-aarch64.so.1
$ qemu-aarch64 ./target/aarch64-unknown-linux-gnu/release/hello
Hello, world!
```

反例也有价值：本环境没有 riscv64 交叉 gcc，riscv64gc target 的 std 已装但链接必败（真实报错）：

```text
error: linking with `cc` failed: exit status: 1
  = note: rust-lld: error: .../target/riscv64gc-unknown-linux-gnu/release/deps/rustc5xiw3j/symbols.o is incompatible with elf64-x86-64
          rust-lld: error: .../librustlib/riscv64gc-unknown-linux-gnu/lib/libstd-*.rlib(lib.rmeta) is incompatible with elf64-x86-64
```

"incompatible with elf64-x86-64" 意思是宿主 lld 被要求链接 riscv 目标文件——装 `gcc-riscv64-unknown-linux-gnu` 并配 `linker` 即解。

## windows 与 wasm

装有 `x86_64-w64-mingw32-gcc` 时，windows-gnu 目标开箱即用（本环境实测构建成功，但**未运行**——没有 wine）：

```text
$ cargo build --release --target x86_64-pc-windows-gnu
    Finished `release` profile [optimized] target(s) in 0.77s
$ file target/x86_64-pc-windows-gnu/release/hello.exe
...: PE32+ executable for MS Windows 5.02 (console), x86-64
```

wasm 目标不需要 linker（产出的是 wasm 模块而非可执行文件），真实构建输出：

```text
$ cargo build --release --target wasm32-unknown-unknown
    Finished `release` profile [optimized] target(s) in 0.48s
$ file target/wasm32-unknown-unknown/release/hello.wasm
...: WebAssembly (wasm) binary module version 0x1 (MVP)
```

在 node/浏览器里加载 wasm 的实例见[自定义分配器](./custom-allocator)的 bump 分配器一节。

## 实测边界说明

- **已实测**：target-list 查询、rustup 已装列表、musl 静态构建并运行、aarch64 失败→config.toml→成功→qemu 运行、riscv64gc 失败报错、windows-gnu 构建、wasm 构建。
- **未实测**：windows 产物的实际运行（无 wine）、macOS/iOS target（本机无 Apple 工具链）、`cargo-zigbuild`/`cross` 等第三方方案。

## 参考资料

- 官方文档：《The rustc book》· Platform Support：<https://doc.rust-lang.org/rustc/platform-support.html>

## 相关页面

- [自定义分配器](./custom-allocator)——wasm/no_std 目标的运行时支撑。
- [Send 与 Sync](./send-and-sync)——跨平台并发代码的线程安全前提。
- [工具链全景](../tooling/)——rustup、cargo 的更多实践。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
