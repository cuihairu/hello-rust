---
layout: home

hero:
  name: Hello Rust
  text: Rust notes by a game developer
  tagline: Records the Rust problems I hit in projects and experiments — the verification steps and the trade-offs — covering language core, type system, concurrency, async, macros and the engineering ecosystem.
  image:
    src: /logo.svg
    alt: hello-rust logo
  actions:
    - theme: brand
      text: Browse the notes
      link: /language-core/
    - theme: alt
      text: Notes index
      link: /knowledge
    - theme: alt
      text: Glossary
      link: /glossary
    - theme: alt
      text: GitHub
      link: https://github.com/cuihairu/hello-rust

features:
  - title: Language Core
    details: Ownership and move semantics, borrowing and references, slices, lifetimes, enums and pattern matching, traits, generics and monomorphization, error handling.
  - title: Type System & Abstraction
    details: Trait objects and dynamic dispatch, generic bounds, associated types, zero-cost abstraction, the orphan rule, impl Trait, closures and the Fn family.
  - title: Memory & Concurrency
    details: Drop and destructors, smart pointers, interior mutability, custom allocators, Send and Sync, fearless concurrency, cross-compilation.
  - title: Async & Macros
    details: async/await and Future, Pin, the tokio ecosystem, select and cancellation; declarative macros and procedural macros.
  - title: Toolchain & Ecosystem
    details: cargo, rustfmt, clippy, rust-analyzer, MSRV policy; workspace, publishing crates, FFI, embedded, wasm.
  - title: Cross-Language Comparison
    details: Row-by-row differences against C/C++, Go and Java on memory safety, error handling, concurrency models and build systems.
  - title: Glossary
    details: Sixty core terms with Chinese–English pairs, one-line definitions and curl-verified official sources, grouped into eight sections.
---
