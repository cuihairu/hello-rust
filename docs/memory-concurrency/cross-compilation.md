# Cross-Compilation

Rust's "compile once, ship to many platforms" relies on no virtual machine: rustc ships hundreds of targets, and `cargo build --target <triple>` produces the target platform's binary directly. The core takeaways: **the structure and querying of target triples**, and **the real cross-build workflow end to end (including linker configuration)** — every command and output on this page was measured in this environment (rustc 1.99.0, x86_64 Linux host).

This page documents target triples, the standard-library/linker relationship, and multi-platform build principles; the per-target commands on this machine, artifacts, and limits are in [Cross-compilation: local commands and artifacts](../tooling/cross-compilation-practice). The two notes have different perspectives and complement each other.

## target triple: arch-vendor-os-env

Each target is a four-part triple: `x86_64-unknown-linux-gnu` = arch-vendor-OS-environment (glibc); changing the environment segment to `musl` gives a static libc, and `windows-gnu` gives MinGW. Query all built-in targets (actual output):

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

Getting the target name wrong (omitting `linux`) yields a correction hint (actual output):

```text
error: error loading target specification: could not find specification for target "x86_64-unknown-musl"
  |
  = help: run `rustc --print target-list` for a list of built-in targets
  = help: did you mean `x86_64-unknown-linux-musl`?
```

## `rustup target add`: installing the target platform's std

Cross-compiling needs two things: **the target platform's standard library** (installed by rustup) and **the target platform's linker** (installed by the system). The installed list in this environment (actual output):

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

The install command is `rustup target add <triple>`; for an already-installed target it reports `component rust-std for target ... is up to date`.

## musl: static linking, measured

musl's biggest value is **static linking** — the produced binary does not depend on the target machine's libc. Actual build and verification output:

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

No linker configuration needed: the default linker for a musl target is just `cc` + rust-lld (same arch). `ldd` reporting `statically linked` means zero dependencies; such a binary can be dropped straight into a `FROM scratch` Docker image.

## linker configuration: `[target.<triple>]` in `.cargo/config.toml`

A different arch's default linker (the host's `cc`) cannot link the target arch's output. Building aarch64 directly gives this actual error:

```text
error: linking with `cc` failed: exit status: 1
  = note: （rustc 拼出的完整 linker 命令，略）
  = note: rust-lld: error: --fix-cortex-a53-843419 is only supported on AArch64
          collect2: error: ld returned 1 exit status

error: could not compile `hello` (bin "hello") due to 1 previous error
```

The fix is to specify a cross gcc for that target in the project's `.cargo/config.toml`:

```toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

Building again now succeeds, and the target binary can be run directly on the host via qemu-user (`qemu-aarch64` is installed in this environment, actual output):

```text
$ cargo build --release --target aarch64-unknown-linux-gnu
    Finished `release` profile [optimized] target(s) in 0.66s
$ file target/aarch64-unknown-linux-gnu/release/hello
...: ELF 64-bit LSB pie executable, ARM aarch64, ... dynamically linked, interpreter /lib/ld-linux-aarch64.so.1
$ qemu-aarch64 ./target/aarch64-unknown-linux-gnu/release/hello
Hello, world!
```

The negative case is useful too: this environment has no riscv64 cross gcc; the riscv64gc target's std is installed but linking necessarily fails (actual error):

```text
error: linking with `cc` failed: exit status: 1
  = note: rust-lld: error: .../target/riscv64gc-unknown-linux-gnu/release/deps/rustc5xiw3j/symbols.o is incompatible with elf64-x86-64
          rust-lld: error: .../librustlib/riscv64gc-unknown-linux-gnu/lib/libstd-*.rlib(lib.rmeta) is incompatible with elf64-x86-64
```

"incompatible with elf64-x86-64" means the host's lld is being asked to link riscv object files — installing `gcc-riscv64-unknown-linux-gnu` and configuring `linker` fixes it.

## windows and wasm

With `x86_64-w64-mingw32-gcc` installed, the windows-gnu target works out of the box (build verified in this environment, but **not run** — no wine):

```text
$ cargo build --release --target x86_64-pc-windows-gnu
    Finished `release` profile [optimized] target(s) in 0.77s
$ file target/x86_64-pc-windows-gnu/release/hello.exe
...: PE32+ executable for MS Windows 5.02 (console), x86-64
```

The wasm target needs no linker (the output is a wasm module, not an executable); actual build output:

```text
$ cargo build --release --target wasm32-unknown-unknown
    Finished `release` profile [optimized] target(s) in 0.48s
$ file target/wasm32-unknown-unknown/release/hello.wasm
...: WebAssembly (wasm) binary module version 0x1 (MVP)
```

Examples of loading wasm in node/browser are in the bump allocator section of [Custom Allocators](./custom-allocator).

## Measurement scope and limits

- **Measured**: target-list query, rustup installed list, musl static build and run, aarch64 failure → config.toml → success → qemu run, riscv64gc failure error, windows-gnu build, wasm build.
- **Not measured**: actually running the windows artifact (no wine), macOS/iOS targets (no Apple toolchain on this machine), third-party schemes such as `cargo-zigbuild`/`cross`.

## References

- Official docs: "The rustc book" · Platform Support: <https://doc.rust-lang.org/rustc/platform-support.html>

## Related pages

- [Custom Allocators](./custom-allocator) — the runtime support for wasm/no_std targets.
- [Send and Sync](./send-and-sync) — the thread-safety precondition for cross-platform concurrent code.
- [Toolchain overview](../tooling/) — more rustup and cargo practice.
- [Glossary](../glossary) — the site-wide Chinese-English dictionary of core terms with authoritative sources.
