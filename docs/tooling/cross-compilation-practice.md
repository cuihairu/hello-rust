# 交叉编译实战

交叉编译是在 x86_64 主机上编译出 aarch64、Windows、wasm 等其他平台二进制的能力。Rust 自带交叉编译支持：装上 target 标准库、配好链接器，`cargo build --target` 就能出产物。本页记录本环境（x86_64 Linux，rustc 1.99.0）实际跑通的步骤与产物验证。

## rustup target add

每个 target 需要单独安装标准库。本环境已预装多个 target：

```bash
rustup target list --installed
```

真实运行输出（节选）：

```text
aarch64-unknown-linux-gnu
aarch64-unknown-linux-musl
wasm32-unknown-unknown
x86_64-unknown-linux-gnu
x86_64-unknown-linux-musl
x86_64-pc-windows-gnu
```

安装新 target 的命令（本环境实测第一次因网络 TLS 握手失败，重试成功）：

```text
info: downloading component rust-std
info: rolling back changes
error: component download failed for rust-std-riscv64gc-unknown-linux-gnu: partially downloaded file was kept for resumption, please try again: could not download file from 'https://static.rust-lang.org/dist/2026-10-01/rust-std-1.99.0-riscv64gc-unknown-linux-gnu.tar.xz' ...
```

重试后输出：

```text
info: component rust-std for target riscv64gc-unknown-linux-gnu is up to date
=== EXIT: 0 ===
```

## cargo build --target

以最小 crate 为例：

```rust
fn main() {
    println!("hello from cross-demo");
}
```

直接对 aarch64 构建会失败——缺链接器：

```text
--- aarch64-unknown-linux-gnu ---
          collect2: error: ld returned 1 exit status
          

error: could not compile `cross-demo` (bin "cross-demo") due to 1 previous error
```

完整报错里的关键行：

```text
  = note: rust-lld: error: --fix-cortex-a53-843419 is only supported on AArch64
```

cargo 默认用宿主机的 `cc`（x86_64）链接，而该链接器不认识 aarch64 专属参数。解决办法是在 `.cargo/config.toml` 里指定交叉链接器：

```toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

（本环境装有 `aarch64-linux-gnu-gcc`，可通过 `apt install gcc-aarch64-linux-gnu` 获得。）配置后重新构建：

真实运行输出：

```text
--- aarch64 with cross linker configured ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.33s
=== EXIT: 0 ===
```

Windows target 无需额外配置（本环境装有 mingw-w64 链接器），直接构建成功。wasm32 target 也不需要额外链接器（用 rust-lld）：

```text
--- x86_64-pc-windows-gnu ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.79s
=== EXIT: 0 ===
--- wasm32-unknown-unknown ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.17s
=== EXIT: 0 ===
```

## 产物验证：file 命令

三个平台的产物用 `file` 确认架构（本环境实测）：

```text
target/aarch64-unknown-linux-gnu/debug/cross-demo: ELF 64-bit LSB pie executable, ARM aarch64, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux-aarch64.so.1, BuildID[sha1]=690688bfa91c769ba1abf90348017b1d0610154c, for GNU/Linux 3.7.0, with debug_info, not stripped
target/x86_64-pc-windows-gnu/debug/cross-demo.exe: PE32+ executable for MS Windows 5.02 (console), x86-64, 19 sections
target/debug/cross-demo:                           ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, with debug_info, not stripped
```

`--target` 的产物分平台放在 `target/<triple>/` 子目录，与宿主产物互不干扰。

## musl vs glibc 与静态链接

`-gnu` target 链接 glibc（动态链接，产物小但依赖系统库），`-musl` target 链接 musl（默认静态链接，产物可跨发行版运行）。musl target 的构建在本环境不需要 musl-gcc——rustc 自带 self-contained 启动文件：

```text
--- x86_64-unknown-linux-musl (no musl-gcc) ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.71s
=== EXIT: 0 ===
```

产物验证：

```text
target/x86_64-unknown-linux-musl/debug/cross-demo: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, BuildID[sha1]=18e9e0f5a1653c9403eacece52cff1de1780736a, with debug_info, not stripped
---
	statically linked
```

`ldd` 报「statically linked」，确认静态二进制。release 模式产物更小：

```text
target/x86_64-unknown-linux-musl/release/cross-demo: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, BuildID[sha1]=67b438b9792542688e64392602caf6ab36ead668, not stripped
-rwxrwxr-x 2 cui cui 545824 Oct 13 23:09 target/x86_64-unknown-linux-musl/release/cross-demo
```

发布静态二进制的常见参数（写入 `.cargo/config.toml` 或构建命令）：

```bash
cargo build --release --target x86_64-unknown-linux-musl
```

无需额外 `RUSTFLAGS`，musl target 默认就是 `static-pie`。若要进一步减小体积，可在 release profile 里加 `strip = true`、`lto = true`、`opt-level = "z"`。

## cross 容器工具

`cross` 用 Docker 容器封装各 target 的完整工具链，免去手动配置链接器。本环境已装 `cross 0.2.5`，Docker daemon 可用。实测构建 aarch64 musl 静态二进制：

```bash
cross build --target aarch64-unknown-linux-musl
```

真实运行输出（节选，容器内链接命令很长，只保留关键行）：

```text
         + aarch64-linux-musl-gcc -Wl,--fix-cortex-a53-843419 ... -static -no-pie ...
warning: `cross-demo` (bin "cross-demo") generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.49s
=== EXIT: 0 ===
target/aarch64-unknown-linux-musl/debug/cross-demo: ELF 64-bit LSB executable, ARM aarch64, version 1 (SYSV), statically linked, with debug_info, not stripped
```

容器内自动用 `aarch64-linux-musl-gcc` 链接，产物是**静态链接的 aarch64 二进制**——可以直接拷贝到任何 aarch64 Linux 设备运行，不依赖目标机 libc。`cross` 与 `cargo build` 命令行参数兼容，把 `cargo` 换成 `cross` 即可。

## 未验证与限制

- **Windows MSVC target**（`x86_64-pc-windows-msvc`）：本环境已装标准库但未实测构建（MSVC 需要在 Windows 上跑或用特殊容器）；
- **riscv64gc target**：`rustup target add` 成功但 `cargo build` 失败——本环境无 riscv64 链接器，未用 `cross` 验证；
- **`--fix-cortex-a53-843419` 报错**：是 aarch64 glibc target 在无交叉链接器时的典型错误，配置 linker 后消失，已在上面记录。

## 参考资料

- 官方文档：《The Cargo Book》· Configuration：<https://doc.rust-lang.org/cargo/reference/config.html>

## 相关页面

- [rustup 与 MSRV](./rustup-msrv)——`rustup target add` 与组件管理。
- [cargo 常用工作流](./cargo-workflow)——`cargo build` 与产物目录。
- [宏](../macros/)——过程宏在交叉编译中的注意点。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
