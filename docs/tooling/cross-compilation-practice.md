# Cross-Compilation: Local Commands and Artifact Records

Cross-compilation is the ability to compile binaries for platforms other than the host x86_64, such as aarch64, Windows, and wasm. Rust has built-in cross-compilation support: install the target standard library, configure the linker, and `cargo build --target` produces the artifact. This page records the steps actually run in this environment (x86_64 Linux, rustc 1.99.0) and artifact verification.

This page records the local commands, artifacts, and verification boundaries; for conceptual explanations of target triples and standard library / linker concepts, see [Cross-Compilation](../memory-concurrency/cross-compilation). The two pages cover environment measurement and conceptual breakdown respectively.

## rustup target add

Each target requires its own standard library to be installed. This environment has several targets preinstalled:

```bash
rustup target list --installed
```

Actual run output (excerpt):

```text
aarch64-unknown-linux-gnu
aarch64-unknown-linux-musl
wasm32-unknown-unknown
x86_64-unknown-linux-gnu
x86_64-unknown-linux-musl
x86_64-pc-windows-gnu
```

The command for installing a new target (measured in this environment: the first attempt failed due to a network TLS handshake error, and succeeded on retry):

```text
info: downloading component rust-std
info: rolling back changes
error: component download failed for rust-std-riscv64gc-unknown-linux-gnu: partially downloaded file was kept for resumption, please try again: could not download file from 'https://static.rust-lang.org/dist/2026-10-01/rust-std-1.99.0-riscv64gc-unknown-linux-gnu.tar.xz' ...
```

Output after retry:

```text
info: component rust-std for target riscv64gc-unknown-linux-gnu is up to date
=== EXIT: 0 ===
```

## cargo build --target

Using a minimal crate as an example:

```rust
fn main() {
    println!("hello from cross-demo");
}
```

Building directly for aarch64 fails — the linker is missing:

```text
--- aarch64-unknown-linux-gnu ---
          collect2: error: ld returned 1 exit status
          

error: could not compile `cross-demo` (bin "cross-demo") due to 1 previous error
```

The key line in the full error message:

```text
  = note: rust-lld: error: --fix-cortex-a53-843419 is only supported on AArch64
```

cargo uses the host's `cc` (x86_64) to link by default, and that linker does not recognize aarch64-specific flags. The fix is to specify a cross-linker in `.cargo/config.toml`:

```toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

(This environment has `aarch64-linux-gnu-gcc` installed, which can be obtained via `apt install gcc-aarch64-linux-gnu`.) Rebuilding after configuration:

Actual run output:

```text
--- aarch64 with cross linker configured ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.33s
=== EXIT: 0 ===
```

The Windows target requires no extra configuration (this environment has the mingw-w64 linker installed), and the build succeeds directly. The wasm32 target also needs no extra linker (it uses rust-lld):

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

## Artifact verification: the file command

Confirming the architecture of artifacts for the three platforms with `file` (measured in this environment):

```text
target/aarch64-unknown-linux-gnu/debug/cross-demo: ELF 64-bit LSB pie executable, ARM aarch64, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux-aarch64.so.1, BuildID[sha1]=690688bfa91c769ba1abf90348017b1d0610154c, for GNU/Linux 3.7.0, with debug_info, not stripped
target/x86_64-pc-windows-gnu/debug/cross-demo.exe: PE32+ executable for MS Windows 5.02 (console), x86-64, 19 sections
target/debug/cross-demo:                           ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, with debug_info, not stripped
```

Artifacts built with `--target` are placed in `target/<triple>/` subdirectories per platform, so they do not interfere with host artifacts.

## musl vs glibc and static linking

`-gnu` targets link against glibc (dynamic linking, smaller artifacts but dependent on system libraries), while `-musl` targets link against musl (static linking by default, artifacts runnable across distributions). Building musl targets in this environment does not require musl-gcc — rustc ships with self-contained startup files:

```text
--- x86_64-unknown-linux-musl (no musl-gcc) ---
   Compiling cross-demo v0.1.0 (/tmp/tooling-examples/cross-demo)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.71s
=== EXIT: 0 ===
```

Artifact verification:

```text
target/x86_64-unknown-linux-musl/debug/cross-demo: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, BuildID[sha1]=18e9e0f5a1653c9403eacece52cff1de1780736a, with debug_info, not stripped
---
	statically linked
```

`ldd` reports "statically linked", confirming a static binary. Release-mode artifacts are smaller:

```text
target/x86_64-unknown-linux-musl/release/cross-demo: ELF 64-bit LSB pie executable, x86-64, version 1 (SYSV), static-pie linked, BuildID[sha1]=67b438b9792542688e64392602caf6ab36ead668, not stripped
-rwxrwxr-x 2 cui cui 545824 Oct 13 23:09 target/x86_64-unknown-linux-musl/release/cross-demo
```

Common flags for shipping a static binary (write them in `.cargo/config.toml` or the build command):

```bash
cargo build --release --target x86_64-unknown-linux-musl
```

No extra `RUSTFLAGS` are needed; musl targets default to `static-pie`. To reduce size further, you can add `strip = true`, `lto = true`, and `opt-level = "z"` to the release profile.

## The cross container tool

`cross` wraps each target's complete toolchain in a Docker container, eliminating the need to configure linkers manually. This environment has `cross 0.2.5` installed, with the Docker daemon available. Measured build of an aarch64 musl static binary:

```bash
cross build --target aarch64-unknown-linux-musl
```

Actual run output (excerpt, the linker command inside the container is very long, only key lines preserved):

```text
         + aarch64-linux-musl-gcc -Wl,--fix-cortex-a53-843419 ... -static -no-pie ...
warning: `cross-demo` (bin "cross-demo") generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.49s
=== EXIT: 0 ===
target/aarch64-unknown-linux-musl/debug/cross-demo: ELF 64-bit LSB executable, ARM aarch64, version 1 (SYSV), statically linked, with debug_info, not stripped
```

Inside the container, linking is done automatically with `aarch64-linux-musl-gcc`, and the artifact is a **statically linked aarch64 binary** — it can be copied directly to any aarch64 Linux device and run without depending on the target machine's libc. `cross` is compatible with `cargo build` command-line arguments; simply replace `cargo` with `cross`.

## Unverified and limitations

- **Windows MSVC target** (`x86_64-pc-windows-msvc`): the standard library is installed in this environment but the build was not measured (MSVC requires running on Windows or using a special container);
- **riscv64gc target**: `rustup target add` succeeded but `cargo build` failed — this environment has no riscv64 linker, and `cross` was not used to verify;
- **`--fix-cortex-a53-843419` error**: a typical error for the aarch64 glibc target when no cross-linker is configured; it disappears after configuring the linker, as recorded above.

## References

- Official docs: "The Cargo Book" · Configuration: <https://doc.rust-lang.org/cargo/reference/config.html>

## Related pages

- [rustup and MSRV](./rustup-msrv) — `rustup target add` and component management.
- [Everyday cargo Workflows](./cargo-workflow) — `cargo build` and the artifact directory.
- [Macros](../macros/) — notes on procedural macros in cross-compilation.
- [Glossary](../glossary) — Chinese-English bilingual terms and authoritative sources across the site.
