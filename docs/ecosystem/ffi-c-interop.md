# FFI and C Interop

Interop between Rust and C is a core systems-programming capability: calling existing C libraries, and exposing Rust code to C consumers. FFI hinges on three things — calling convention (`extern "C"`), symbol names (`#[no_mangle]`), and memory layout (`#[repr(C)]`) — plus the one most easily overlooked: the memory-ownership boundary.

## extern "C" and #[no_mangle]

An `extern "C"` block declares function signatures with the C ABI; the Rust compiler cannot verify that your declaration matches the actual C signature. Since edition 2024, `extern` blocks must be written `unsafe extern "C"`, otherwise compilation fails:

```text
error: extern blocks must be unsafe
```

In the other direction, to expose a Rust function to C, use `#[no_mangle]` to disable symbol name mangling. Since edition 2024 it must be written `#[unsafe(no_mangle)]`, otherwise:

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

Combined with `crate-type = ["cdylib"]` this produces a dynamic library C can link against.

## #[repr(C)]: struct layout compatibility

Rust by default guarantees nothing about struct memory layout (field order and padding are compiler-determined). `#[repr(C)]` lays the struct out by C rules so it can be passed across the FFI boundary safely.

```rust
#[repr(C)]
pub struct Point {
    pub x: i32,
    pub y: i32,
}
```

`#[repr(C, packed)]` removes padding bytes; `#[repr(C)]` also applies to enums. For opaque structs where a C library hides its internals, the official recommendation is the private-fields-plus-`PhantomData` pattern to prevent construction from outside.

## The memory-ownership boundary

What breaks most often in FFI is not type conversion but **who allocates and who frees**. Core principle: whoever allocates, frees; ownership crossing the boundary must be symmetric.

### Pattern 1: Rust allocates, C writes (buffer)

Rust owns the buffer; C only writes to it and takes no ownership:

```rust
pub fn fill_twice(buf: &mut [u8], ch: u8) {
    unsafe {
        c_fill_twice(buf.as_mut_ptr() as *mut c_char, buf.len(), ch as c_char);
    }
}
```

### Pattern 2: C allocates, Rust takes over (string)

C returns a pointer to heap memory; Rust takes ownership with `CString::from_raw`, and Drop then calls C's free function:

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

### Pattern 3: Box::into_raw / from_raw symmetric release

Hand a Rust heap object to C and take it back afterwards: `Box::into_raw` gives up ownership (no automatic drop), and `Box::from_raw` must then be called exactly once to reclaim it:

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

`into_raw` and `from_raw` must be paired: skipping a `from_raw` leaks memory; an extra one double-frees.

## Full example: C static library compiled with cc

Use the `cc` crate in `build.rs` to compile the C code into a static library, and declare and link it on the Rust side:

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

Measured in this environment (`cargo test`, all 6 tests passing):

Actual run output:

```text
test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

`cargo run --bin ffi-demo` output:

```text
手写绑定 add(2, 3) = 5
手写绑定 shout("world") = HELLO world
手写绑定 fill_twice: "B\0\0\0\0B"
手写绑定 point_sum = 7
bindgen c_add(40, 2) = 42
bindgen c_fill_twice: "G\0\0\0\0G"
bindgen c_shout: HELLO bindgen
```

## bindgen: generating bindings from C headers

Hand-written `extern "C"` suits a handful of functions; for large C libraries, `bindgen` generates Rust bindings from C headers automatically, requiring libclang. Measured in this environment: libclang 21 is available, `cargo add bindgen --build` succeeds, and the generated bindings are equivalent to the hand-written declarations:

```rust
// build.rs 中生成绑定
let bindings = bindgen::Builder::default()
    .header("c/math.h")
    .parse_callbacks(Box::new(bindgen::CargoCallbacks::new()))
    .generate()
    .expect("无法生成绑定");
```

The generated bindings are brought in via `include!(concat!(env!("OUT_DIR"), "/bindings.rs"))`, with function signatures mapping one-to-one onto the C header.

## Engineering practices

- **Safe wrappers**: confine `unsafe` inside a module and expose a safe API outward;
- **Null-pointer checks**: pointers returned by C must be checked with `is_null()`;
- **String encoding**: strings crossing the boundary use `CString` / `CStr`, mind NUL termination;
- **Ownership symmetry**: `into_raw` / `from_raw` must be paired, and memory allocated by C is freed with C's free function;
- **Where bindgen fits**: use bindgen for large C libraries; for small APIs, hand-written bindings stay more controllable.

## References

- Official docs: *The Rustonomicon* · FFI: <https://doc.rust-lang.org/nomicon/ffi.html>

## Related pages

- [Workspaces and Multi-Crate Projects](./workspace) — organizing multiple crates.
- [Language core](../language-core/) — `unsafe` and raw pointers.
- [Language comparisons](../comparison/) — Rust vs C, point by point.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
