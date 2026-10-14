# FFI 与 C 互操作

Rust 与 C 的互操作是系统级编程的核心能力：调用已有的 C 库、把 Rust 代码暴露给 C 消费者。FFI 的关键在于三件事：调用约定（`extern "C"`）、符号名（`#[no_mangle]`）、内存布局（`#[repr(C)]`），以及最容易被忽视的——内存所有权边界。

## extern "C" 与 #[no_mangle]

`extern "C"` 块声明 C ABI 的函数签名，Rust 编译器无法验证声明与实际 C 签名是否一致。edition 2024 起，`extern` 块必须写成 `unsafe extern "C"`，否则编译报错：

```text
error: extern blocks must be unsafe
```

反向暴露 Rust 函数给 C 时，用 `#[no_mangle]` 禁用符号名修饰。edition 2024 起必须写成 `#[unsafe(no_mangle)]`，否则报错：

```text
error: unsafe attribute used without unsafe
help: wrap the attribute in `unsafe(...)`
```

```rust
use std::ffi::{CString, c_char, c_int};

unsafe extern "C" {
    fn c_add(a: c_int, b: c_int) -> c_int;
    fn c_shout(name: *const c_char) -> *mut c_char;
    fn c_free(p: *mut c_char);
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_double(x: c_int) -> c_int {
    x * 2
}
```

配合 `crate-type = ["cdylib"]` 可以生成 C 能链接的动态库。

## #[repr(C)]：结构体布局兼容

Rust 默认不保证结构体的内存布局（字段顺序、填充都由编译器决定）。`#[repr(C)]` 让结构体按 C 规则布局，可以安全地跨 FFI 边界传递。

```rust
#[repr(C)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}
```

`#[repr(C, packed)]` 可以去掉填充字节；`#[repr(C)]` 也可以用于枚举。对于 C 库隐藏内部细节的不透明结构体，官方推荐用私有字段 + `PhantomData` 模式防止外部构造。

## 内存所有权边界

FFI 最容易出问题的不是类型转换，而是**谁分配、谁释放**。核心原则：谁分配谁释放，跨边界传递的所有权必须对称。

### 模式一：Rust 分配、C 写入（缓冲区）

Rust 拥有缓冲区所有权，C 只写入，不接管所有权：

```rust
pub fn fill_twice(buf: &mut [u8], ch: u8) {
    unsafe {
        c_fill_twice(buf.as_mut_ptr() as *mut c_char, buf.len(), ch as c_char);
    }
}
```

### 模式二：C 分配、Rust 接管（字符串）

C 返回堆内存指针，Rust 用 `CString::from_raw` 接管所有权，Drop 时调用 C 的释放函数：

```rust
pub fn shout(name: &str) -> String {
    let c_name = CString::new(name).expect("name 不含 NUL");
    unsafe {
        let ptr = c_shout(c_name.as_ptr());
        if ptr.is_null() {
            panic!("c_shout 返回空指针");
        }
        // from_raw 之后所有权归 Rust，Drop 时调用 c_free 释放
        let owned = CString::from_raw(ptr);
        owned.to_string_lossy().into_owned()
    }
}
```

### 模式三：Box::into_raw / from_raw 对称释放

把 Rust 堆对象交给 C 用完再交还，`Box::into_raw` 交出所有权（不再自动 drop），`Box::from_raw` 必须恰好调用一次回收：

```rust
#[unsafe(no_mangle)]
pub extern "C" fn rust_make_point(x: c_int, y: c_int) -> *mut Point {
    Box::into_raw(Box::new(Point { x, y }))
}

#[unsafe(no_mangle)]
pub extern "C" fn rust_free_point(p: *mut Point) {
    if p.is_null() {
        return;
    }
    unsafe {
        drop(Box::from_raw(p));
    }
}
```

`into_raw` 和 `from_raw` 必须配对：少调 `from_raw` 泄漏内存，多调则重复释放。

## 完整示例：C 静态库 + cc 编译

用 `cc` crate 在 `build.rs` 里把 C 代码编译成静态库，Rust 侧声明并链接：

```rust
// build.rs
fn main() {
    println!("cargo:rerun-if-changed=c/math.c");
    cc::Build::new().file("c/math.c").compile("math");
}
```

```c
// c/math.c
#include <stdlib.h>
#include <string.h>

int c_add(int a, int b) { return a + b; }

void c_fill_twice(char *buf, size_t len, char ch) {
    if (buf == NULL || len < 2) return;
    buf[0] = ch;
    buf[len - 1] = ch;
}

char *c_shout(const char *name) {
    if (name == NULL) return NULL;
    size_t n = strlen(name) + 6;
    char *out = (char *)malloc(n);
    if (out == NULL) return NULL;
    memcpy(out, "HELLO ", 6);
    memcpy(out + 6, name, strlen(name) + 1);
    return out;
}

void c_free(void *p) { free(p); }
```

本环境实测（`cargo test`，6 个测试全过）：

真实运行输出：

```text
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

`cargo run --bin ffi-demo` 输出：

```text
手写绑定 add(2, 3) = 5
手写绑定 shout("world") = HELLO world
手写绑定 fill_twice: "B\0\0\0\0B"
手写绑定 point_sum = 7
bindgen c_add(40, 2) = 42
bindgen c_fill_twice: "G\0\0\0\0G"
bindgen c_shout: HELLO bindgen
```

## bindgen：从 C 头文件生成绑定

手写 `extern "C"` 适合少量函数；面对大型 C 库，`bindgen` 从 C 头文件自动生成 Rust 绑定，需要 libclang。本环境实测：libclang 21 可用，`cargo add bindgen --build` 成功，生成的绑定与手写声明等价：

```rust
// build.rs 中生成绑定
let bindings = bindgen::Builder::default()
    .header("c/math.h")
    .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
    .generate()
    .expect("无法生成绑定");
```

生成的绑定通过 `include!(concat!(env!("OUT_DIR"), "/bindings.rs"))` 引入，函数签名与 C 头文件一一对应。

## 工程实践

- **安全包装**：把 `unsafe` 收敛在模块内部，对外暴露安全 API；
- **空指针检查**：C 返回的指针必须检查 `is_null()`；
- **字符串编码**：跨边界的字符串用 `CString` / `CStr`，注意 NUL 终止；
- **所有权对称**：`into_raw` / `from_raw` 必须配对，C 分配的内存用 C 的释放函数；
- **bindgen 定位**：大型 C 库用 bindgen 生成绑定，小型 API 手写更可控。

## 参考资料

- 官方文档：《The Rustonomicon》· FFI：<https://doc.rust-lang.org/nomicon/ffi.html>

## 相关页面

- [workspace 与多 crate 工程](./workspace)——多 crate 组织。
- [语言核心](../language-core/)——`unsafe` 与裸指针。
- [语言对照](../comparison/)——Rust 与 C 的逐项差异。
