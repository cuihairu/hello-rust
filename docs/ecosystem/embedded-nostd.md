# Embedded Rust

Embedded development has no operating system, no heap, sometimes not even a `main` function — Rust strips std out of the dependency graph with `#![no_std]`, leaving only the platform-independent `core`. This page covers what remains after `no_std`, how the entry point is written, how `alloc` comes back in, and where HAL, Embassy, and RTIC fit in the ecosystem.

## `#![no_std]`: what is left without std

`#![no_std]` is a crate-level attribute meaning the crate links against `core` instead of `std`. `core` is the platform-independent subset of std: primitive types, slices, strings, iterators, and atomics are all there, but there is **no** files, networking, threads, or `println!`, and **no** default memory allocator.

| Layer | What it provides | What it requires |
|---|---|---|
| `core` | Primitive types, iterators, slices, formatting | Nothing |
| `alloc` | `Box`, `Vec`, `String`, `BTreeMap` | You provide a `#[global_allocator]` |
| `std` | Files, networking, threads, `println!`, processes | An operating system |

Embedded programs usually use only `core`; when a heap is needed, bring in `alloc` and write your own allocator.

## `#[no_main]` and the entry point

Without std there is no runtime initialization, hence no `main`. `#![no_main]` suppresses generation of the `main` symbol; the entry point is whatever you define yourself in the linker script (a common bare-metal name is `Reset`):

```rust
#![no_std]
#![no_main]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

#[unsafe(no_mangle)]
pub extern "C" fn Reset() -> ! {
    loop {}
}
```

`#[panic_handler]` is mandatory under `no_std`: std's panic handling is gone, so you must define what a panic does (on bare metal, an infinite loop or a reset is most common).

### Compile verification

A single-file `no_std` program can be compiled to an object file with plain rustc, no linker needed. Measured in this environment (rustc 1.99.0; both the `wasm32-unknown-unknown` target and the host `x86_64-unknown-linux-gnu` pass):

```bash
rustc --target x86_64-unknown-linux-gnu --emit=obj -C panic=abort -o nostd.o src/main.rs
```

Actual run output:

```text
exit: 0
nostd-linux.o: ELF 64-bit LSB relocatable, x86-64, version 1 (SYSV), not stripped
0000000000000000 T Reset
```

The symbol table contains only the `Reset` we defined — no `main`, no std symbols — std really is stripped away.

## `#[global_allocator]`: minimal alloc

When you need `Box` / `Vec`, implement the `GlobalAlloc` trait and mark it `#[global_allocator]`. Embedded work often uses a bump allocator (allocate-only, never free, tiny implementation):

```rust
#![no_std]
#![no_main]

extern crate alloc;

use core::alloc::{GlobalAlloc, Layout};
use core::panic::PanicInfo;
use core::ptr::null_mut;

struct BumpAlloc {
    next: core::cell::UnsafeCell<usize>,
    end: usize,
}

unsafe impl Sync for BumpAlloc {}

unsafe impl GlobalAlloc for BumpAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        let next = &mut *self.next.get();
        let start = (*next + layout.align() - 1) & !(layout.align() - 1);
        if start + layout.size() > self.end {
            return null_mut();
        }
        *next = start + layout.size();
        start as *mut u8
    }
    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: Layout) {}
}

#[global_allocator]
static ALLOC: BumpAlloc = BumpAlloc {
    next: core::cell::UnsafeCell::new(0),
    end: 64 * 1024,
};

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

#[unsafe(no_mangle)]
pub extern "C" fn Reset() -> ! {
    loop {}
}
```

Measured in this environment: this file compiles with `rustc --target wasm32-unknown-unknown --emit=obj -C panic=abort`. Note that edition 2024 adds a new warning (`static_mut_refs`) for references to `static mut`; embedded code typically switches to `UnsafeCell` or `SyncCell` instead.

## Target platforms

Embedded targets are installed with `rustup target add`; for example, Cortex-M4F maps to `thumbv7em-none-eabihf`:

```bash
rustc --print target-list | grep thumbv7em
```

Actual run output (rustc 1.99.0 in this environment):

```text
thumbv7em-none-eabi
thumbv7em-none-eabihf
thumbv7em-nuttx-eabi
thumbv7em-nuttx-eabihf
```

Target naming rules: `thumbv7em` is the ARM Cortex-M architecture, `none` means no operating system, and `eabihf` means the embedded ABI with hardware floating point. Xtensa (the ESP32 family) targets currently must be installed with the `espup` tool and are not in rustup's official target list.

**Environment note**: `rustup target add thumbv7em-none-eabihf` was attempted twice and failed both times due to network problems (TLS handshake aborted), so **this page could not test compilation on that target**; the verification above covers only the host and wasm targets.

## HAL and Embassy / RTIC

- **HAL (Hardware Abstraction Layer)**: one crate per chip family (e.g. `stm32f4xx-hal`, `nrf52840-hal`), built on the `embedded-hal` traits. `embedded-hal` defines common traits for peripherals like SPI, I2C, and GPIO, letting driver code be reused across chips.
- **Embassy**: an async-friendly embedded runtime built on `async`/`await`. It provides its own executor (`embassy-executor`) and HAL integrations (e.g. `embassy-stm32`), handling peripherals in an async style and avoiding interrupt-callback hell.
- **RTIC**: Real-Time Interrupt-driven Concurrency, a concurrency framework based on hardware interrupts. It organizes code around tasks and schedules with the hardware NVIC, emphasizing determinism and low overhead.

Embassy and RTIC are both runtimes; the difference is the concurrency model: Embassy uses async tasks (cooperative), RTIC uses interrupt priorities (preemptive). The three (HAL, Embassy, RTIC) can be combined — for example `embassy-stm32` + `embassy-executor`.

**Environment note**: the `embassy-executor` and `rtic` crates can be pulled from crates.io (`cargo add` succeeded here), but without real hardware **flashing and running could not be tested**; this section is conceptual positioning only.

## References

- Official docs: *The Embedded Rust Book*: <https://docs.rust-embedded.org/book/>

## Related pages

- [WebAssembly](./wasm) — the other branch of OS-less targets.
- [Async](../async/) — the async foundations Embassy builds on.
- [memory-concurrency](../memory-concurrency/) — `UnsafeCell` and interior mutability.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
