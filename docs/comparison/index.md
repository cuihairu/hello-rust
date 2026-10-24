# Comparing with Other Languages

"Same logic, run it on both sides" measurements comparing Rust against C/C++, Go and Java on memory safety, error handling, concurrency models, generic semantics, build systems and ecosystem positioning. Conclusions follow the measured output and the official docs.

- Rust vs C/C++ — out-of-bounds access and dangling pointers are caught at compile time in Rust, but are UB or a segfault in C; when generics and templates are checked; data races forbidden at compile time versus UB; cargo vs CMake; `Result` versus return codes and exceptions.
- Rust vs Go — goroutines and tokio tasks at the same million-order of magnitude but different scheduling models; error handling of `Result` + `?` against `if err != nil`; Go's default static linking versus Rust's dynamic libc linking; concurrent GC versus ownership; Go 1.18 generics versus Rust trait bounds.
- Rust vs Java — GC versus ownership; `List<Integer>` and `List<Double>` being the same type at Java runtime but two distinct types in Rust; NPE versus `Option`; default virtual dispatch versus explicit `dyn`; the JMM's "well-defined but unpredictable" data races versus Rust's compile-time prohibition.
- Quick Comparison Table — by dimension: ownership and lifetimes, error handling, concurrency, memory management, polymorphism, macros and metaprogramming, build and dependencies, the type system, ecosystem positioning and learning curve, with each cell marked by the kind of evidence behind it.

---

- [Language Core](../language-core/) — foundations: ownership, borrowing, lifetimes.
- [Async](../async/) — the full semantics of Rust's async/await.
- [Glossary](../glossary) — Chinese–English pairs and authoritative sources for every core term on the site.
- [Notes Index](../knowledge) — index of key points across the site.
