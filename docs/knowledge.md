# Notes Index

This index collects the key points I recorded while organizing Rust concepts, reference material, application areas, and lessons from pitfalls. It provides a cross-cutting browsing view and does not prescribe a reading order; each topic note starts from a concrete problem, and its entries record conclusions with links to the full pages. There is also a [glossary](./glossary) for looking up Chinese-English term pairs and their sources.

## 1. Language Core

1. **Ownership: every value has exactly one owner**: after a value is moved, the original variable can no longer be used; when the owner leaves scope, the value is dropped. Copy types on the stack (integers, bool, and the like) are copied by value on assignment, not moved. (see `language-core/ownership-and-move`)
2. **Borrowing: using a value without transferring ownership**: at any given moment you may have either several shared references `&T` or one mutable reference `&mut T`, never both; the compiler's borrow checking rules out data races at compile time. (see `language-core/borrowing-and-references`)
3. **Slices: a view over a contiguous sequence**: `&[T]` and `&str` are fat pointers, a pointer plus a length; the automatic conversion from `String` to `&str` is deref coercion. (see `language-core/slices-and-str`)
4. **Lifetimes: annotations for a reference's period of validity**: a `'a` annotation describes constraints between references rather than extending any lifetime; it can be omitted when the function signature satisfies the elision rules; `'static` means valid for the entire program. (see `language-core/lifetimes`)
5. **Enums and pattern matching: algebraic data types**: enum variants can carry data, and `match` forces every case to be handled; `Option<T>` eliminates null pointers through the type system. (see `language-core/enums-and-pattern-matching`)
6. **Traits: an abstraction for shared behavior**: a trait defines method signatures and may provide default implementations; `impl Trait for Type` supplies the behavior, and trait bounds constrain generics. (see `language-core/traits`)
7. **Generics and monomorphization: compile-time polymorphism**: generic functions and structs get specialized monomorphized code generated for each concrete type at compile time, with no runtime overhead; combined with trait bounds they express constraints like "sort over types that can be compared". (see `language-core/generics-and-monomorphization`)
8. **Error handling: recoverable errors go through Result**: `Option<T>` expresses presence or absence, `Result<T, E>` expresses success or failure; `?` propagates errors upward within a function; `panic!` is reserved for unrecoverable errors. (see `language-core/error-handling`)

## 2. Type Systems & Abstractions

9. **Trait objects and dynamic dispatch**: `dyn Trait` is a fat pointer — a data pointer plus a vtable, with calls resolved through the pointer at runtime; the cost is vtable indirection, and the code is smaller for it. Against generic static dispatch it is a code-size-for-performance trade-off. (see `type-system/trait-objects`)
10. **Where constraints live decides readability**: multiple bounds use the `T: A + B` shorthand, and when parameters pile up a `where` clause spreads them across lines; an `impl` block can itself carry constraints, so the implementation only applies to types that satisfy them. (see `type-system/generic-constraints-and-where`)
11. **Associated types pin down a single type**: `Iterator`'s `Item` is an associated type rather than a generic parameter, so one implementation has exactly one `Item`; `Item = Self` makes an iterator return itself. (see `type-system/associated-types`)
12. **Evidence for zero-cost abstraction**: an iterator chain compiles into specialized monomorphized, inlined code; inspect the symbols with `nm` and you will see one copy per concrete type. (see `type-system/zero-cost-abstraction`)
13. **The orphan rule guards coherence**: you cannot write an impl for a foreign trait plus a foreign type (E0117); wrapping in a newtype is the sanctioned way around it. (see `type-system/orphan-rule-and-newtype`)
14. **`impl Trait` is syntactic sugar; position determines meaning**: in argument position it is equivalent to a generic parameter (static dispatch); in return position it hides the concrete type from callers, along with any captured environment — returning a closure has to be expressed through it. (see `type-system/impl-trait`)
15. **Operators are traits**: `Add`/`Sub`/`Mul`/`Index` and friends in `std::ops` determine the behavior of `+` and `[]`; `Deref` is the machinery behind auto-dereferencing. (see `type-system/operator-overloading`)
16. **The Fn family is distinguished by capture style**: `Fn` captures read-only, `FnMut` captures mutably, and `FnOnce` may move captured values and can be called only once; a `move` closure forces capture by value. (see `type-system/closures-and-fn-trait-family`)

## 3. Memory & Concurrency

17. **Drops are deterministic**: variables are destroyed in reverse declaration order, and in nested scopes the inner ones go first; `std::mem::drop` releases early, while `ManuallyDrop` defers destruction until needed. (see `memory-concurrency/drop-and-destructors`)
18. **Smart pointers trade ownership models**: `Box` is sole ownership on the heap, `Rc`/`Arc` share through reference counts, and `Weak` stays out of the strong count so it can break cycles; an `Rc` reference cycle keeps the count from ever reaching zero. (see `memory-concurrency/smart-pointers`)
19. **Interior mutability defers the borrowing rules to runtime**: `Cell`/`RefCell` allow mutating state through `&self`, but taking a borrow panics if one is already outstanding — the rules haven't disappeared, they are just enforced at a different moment. (see `memory-concurrency/interior-mutability`)
20. **Send and Sync are auto traits**: the compiler derives them from the type's fields, and raw pointers make a type `!Send`; `Arc<Mutex<T>>` is the go-to recipe for mutable state shared across threads. (see `memory-concurrency/send-and-sync`)
21. **Fearless concurrency**: `std::thread` + `mpsc` channels + `Mutex`/`RwLock`; ownership keeps data ownership unambiguous, and the compiler blocks write-write races. (see `memory-concurrency/threads-and-channels`)

## 4. Async

22. **Futures are lazy state machines**: `poll` returns `Ready` or `Pending`, and nothing happens without `block_on`; an async block is compiled into a state machine, and each `await` is one state transition. (see `async/async-await-and-future`)
23. **An executor is just the code that polls in a loop**: `block_on` is essentially repeated polling until Ready; writing an executor by hand shows exactly what the runtime is doing. (see `async/executors-and-runtime`)
24. **Pin guarantees the memory of a self-referential state machine is never moved**: `Unpin` types need no pinning; this is where the `self: Pin<&mut Self>` on async blocks and `Future` comes from. (see `async/pin-and-self-reference`)
25. **select discards the losing branches as soon as one wins**: dropped branches stop making progress, which is the foundation of cooperative cancellation; `timeout` and `CancellationToken` are specializations of the same pattern. (see `async/select-and-cancellation`)

## 5. Macros and Metaprogramming

26. **Declarative macros are compile-time pattern matching**: `macro_rules!` matches token streams using fragment types (`expr`/`ident`/`pat` and so on) plus `$(...)*` repetition; expansion happens ahead of the use site. (see `macros/declarative-macros`)
27. **Procedural macros run in a separate compile-time process**: all three forms — `#[proc_macro_derive]`/`#[proc_macro_attribute]`/`#[proc_macro]` — take a `TokenStream` in and give a `TokenStream` out, parsed and generated with `syn`/`quote`; the cost is extra compile overhead and limited error diagnostics. (see `macros/proc-macros`)

## 6. Toolchain

28. **cargo is the single entry point for builds and dependencies**: the four actions `build/run/test/check` + `Cargo.toml` metadata + a committable `Cargo.lock`; feature flags enable optional dependencies as needed. (see `tooling/cargo-workflow`)
29. **rustfmt and clippy split the work**: rustfmt only formats (uncontroversial rules), while clippy offers style and correctness hints (gradable via allow/warn/deny); CI locks them in with `--check` and `#![deny]`. (see `tooling/rustfmt-style`) (see `tooling/clippy-lints`)
30. **MSRV is what the `rust-version` field is for**: toolchain choice (stable/nightly) and edition migrations are managed separately, and dependency version drift is controlled by the lockfile and version-pinning policy. (see `tooling/rustup-msrv`)

## 7. Ecosystem & Engineering

31. **A workspace is the engineering unit for multiple crates**: dependency declarations and versions are shared and unified, and path dependencies interconnect inside the repository; inherited dependencies with `version = "workspace"` require a fairly recent cargo. (see `ecosystem/workspace`)
32. **Run `cargo publish --dry-run` before publishing**: it walks through packaging and metadata validation in full without actually publishing; in semver, breaking changes carry different semantics for `0.x` and `1.x`. (see `ecosystem/publish-crate`)
33. **The FFI boundary is an ownership boundary**: `extern "C"` only fixes the ABI; who owns the memory is a matter of convention. `Box::into_raw` and `from_raw` must appear in pairs, or you leak or double-free. (see `ecosystem/ffi-c-interop`)
34. **no_std is the shared foundation for embedded and wasm**: strip out std and only `core` (plus optional `alloc`) remains; embedded targets require you to supply the entry point and allocator yourself, while the wasm target is an OS-less sandbox. (see `ecosystem/embedded-nostd`) (see `ecosystem/wasm`)

## 8. Comparing with Other Languages

35. **Versus C/C++**: Rust uses ownership and borrowing to stop data races and undefined behavior at compile time, making RAII semantics mandatory; the cost is the migration effort imposed by compile-time constraints. (see `comparison/vs-ccpp`)
36. **Versus Go**: Rust trades async/await plus compiler checks for GC-free memory and compile-time concurrency safety; Go trades goroutines and a GC for development speed and runtime flexibility. (see `comparison/vs-go`)
37. **Versus Java**: generics in Java are type erasure (`List<Integer>` and `List<Double>` are the same type), while in Rust they are monomorphization (distinct types); null pointers are replaced by `Option`. (see `comparison/vs-java`)
38. **Point-by-point quick reference**: a side-by-side comparison table covering ownership, error handling, concurrency, memory management, polymorphism, metaprogramming, build systems, and type-system features. (see `comparison/cheatsheet-table`)

## 9. Key Points from Canonical Books

1. **"The Rust Programming Language" (Steve Klabnik & Carol Nichols, commonly known as "the book")**: the official free online book; the language-core part (Part 1) is aligned with it: <https://doc.rust-lang.org/book/>.
2. **"Programming Rust" (Jim Blandy et al., O'Reilly)**: an in-depth treatment aimed at readers with systems-programming experience; referenced by the memory and concurrency part.
3. **"Rust for Rustaceans" (Jon Gjengset)**: an advanced perspective on ownership, lifetimes, and trait objects; referenced by the type-systems part.
4. **"The Rustonomicon"**: the authoritative reference on unsafe Rust and the memory model; cited by the memory and concurrency part: <https://doc.rust-lang.org/nomicon/>.
5. **"Tokio: Asynchronous Programming in Rust" (Carl Lerche)**: referenced by the async executors and runtime part: <https://tokio.rs/tokio/tutorial>.

## 10. Key Points from the Official Docs

1. **The Rust Book**: the authoritative source for the language-core and type-systems parts: <https://doc.rust-lang.org/book/>.
2. **The Rust Reference**: a specification-grade reference for syntax and semantics (including the macros chapter, ABI, and the lifetimes chapter): <https://doc.rust-lang.org/reference/>.
3. **The std docs**: the last word on standard-library APIs and trait semantics: <https://doc.rust-lang.org/std/>.
4. **The Cargo Book**: the authoritative source for the toolchain and publishing parts: <https://doc.rust-lang.org/cargo/>.
5. **The RFC repository**: decision records for language and library feature design (e.g. RFC 3185 static async fn in trait, RFC 1238/1327 dropck): <https://rust-lang.github.io/rfcs/>.
6. **The Rustonomicon**: the authoritative reference for unsafe, memory layout, and concurrency primitives: <https://doc.rust-lang.org/nomicon/>.

## 11. Application Areas

1. **Systems programming and infrastructure**: operating systems, databases, network proxies — the direct home turf of ownership and zero-cost abstraction.
2. **Web backends**: axum/actix-web + the tokio async runtime; see Part 4 for error handling and the concurrency model.
3. **Command-line tools**: clap for argument parsing and anyhow for error handling — the cargo ecosystem works out of the box.
4. **Embedded and wasm**: no_std and the wasm32 target; see Part 7, Ecosystem & Engineering.

## 12. Common Pitfalls

1. **Using the original variable after a move**: the compile error `use of moved value` is ownership at work, not a bug. (see `language-core/ownership-and-move`)
2. **Assuming mutable references can coexist freely**: the exclusivity of `&mut T` is part of the compile-time defense line against data races. (see `language-core/borrowing-and-references`)
3. **Lifetime annotations can extend a reference's life**: `'a` only describes constraints; it changes how long no value actually lives. (see `language-core/lifetimes`)
4. **Treating panic as error handling**: a panic unwinds the stack and terminates the thread (by default); recoverable errors should go through `Result`. (see `language-core/error-handling`)
5. **`Rc` reference cycles cause leaks**: strong references hold each other, so the count never reaches zero; break the cycle with `Weak`. (see `memory-concurrency/smart-pointers`)
6. **Picking the wrong dispatch style**: with an unbounded number of types, generics noticeably slow compiles and bloat artifacts; use `dyn Trait` when `dyn Trait` is called for. (see `type-system/trait-objects`)
7. **select branches get dropped**: once one branch wins, the rest are dropped; don't assume code in them will always run. (see `async/select-and-cancellation`)
8. **Allocator and freer mismatch across FFI**: memory allocated by Rust must be freed by Rust; an unpaired `into_raw`/`from_raw` means a leak or a double free. (see `ecosystem/ffi-c-interop`)
