# Rust vs C/C++

By **running the same logic once on each side**, this page shows how much of what in C/C++ can only be caught by convention and self-discipline Rust has moved into the compiler.

| Scenario | Rust (rustc 1.99.0) | C/C++ (gcc/g++ 15.2.0) |
| --- | --- | --- |
| Fixed index out of bounds `a[5]` (array length 3) | **Fails to compile**: `error: this operation will panic at runtime` | **Compiles** (exit 0); at runtime prints a garbage value `a[5] = -9065552` |
| Returning the address of a local variable | **Fails to compile**: `error[E0505] cannot move out of v because it is borrowed` | **Compiles**; at runtime **Segmentation fault** (exit 139) |
| Concurrent writes to a shared variable with no lock | **Fails to compile**: `error[E0499]` | **Compiles**; the standard classifies it as **undefined behavior** |
| Generic `a + b` missing a bound | **Fails to compile**, reported at the **definition site** | **Fails to compile**, reported at the **instantiation site** |

## Memory safety

### Out-of-bounds access: compile-time interception vs silent runtime overrun

On the Rust side, a constant index access into an array of length 3:

```rust
fn main() {
    let a = [1, 2, 3];
    println!("{}", a[5]);
}
```

Actual run output (`rustc r1_oob_array.rs`, failed):

```text
error: this operation will panic at runtime
 --> r1_oob_array.rs:3:20
  |
3 |     println!("{}", a[5]);
  |                    ^^^^ index out of bounds: the length is 3 but the index is 5
  |
  = note: `#[deny(unconditional_panic)]` on by default
```

Constant out-of-bounds is rejected outright at compile time. When the index is a runtime variable it degrades to a runtime **bounds check**, and no out-of-bounds read happens at all (after `rustc r2_oob_vec.rs`, run, exit 101):

```text
thread 'main' (21070) panicked at r2_oob_vec.rs:4:21:
index out of bounds: the len is 3 but the index is 5
```

On the C side the same logic (`int a[3] = {1,2,3}; printf("%d", a[5]);`) compiles with no flags, exit 0, and **zero warnings**:

```text
$ gcc c1_oob.c -o c1 && ./c1
a[5] = -9065552
```

Under `gcc -Wall -O2` it is still exit 0, with only one extra `warning: array subscript 5 is above array bounds`, and the runtime output becomes `a[5] = 0` — again, no error, an untrustworthy value. This gcc warning is on by default but **does not change the exit code** and will not stop `make`; in large projects warnings of this class usually get buried. Section 9.1 of *The Rust Programming Language* explicitly contrasts C's behavior: "In C, attempting to read data past the end of the data structure is undefined behavior... if an attacker can manipulate the index, this could become a security vulnerability."

### use-after-free: reference validity is part of the type

In Rust, continuing to use a reference after it has been freed is caught at compile time:

```rust
fn main() {
    let v = vec![1, 2, 3];
    let first = &v[0];
    drop(v);
    println!("first = {first}");
}
```

Actual run output (`rustc r3_use_after_free.rs`, failed, excerpt):

```text
error[E0505]: cannot move out of `v` because it is borrowed
 --> r3_use_after_free.rs:4:10
  |
2 |     let v = vec![1, 2, 3];
  |         - binding `v` declared here
3 |     let first = &v[0];
  |                  - borrow of `v` occurs here
4 |     drop(v);
  |          ^ move out of `v` occurs here
5 |     println!("first = {first}");
  |                        ----- borrow later used here
```

The equivalent C construction (returning the address of a local array) compiles with only one `warning: function returns address of local variable [-Wreturn-local-addr]`, then `Segmentation fault (core dumped)` at runtime (exit 139). Bugs of this class tend to show up as crashes, as reads of dirty data, or as behavior that "looks fine" under a particular layout; Rust points at "borrow later used here" at compile time and pins the responsibility to a source line.

> **Note**: the boundary of this guarantee is "safe Rust". The Rust Reference, *Behavior considered undefined*, is explicit: `unsafe` only transfers the responsibility of avoiding UB to the programmer; it does not permit UB itself to exist, and a Rust program must not exhibit any UB behavior listed on that page.

### Data races: compile-time prohibition vs undefined behavior

The C++ standard (draft [intro.races]) defines a data race as: two potentially concurrent actions access the same memory location, at least one is a write, and there is no happens-before relationship between the two; it further states that "**Any such data race results in undefined behavior**".

On the Rust side, two threads sharing the same `Vec` with no lock:

```rust
let mut v = vec![1, 2, 3];
let h1 = thread::spawn(|| v.push(4));
let h2 = thread::spawn(|| v.push(5));
h1.join().unwrap();
h2.join().unwrap();
```

Actual run output (`rustc r5_threads_share.rs`, failed, 4 errors in total):

```text
error[E0373]: closure may outlive the current function, but it borrows `v`, which is owned by the current function
error[E0499]: cannot borrow `v` as mutable more than once at a time
error[E0373]: closure may outlive the current function, but it borrows `v`, which is owned by the current function
error[E0502]: cannot borrow `v` as immutable because it is also borrowed as mutable
```

The error location for `E0499` points at the `F: Send + 'static` bound that `std::thread::spawn` requires — **the borrow checker rules "sharing mutable data across threads" straight out as illegal**. The correct form is `Arc<Mutex<Vec<_>>>`, and the type system guarantees that concurrent access is mutually exclusive.

On the C side, the same unsynchronized counter (each of two threads doing `counter++` 100,000 times) compiles cleanly with gcc -O2, and all 5 runs produced `counter = 200000 (expected 200000)`.

**Honest note**: lost updates did not reproduce on this machine. That is a typical manifestation of data-race UB — **whether it manifests depends on the platform, the scheduler, and the optimization level**, and this machine not blowing up does not mean the program is correct. The standard-level conclusion is unchanged: this code is undefined behavior. Set against Rust's `E0499`, the gap is obvious at a glance: C/C++ hands correctness to the programmer and code review, while Rust hands it to the compiler.

## Generics vs templates: errors reported at the definition or at instantiation

This is the **most substantive semantic difference** between Rust generics and C++ templates. On the Rust side, `add` written as `a + b` with no bound:

```rust
fn add<T>(a: T, b: T) -> T {
    a + b
}
```

Actual run output (`rustc r4_generic_add.rs`, failed):

```text
error[E0369]: cannot add `T` to `T`
 --> r4_generic_add.rs:2:7
  |
2 |     a + b
  |     - ^ - T
help: consider restricting type parameter `T` with trait `Add`
  |
1 | fn add<T: std::ops::Add<Output = T>>(a: T, b: T) -> T {
```

The error points at **line 2 of the definition**, and the compiler offers a fix — Rust finishes the check at **definition time** via trait bounds.

On the C++ side, instantiating the same template with a `Point` type that has no `operator+`, `g++ -std=c++17` reports:

```text
cpp1_template_err.cpp: In instantiation of ‘T add(T, T) [with T = Point]’:
cpp1_template_err.cpp:15:21:   required from here
cpp1_template_err.cpp:5:14: error: no match for ‘operator+’ (operand types are ‘Point’ and ‘Point’)
```

The error points at the **instantiation point** (the call on line 15), unwinding the template definition back through its internals. C++ templates are, at their core, a duck-typing check performed at instantiation time: the template itself is not thoroughly checked, and errors erupt "where they were used wrong" — which is also why template error messages are so often called "a mile long".

| Dimension | C++ templates | Rust generics |
| --- | --- | --- |
| When checked | At instantiation | At definition time (trait bound) |
| Polymorphism implementation | Monomorphization per instantiation; also virtual functions | Monomorphization by default; `dyn Trait` for explicit dynamic dispatch |
| Compile-time computation | Template metaprogramming / `constexpr` | `const fn` / const generics |
| Cost of dynamic dispatch | Indirect jump through the vtable | `dyn Trait` fat pointer (measured: `&dyn Shape` 16 bytes, `&Circle` 8 bytes) |

## Build and error handling

| Dimension | Rust | C | C++ |
| --- | --- | --- | --- |
| Build/dependencies | cargo (official: `Cargo.toml` declares, `Cargo.lock` pins, crates.io fetches, `cargo test` runs unit tests) | CMake/Make (build generators); no unified standard for dependencies (system packages / vcpkg / FetchContent) | Same as C |
| Error handling | `Result<T, E>` + `?`; forgetting to handle one triggers an `unused_must_use` warning | Return codes + the global `errno`; the return value can be discarded with no notice | Exceptions; `std::expected` since C++23 |
| Shape of errors | Errors are values; `?` is zero-cost | Errors are return codes, checked manually at every layer | Exceptions carry throw/unwind cost; `std::expected` is isomorphic to `Result` |

Measured on the Rust side (`rustc r8_result_question.rs`) the output is `Ok(42)` and `Err(ParseIntError { kind: InvalidDigit })`; C++23's `std::expected` compiled and ran cleanly with g++ 15.2.0 `-std=c++23`, outputting `7/2 = 3` / `err: division by zero`. Both treat errors as values rather than control-flow exceptions. C's return-code problem shows up in the measurements too: that out-of-bounds C program above returns code 0 — the error path and the success path are indistinguishable at the OS level.

## Notes and common pitfalls

- **C/C++ are not "unsafe" in the sense of unusable**: a great deal of system infrastructure is written in C/C++. The difference is the **default level of guarantee** — C/C++ lean on conventions, review, and static-analysis tools (ASan/UBSan) as a backstop; Rust turns the most common classes of errors directly into compile errors.
- **RAII is not exclusive to Rust**: C++ has RAII too. The difference is that Rust's ownership/lifetimes extend it to **every value**, and the borrow checker enforces that a reference cannot outlive its allocation.
- **Rust has an escape hatch as well**: `unsafe` lets you bypass the checks (FFI, low-level data structures, performance-critical paths), but it is "explicitly handing responsibility back to the programmer", not "turning off safety checks".
- **Template metaprogramming has no direct counterpart**: C++'s Turing-complete template metaprogramming is shared among `const fn`, const generics, and procedural macros in Rust, with different capability boundaries — do not expect a one-to-one mapping.

## References

- Official docs: *The Rust Reference* · Behavior considered undefined: <https://doc.rust-lang.org/reference/behavior-considered-undefined.html>

## Related pages

- [Rust vs Go](./vs-go) — the other axis of comparison: concurrency models and error handling.
- [Rust vs Java](./vs-java) — GC, generic erasure, and the object model.
- [Quick Comparison Table](./cheatsheet-table) — everything summarized dimension by dimension.
- [Ownership and move semantics](../language-core/ownership-and-move) — the foundation of Rust's memory model.
- [Lifetimes](../language-core/lifetimes) — the rules for annotating reference validity.
- [Generics and monomorphization](../language-core/generics-and-monomorphization) — trait bounds and the details of monomorphization.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
