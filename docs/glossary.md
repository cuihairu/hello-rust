---
title: Glossary
layout: page
---

# Glossary

Within a single language, "ownership" means something entirely different in Rust than in C++, and "zero-cost" points at different things across different topics. This page collects the core terms of the site's eight topics, giving each a unified definition, its home topic, and a link back to the source. It is searchable and can also be browsed by topic.

The **Source** links in each entry point to officially documented material that has been verified working with curl (The Rust Programming Language, The Rust Reference, The Cargo Book, the std docs, the Tokio tutorial, and so on). Entries with no authoritative source get no link — a guess is never used in place of a citation.

## Maintenance policy

New entries must provide a clickable authoritative source (verified working first). If none can be found, write "no authoritative source found (pending verification)" — do not invent links from memory. The chapter title in a source link is always taken from the page's actual `<title>` as verified, never hand-guessed.

## Language Core

### Ownership

Every value has exactly one owner at any moment; assignment and argument passing move ownership by default, and the value is dropped when the owner leaves scope.

**Source**: ["The Rust Programming Language" · What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html), [std · Drop in std::ops](https://doc.rust-lang.org/std/ops/trait.Drop.html)

**Related**: `language-core/ownership-and-move`, `memory-concurrency/drop-and-destructors`

### Borrowing

Use a value through a reference without transferring ownership; at any moment you have either multiple shared references `&T` or a single mutable reference `&mut T`.

**Source**: ["The Rust Programming Language" · References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html), ["The Rust Reference" · Visibility and privacy](https://doc.rust-lang.org/reference/visibility-and-privacy.html)

**Related**: `language-core/borrowing-and-references`, `memory-concurrency/interior-mutability`

### Slice

A view over a run of contiguous memory, represented as a fat pointer of "pointer + length", which owns no data.

**Source**: ["The Rust Programming Language" · The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html), [std · slice](https://doc.rust-lang.org/std/primitive.slice.html)

**Related**: `language-core/slices-and-str`

### Lifetime

Annotates the validity constraints between references; `'static` means valid for the whole program and is the upper bound required for trait objects.

**Source**: ["The Rust Programming Language" · Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html), ["The Rust Reference" · Trait and lifetime bounds](https://doc.rust-lang.org/reference/trait-bounds.html)

**Related**: `language-core/lifetimes`, `type-system/trait-objects`

### Struct

A named or anonymous data structure; named fields are accessed by name, and fields may be tuple-style or named-style.

**Source**: ["The Rust Programming Language" · Defining and Instantiating Structs](https://doc.rust-lang.org/book/ch05-01-defining-structs.html)

**Related**: `language-core/ownership-and-move`, `memory-concurrency/smart-pointers`

### Enum

An algebraic data type: each variant may carry data, and `match` forces you to exhaust every possible path.

**Source**: ["The Rust Programming Language" · Defining an Enum](https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html)

**Related**: `language-core/enums-and-pattern-matching`

### Pattern Matching

A structured value-extraction mechanism used by `match`, `if let`, `while let`, destructuring in `let`, and destructuring in loops.

**Source**: ["The Rust Programming Language" · The match Control Flow Construct](https://doc.rust-lang.org/book/ch06-02-match.html), ["The Rust Programming Language" · Concise Control Flow with if let and let...else](https://doc.rust-lang.org/book/ch06-03-if-let.html), ["The Rust Programming Language" · All the Places Patterns Can Be Used](https://doc.rust-lang.org/book/ch19-01-all-the-places-for-patterns.html)

**Related**: `language-core/enums-and-pattern-matching`

### trait

An abstract interface defining method signatures and associated items; `impl Trait for Type` supplies the behavior, and trait bounds constrain generics.

**Source**: ["The Rust Programming Language" · Defining Shared Behavior with Traits](https://doc.rust-lang.org/book/ch10-02-traits.html), [Rust Blog · Abstraction without overhead: traits in Rust](https://blog.rust-lang.org/2015/05/11/traits/)

**Related**: `language-core/traits`, `type-system/associated-types`

### Generics and Monomorphization

At compile time, generics emit a specialized copy of the code for each concrete type, adding zero overhead at runtime.

**Source**: ["The Rust Programming Language" · Generic Types, Traits, and Lifetimes](https://doc.rust-lang.org/book/ch10-00-generics.html), ["The Rust Programming Language" · Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)

**Related**: `language-core/generics-and-monomorphization`, `type-system/zero-cost-abstraction`

### Error Handling

`Result` expresses recoverable errors, `Option` expresses presence or absence, and `panic!` expresses unrecoverable errors; `?` propagates upward within a function.

**Source**: ["The Rust Programming Language" · Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html), ["The Rust Programming Language" · Recoverable Errors with Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html), [std · Result in std::result](https://doc.rust-lang.org/std/result/enum.Result.html), [std · Option in std::option](https://doc.rust-lang.org/std/option/enum.Option.html)

**Related**: `language-core/error-handling`

### Package and Crate

A package is the build and publish unit, while a crate is the compilation unit; one package may contain several crates (including library and binary targets).

**Source**: ["The Rust Programming Language" · Packages and Crates](https://doc.rust-lang.org/book/ch07-01-packages-and-crates.html), ["The Rust Programming Language" · Control Scope and Privacy with Modules](https://doc.rust-lang.org/book/ch07-02-defining-modules-to-control-scope-and-privacy.html)

**Related**: `ecosystem/workspace`, `ecosystem/publish-crate`

### Copy trait

A marker auto-trait that flags "copy bitwise rather than move"; a type implementing `Copy` cannot also implement `Drop`.

**Source**: [std · Copy in std::marker](https://doc.rust-lang.org/std/marker/trait.Copy.html), ["The Rust Programming Language" · What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)

**Related**: `language-core/ownership-and-move`, `memory-concurrency/drop-and-destructors`

## Type Systems & Abstractions

### Trait Object / dyn Trait

An abstraction over "any type satisfying this trait", expressed as a fat pointer (data pointer + vtable); it requires `'static` and object safety.

**Source**: ["The Rust Programming Language" · Using Trait Objects to Abstract over Shared Behavior](https://doc.rust-lang.org/book/ch18-02-trait-objects.html), ["The Rust Reference" · Traits](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility), ["The Rust Reference" · Trait object types](https://doc.rust-lang.org/reference/types/trait-object.html)

**Related**: `type-system/trait-objects`, `language-core/traits`

### Dynamic Dispatch

A method call dispatched through a vtable lookup at runtime, the opposite trade from the static dispatch of generics — trading binary size for flexibility.

**Source**: ["The Rust Programming Language" · Performance in Loops vs. Iterators](https://doc.rust-lang.org/book/ch13-04-performance.html)

**Related**: `type-system/trait-objects`, `type-system/zero-cost-abstraction`

### dyn Compatibility

Whether a trait can be used as `dyn Trait` depends on object safety: methods may not be generic, may not return `impl Trait`, and so on.

**Source**: ["The Rust Reference" · Traits](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility), ["The Rust Programming Language" · Using Trait Objects to Abstract over Shared Behavior](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)

**Related**: `type-system/trait-objects`, `type-system/associated-types`

### Associated Type

A single type placeholder declared in a trait, such that each implementation has only one value for something like `Item`.

**Source**: ["The Rust Programming Language" · Advanced Traits](https://doc.rust-lang.org/book/ch20-02-advanced-traits.html)

**Related**: `type-system/associated-types`, `language-core/traits`

### Zero-cost Abstraction

High-level abstractions produce no extra runtime cost after compilation; the original traits blog post is titled on exactly this idea.

**Source**: [Rust Blog · Abstraction without overhead: traits in Rust](https://blog.rust-lang.org/2015/05/11/traits/), ["The Rust Programming Language" · Performance in Loops vs. Iterators](https://doc.rust-lang.org/book/ch13-04-performance.html)

**Related**: `type-system/zero-cost-abstraction`

### Orphan Rule

Writing an impl for an "external trait + external type" is forbidden, so that new implementations in different crates cannot conflict (E0117).

**Source**: ["The Rust Reference" · Implementations](https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules)

**Related**: `type-system/orphan-rule-and-newtype`

### Newtype

Wrap an external type in a single-field new type, which both satisfies the orphan rule and buys extra type safety.

**Source**: ["The Rust Programming Language" · Advanced Types](https://doc.rust-lang.org/book/ch20-03-advanced-types.html)

**Related**: `type-system/orphan-rule-and-newtype`

### impl Trait

In argument position it is equivalent to an anonymous generic parameter with static dispatch at compile time; in return position it hides the concrete type.

**Source**: ["The Rust Reference" · Impl trait type](https://doc.rust-lang.org/reference/types/impl-trait.html), ["The Rust Programming Language" · Advanced Functions and Closures](https://doc.rust-lang.org/book/ch20-04-advanced-functions-and-closures.html)

**Related**: `type-system/impl-trait`

### Operator Overloading

Implementing traits such as `Add` or `Index` from `std::ops` overloads the corresponding operator; `Deref` drives automatic dereferencing.

**Source**: [std · std::ops](https://doc.rust-lang.org/std/ops/), ["The Rust Programming Language" · Treating Smart Pointers Like Regular References](https://doc.rust-lang.org/book/ch15-02-deref.html), [std · Deref in std::ops](https://doc.rust-lang.org/std/ops/trait.Deref.html)

**Related**: `type-system/operator-overloading`, `memory-concurrency/smart-pointers`

### Closures and Fn Traits

Anonymous functions that capture their environment; `Fn` captures read-only, `FnMut` captures mutably, and `FnOnce` may move captures, while `move` forces capture by value.

**Source**: ["The Rust Programming Language" · Closures](https://doc.rust-lang.org/book/ch13-01-closures.html), [std · Fn in std::ops](https://doc.rust-lang.org/std/ops/trait.Fn.html), [std · FnMut in std::ops](https://doc.rust-lang.org/std/ops/trait.FnMut.html), [std · FnOnce in std::ops](https://doc.rust-lang.org/std/ops/trait.FnOnce.html)

**Related**: `type-system/closures-and-fn-trait-family`

### Type Erasure

Hiding heterogeneous concrete types behind a single runtime representation; Rust does this with `dyn Trait` + vtable, whereas Java generics erase types at the bytecode level.

**Source**: ["The Rust Reference" · Trait object types](https://doc.rust-lang.org/reference/types/trait-object.html), [Java Tutorials · Type Erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html)

**Related**: `type-system/trait-objects`, `comparison/vs-java`

## Memory & Concurrency

### Destruction and Drop

Values are destructed in reverse declaration order when they leave scope; implementing `Drop` customizes the cleanup logic.

**Source**: ["The Rust Programming Language" · Running Code on Cleanup with the Drop Trait](https://doc.rust-lang.org/book/ch15-03-drop.html), [std · Drop in std::ops](https://doc.rust-lang.org/std/ops/trait.Drop.html)

**Related**: `memory-concurrency/drop-and-destructors`

### Smart Pointer

A pointer type implementing `Deref`; `Box` gives sole ownership on the heap, `Rc`/`Arc` share reference counts, and `Weak` does not count as a strong reference.

**Source**: ["The Rust Programming Language" · Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html), ["The Rust Programming Language" · Using Box&lt;T&gt; to Point to Data on the Heap](https://doc.rust-lang.org/book/ch15-01-box.html), [std · Box in std::boxed](https://doc.rust-lang.org/std/boxed/struct.Box.html)

**Related**: `memory-concurrency/smart-pointers`

### Reference Counting

`Rc` shares ownership within one thread, while `Arc` shares it across threads; strong references forming a cycle never reach zero, so `Weak` is needed to break the cycle.

**Source**: ["The Rust Programming Language" · Rc&lt;T&gt;, the Reference Counted Smart Pointer](https://doc.rust-lang.org/book/ch15-04-rc.html), ["The Rust Programming Language" · Reference Cycles Can Leak Memory](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html), [std · Arc in std::sync](https://doc.rust-lang.org/std/sync/struct.Arc.html), [std · Weak in std::sync](https://doc.rust-lang.org/std/sync/struct.Weak.html)

**Related**: `memory-concurrency/smart-pointers`

### Interior Mutability

Mutate internal state through `&self`, deferring the borrow check to runtime; `Cell` replaces the value wholesale, while `RefCell` tracks borrows at runtime with reference counting.

**Source**: ["The Rust Programming Language" · RefCell&lt;T&gt; and the Interior Mutability Pattern](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html), [std · Cell in std::cell](https://doc.rust-lang.org/std/cell/struct.Cell.html), [std · RefCell in std::cell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)

**Related**: `memory-concurrency/interior-mutability`

### Send and Sync

Auto traits, derived from the composition of fields; `Send` means a value can be moved across threads, while `Sync` means `&T` can be shared across threads.

**Source**: ["The Rust Programming Language" · Extensible Concurrency with Send and Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html), [std · Send in std::marker](https://doc.rust-lang.org/std/marker/trait.Send.html), [std · Sync in std::marker](https://doc.rust-lang.org/std/marker/trait.Sync.html), ["The Rustonomicon" · Send and Sync](https://doc.rust-lang.org/nomicon/send-and-sync.html)

**Related**: `memory-concurrency/send-and-sync`, `memory-concurrency/threads-and-channels`

### Fearless Concurrency

Ownership and the type system rule out data races at compile time, so writing cross-thread code needs no manual reasoning about locking.

**Source**: ["The Rust Programming Language" · Fearless Concurrency](https://doc.rust-lang.org/book/ch16-00-concurrency.html)

**Related**: `memory-concurrency/threads-and-channels`

### Threads and Message Passing

`std::thread` spawns threads and `mpsc` channels move data between them; sending a value transfers ownership.

**Source**: ["The Rust Programming Language" · Using Threads to Run Code Simultaneously](https://doc.rust-lang.org/book/ch16-01-threads.html), ["The Rust Programming Language" · Transfer Data Between Threads with Message Passing](https://doc.rust-lang.org/book/ch16-02-message-passing.html), [std · std::thread](https://doc.rust-lang.org/std/thread/index.html), [std · std::sync::mpsc](https://doc.rust-lang.org/std/sync/mpsc/index.html)

**Related**: `memory-concurrency/threads-and-channels`

### Shared State

Sharing mutable state across threads uses `Mutex` or `RwLock`; the guard object is bound to the same lifetime as the lock it came from.

**Source**: ["The Rust Programming Language" · Shared-State Concurrency](https://doc.rust-lang.org/book/ch16-03-shared-state.html), [std · Mutex in std::sync](https://doc.rust-lang.org/std/sync/struct.Mutex.html), [std · RwLock in std::sync](https://doc.rust-lang.org/std/sync/struct.RwLock.html)

**Related**: `memory-concurrency/threads-and-channels`

### Atomics

`std::sync::atomic` provides lock-free atomic integer operations and memory-ordering control.

**Source**: [std · std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html), ["The Rust Programming Language" · Extensible Concurrency with Send and Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html)

**Related**: `memory-concurrency/send-and-sync`

### Unsafe and UB

`unsafe` unlocks five categories of operations the compiler cannot verify; the Reference spells out an explicit list of "undefined behavior".

**Source**: ["The Rust Programming Language" · Unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html), ["The Rust Reference" · The unsafe keyword](https://doc.rust-lang.org/reference/unsafe-keyword.html), ["The Rust Reference" · Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html), ["The Rustonomicon" · Introduction](https://doc.rust-lang.org/nomicon/)

**Related**: `ecosystem/ffi-c-interop`, `memory-concurrency/custom-allocator`

## Async

### Future

Represents a computation that may complete in the future; `poll` returns `Ready(T)` or `Pending`, and nothing progresses until it is polled.

**Source**: [std · Future in std::future](https://doc.rust-lang.org/std/future/trait.Future.html), ["The Rust Programming Language" · Futures and the Async Syntax](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html)

**Related**: `async/async-await-and-future`

### async / await

`async fn` builds a Future, and `await` is a suspend-resume state transition that does not block the thread.

**Source**: ["The Rust Programming Language" · Futures and the Async Syntax](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html), ["The Rust Programming Language" · Applying Concurrency with Async](https://doc.rust-lang.org/book/ch17-02-concurrency-with-async.html)

**Related**: `async/async-await-and-future`

### Executor

The layer of code that repeatedly calls `poll` to drive Futures forward; `block_on` is the simplest executor.

**Source**: [async-book · Applied: Build an Executor](https://rust-lang.github.io/async-book/02_execution/04_executor.html), [std · std::task](https://doc.rust-lang.org/std/task/index.html)

**Related**: `async/executors-and-runtime`

### Waker

A handle into the wake-up registry: after a Future returns `Pending`, the executor uses it to schedule another poll.

**Source**: [std · Waker in std::task](https://doc.rust-lang.org/std/task/struct.Waker.html), [async-book · Runtimes](https://rust-lang.github.io/async-book/part-guide/runtimes.html)

**Related**: `async/executors-and-runtime`, `async/pin-and-self-reference`

### Pin and Self-Referential

`Pin` guarantees that the pointee is never moved, which is what keeps async state machines safe; `Unpin` types carry no such constraint.

**Source**: [std · std::pin](https://doc.rust-lang.org/std/pin/index.html), [async-book · Concurrent programming](https://rust-lang.github.io/async-book/part-guide/concurrency.html)

**Related**: `async/pin-and-self-reference`

### Select and Cancellation

`select!` takes whichever branch completes first and drops the rest, which is the basis for cooperative cancellation.

**Source**: [Tokio · Select | Tokio](https://tokio.rs/tokio/tutorial/select)

**Related**: `async/select-and-cancellation`

### Multi-threaded Runtime

Runtimes such as Tokio poll tasks in parallel across a pool of worker threads, which requires the `Send` bound.

**Source**: [Tokio · Shared state | Tokio](https://tokio.rs/tokio/tutorial/shared-state), [Tokio · Spawning | Tokio](https://tokio.rs/tokio/tutorial/spawning)

**Related**: `async/tokio-ecosystem`, `async/executors-and-runtime`

### Tokio

The de facto standard async runtime, providing `spawn`, timers, synchronization primitives, and channels.

**Source**: [Tokio · Tutorial | Tokio](https://tokio.rs/tokio/tutorial), [Tokio · Channels | Tokio](https://tokio.rs/tokio/tutorial/channels), [Tokio · Streams | Tokio](https://tokio.rs/tokio/tutorial/streams)

**Related**: `async/tokio-ecosystem`

### Traits for Async

`async fn` in traits and `trait_variant` make it possible to use async methods through generics and trait objects.

**Source**: ["The Rust Programming Language" · A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html), ["The Rust RFC Book" · 3185-static-async-fn-in-trait](https://rust-lang.github.io/rfcs/3185-static-async-fn-in-trait.html)

**Related**: `async/async-send-and-async-trait`, `language-core/traits`

## Macros

### Declarative Macros / macro_rules!

A compile-time macro that rewrites code by matching tokens, introducing no runtime abstraction.

**Source**: ["The Rust Programming Language" · Macros](https://doc.rust-lang.org/book/ch20-05-macros.html), ["The Rust Reference" · Macros by example](https://doc.rust-lang.org/reference/macros-by-example.html)

**Related**: `macros/declarative-macros`

### Procedural Macros

A compiler plugin implemented in Rust code, running at compile time and able to parse an arbitrary token stream.

**Source**: ["The Rust Reference" · Procedural macros](https://doc.rust-lang.org/reference/procedural-macros.html), ["The Rust Programming Language" · Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)

**Related**: `macros/proc-macros`

## Toolchain & Engineering

### Cargo

The official build and dependency management tool, unifying building, testing, documentation, and publishing in one workflow.

**Source**: ["The Cargo Book" · Introduction](https://doc.rust-lang.org/cargo/), ["The Cargo Book" · cargo build](https://doc.rust-lang.org/cargo/commands/cargo-build.html)

**Related**: `tooling/cargo-workflow`

### rustup

The official toolchain manager, responsible for installing and switching toolchains, components, and targets.

**Source**: [rustup book · Introduction](https://rust-lang.github.io/rustup/), [rustup book · Toolchains](https://rust-lang.github.io/rustup/concepts/toolchains.html), [rustup book · Components](https://rust-lang.github.io/rustup/concepts/components.html)

**Related**: `tooling/rustup-msrv`

### rustfmt

The official formatter; its configuration comes from `rustfmt.toml` or `.rustfmt.toml`.

**Source**: [rustfmt](https://rust-lang.github.io/rustfmt/), [rustfmt · Configurations.md](https://github.com/rust-lang/rustfmt/blob/master/Configurations.md)

**Related**: `tooling/rustfmt-style`

### Clippy

The official lint collection, covering style, easy-to-make mistakes, and code smells; `clone_on_copy`, `ptr_arg`, and the like are among the most frequent hits.

**Source**: ["The Cargo Book" · cargo clippy](https://doc.rust-lang.org/cargo/commands/cargo-clippy.html), [Clippy Lints · clone_on_copy](https://rust-lang.github.io/rust-clippy/master/index.html#clone_on_copy), [Clippy Lints · ptr_arg](https://rust-lang.github.io/rust-clippy/master/index.html#ptr_arg), [Clippy Lints · cognitive_complexity](https://rust-lang.github.io/rust-clippy/master/index.html#cognitive_complexity)

**Related**: `tooling/clippy-lints`

### rust-analyzer

The officially recommended LSP language server, providing completions, go-to-definition, and inline diagnostics.

**Source**: [rust-analyzer](https://rust-analyzer.github.io/)

**Related**: `tooling/rust-analyzer-editor`

### Cargo Test and Doc Test

`cargo test` runs unit tests and doc tests, while `cargo doc` generates documentation and verifies the example code.

**Source**: ["The Cargo Book" · cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html), ["The Cargo Book" · cargo doc](https://doc.rust-lang.org/cargo/commands/cargo-doc.html)

**Related**: `tooling/cargo-workflow`

### workspace

Several packages that share a single `Cargo.lock` and target directory, unifying dependencies and builds.

**Source**: ["The Rust Programming Language" · Cargo Workspaces](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html), ["The Cargo Book" · Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)

**Related**: `ecosystem/workspace`

### Publishing to crates.io

`cargo publish` packages and uploads; before publishing you must fill in the package metadata and pass the documentation and test checks.

**Source**: ["The Rust Programming Language" · Publishing a Crate to Crates.io](https://doc.rust-lang.org/book/ch14-02-publishing-to-crates-io.html), ["The Cargo Book" · Publishing on crates.io](https://doc.rust-lang.org/cargo/reference/publishing.html), ["The Cargo Book" · cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html), [docs.rs](https://docs.rs/)

**Related**: `ecosystem/publish-crate`

### Cross Compilation

Compile for other architectures via target triples; the standard library for a target is installed as a rustup component.

**Source**: [rustc book · Platform Support](https://doc.rust-lang.org/rustc/platform-support.html), ["The Rust Programming Language" · Appendix G · How Rust is Made and "Nightly Rust"](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html)

**Related**: `memory-concurrency/cross-compilation`, `tooling/cross-compilation-practice`

### edition

A compatibility layer for language versions: the same code switches semantics by edition, allowing evolution without breaking existing code.

**Source**: ["The Rust Edition Guide" · Introduction](https://doc.rust-lang.org/edition-guide/), ["The Rust Programming Language" · Appendix E · Editions](https://doc.rust-lang.org/book/appendix-05-editions.html)

**Related**: `tooling/rustup-msrv`, `type-system/closures-and-fn-trait-family`

## Ecosystem & Cross-Language

### no_std

An optional environment without the standard library, in which `core`/`alloc` and a self-supplied `#[global_allocator]` take its place.

**Source**: [Embedded Book · Introduction](https://docs.rust-embedded.org/book/intro/index.html), [std · GlobalAlloc in std::alloc](https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html)

**Related**: `ecosystem/embedded-nostd`, `memory-concurrency/custom-allocator`

### FFI and C Interop

`extern "C"` declares the ABI, while `unsafe` transfers ownership across the boundary; the Nomicon sets out the practical conventions.

**Source**: ["The Rustonomicon" · FFI](https://doc.rust-lang.org/nomicon/ffi.html), ["The Rust Programming Language" · Unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html)

**Related**: `ecosystem/ffi-c-interop`

### WebAssembly

A compilation target aimed at no GC and small size; wasm-bindgen handles interoperability with JS.

**Source**: ["Rust and WebAssembly" · Introduction](https://rustwasm.github.io/docs/book/), [wasm-pack Book](https://rustwasm.github.io/docs/wasm-pack/)

**Related**: `ecosystem/wasm`

### Global Allocator

The entry point for the program's heap allocation; implement `GlobalAlloc` and mark it with `#[global_allocator]` to replace it entirely.

**Source**: [std · GlobalAlloc in std::alloc](https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html)

**Related**: `memory-concurrency/custom-allocator`

### Move Semantics versus Others

Rust fixes destruction points at compile time, C++ relies on RAII conventions, and Go relies on GC — the three resource-reclamation models directly determine the shape of the program.

**Source**: ["The Rust Programming Language" · What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html), [Go Docs · Effective Go](https://go.dev/doc/effective_go)

**Related**: `comparison/vs-ccpp`, `comparison/vs-go`

### Documentation

`///` doc comments feed rustdoc, doubling as Markdown and doctests; Rust By Example provides runnable samples.

**Source**: [Rust By Example · Introduction](https://doc.rust-lang.org/rust-by-example/), ["The Cargo Book" · cargo doc](https://doc.rust-lang.org/cargo/commands/cargo-doc.html)

**Related**: `tooling/cargo-workflow`
