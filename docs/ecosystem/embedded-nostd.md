# 嵌入式 Rust

嵌入式开发没有操作系统、没有堆、甚至没有 `main` 函数——Rust 通过 `#![no_std]` 把 std 从依赖里剥掉，只留平台无关的 `core`。这页讲清 `no_std` 之后还剩什么、入口怎么写、`alloc` 怎么加回来，以及 HAL 与 Embassy / RTIC 的生态定位。

## `#![no_std]`：去掉 std 还剩什么

`#![no_std]` 是 crate 级属性，表示链接到 `core` 而非 `std`。`core` 是平台无关的 std 子集：基本类型、切片、字符串、迭代器、原子操作都在，但**没有**文件、网络、线程、`println!`，也**没有**默认的内存分配器。

| 层 | 提供什么 | 依赖什么 |
|---|---|---|
| `core` | 基本类型、迭代器、切片、格式化 | 无 |
| `alloc` | `Box`、`Vec`、`String`、`BTreeMap` | 需要你提供 `#[global_allocator]` |
| `std` | 文件、网络、线程、`println!`、进程 | 操作系统 |

嵌入式程序通常只用 `core`；需要堆时引入 `alloc` 并自己写分配器。

## `#[no_main]` 与入口

没有 std 就没有运行时初始化，也就没有 `main`。`#![no_main]` 禁止生成 `main` 符号，入口由你自己在链接脚本里定义（裸机常见名是 `Reset`）：

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

`#[panic_handler]` 是 `no_std` 必需品：std 的 panic 处理没了，你得自己定义 panic 时做什么（裸机最常见的是死循环或复位）。

### 编译验证

`no_std` 单文件可以用纯 rustc 编译为对象文件，不需要链接器。本环境实测（rustc 1.99.0，目标是 `wasm32-unknown-unknown` 和宿主 `x86_64-unknown-linux-gnu` 均通过）：

```bash
rustc --target x86_64-unknown-linux-gnu --emit=obj -C panic=abort -o nostd.o src/main.rs
```

真实运行输出：

```text
exit: 0
nostd-linux.o: ELF 64-bit LSB relocatable, x86-64, version 1 (SYSV), not stripped
0000000000000000 T Reset
```

符号表里只有我们定义的 `Reset`，没有 `main`、没有 std 符号——std 确实被剥掉了。

## `#[global_allocator]`：最小 alloc

需要 `Box` / `Vec` 时，实现 `GlobalAlloc` trait 并标记 `#[global_allocator]`。嵌入式常用 bump 分配器（只分配不回收，实现极小）：

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

本环境实测：该文件用 `rustc --target wasm32-unknown-unknown --emit=obj -C panic=abort` 编译通过。注意 edition 2024 对 `static mut` 的引用有新警告（`static_mut_refs`），嵌入式代码里通常改用 `UnsafeCell` 或 `SyncCell`。

## 目标平台

嵌入式 target 用 `rustup target add` 安装，例如 Cortex-M4F 对应 `thumbv7em-none-eabihf`：

```bash
rustc --print target-list | grep thumbv7em
```

真实运行输出（本环境 rustc 1.99.0）：

```text
thumbv7em-none-eabi
thumbv7em-none-eabihf
thumbv7em-nuttx-eabi
thumbv7em-nuttx-eabihf
```

target 名规则：`thumbv7em` 是 ARM Cortex-M 架构，`none` 表示无操作系统，`eabihf` 表示带硬件浮点的嵌入式 ABI。Xtensa（ESP32 系列）target 目前需要用 `espup` 工具安装，不在 rustup 官方 target 列表里。

**本环境标注**：`rustup target add thumbv7em-none-eabihf` 尝试两次均因网络问题（TLS 握手中断）失败，因此**本页未能在该 target 上实测编译**，上述验证仅覆盖宿主与 wasm 目标。

## HAL 与 Embassy / RTIC

- **HAL（Hardware Abstraction Layer）**：每个芯片家族一个 crate（如 `stm32f4xx-hal`、`nrf52840-hal`），基于 `embedded-hal` trait。`embedded-hal` 定义了 SPI、I2C、GPIO 等外设的通用 trait，让驱动代码跨芯片复用。
- **Embassy**：异步友好的嵌入式运行时，基于 `async`/`await`。它提供自己的执行器（`embassy-executor`）和 HAL 集成（如 `embassy-stm32`），用 async 方式处理外设，避免中断回调地狱。
- **RTIC**：Real-Time Interrupt-driven Concurrency，基于硬件中断的并发框架。以任务为单位组织代码，用硬件 NVIC 做调度，强调确定性和低开销。

Embassy 与 RTIC 都是运行时，区别在并发模型：Embassy 用 async 任务（协作式），RTIC 用中断优先级（抢占式）。三者（HAL、Embassy、RTIC）可以组合使用，例如 `embassy-stm32` + `embassy-executor`。

**本环境标注**：`embassy-executor`、`rtic` crate 可以从 crates.io 拉取（本环境 `cargo add` 成功），但没有真实硬件，**无法实测烧录运行**，此处仅作概念定位。

## 参考资料

- 官方文档：《The Embedded Rust Book》：<https://docs.rust-embedded.org/book/>

## 相关页面

- [WebAssembly](./wasm)——同为无 OS 目标的另一分支。
- [异步](../async/)——Embassy 的 async 基础。
- [memory-concurrency](../memory-concurrency/)——`UnsafeCell` 与内部可变性。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
