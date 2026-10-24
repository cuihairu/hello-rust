# Quick Comparison Table

This page gathers the conclusions of the three comparison pages in this section and summarizes them by dimension. **Every cell is labeled with its type of evidence**: Measured (the author of this page ran it on this machine with rustc 1.99.0 / gcc & g++ 15.2.0 / go 1.27.1 / javac 21.0.12 and pasted the output), Official docs (an official page was checked), Qualitative (engineering consensus, no official source — please verify yourself). Any conclusion with no traceable source is uniformly marked "No source found".

> Test environment: Linux x86-64, rustc 1.99.0, gcc/g++ 15.2.0, go 1.27.1, javac 21.0.12. Numbers will change across environments; **read the order of magnitude and the semantics of the conclusions — do not memorize the numbers**.

## Ownership and lifetimes

| Language | Mechanism | Key evidence | Basis |
| --- | --- | --- | --- |
| Rust | Three ownership rules + borrow checking; reference validity verified at compile time | `error[E0505]: cannot move out of v because it is borrowed` (use-after-free fails to compile outright) | Measured + official docs (Reference, "Behavior considered undefined") |
| C/C++ | Manual management (`malloc`/`free`, `new`/`delete`); RAII optional (smart pointers); dangling pointers not stopped at compile time | Returning the address of a local array: compiles, exit 0 (one warning); Segmentation fault at runtime | Measured + C++ standard draft (UB list) |
| Go | Fully managed by GC; no notion of ownership | GC heap growth target is tuned by `GOGC`/`GOMEMLIMIT` | Official docs (go.dev/doc/gc-guide) |
| Java | Fully managed by GC (HotSpot, G1 by default on server-class machines) | Officially stated: "automatically manages dynamic memory allocation requests", "eliminates a class of memory management errors" | Official docs (Oracle GC tuning guide) |

## When memory is freed, and the overhead

| Language | When memory is freed | Determinism | Basis |
| --- | --- | --- | --- |
| Rust | End of scope, dropped in **reverse** declaration order | Fully deterministic | Measured: `main body ends → drop b → drop a`; official docs (Book, chapter 4) |
| C/C++ | Explicit `free`/`delete`; RAII / smart pointers are released on scope exit | Deterministic for explicit calls; easy to leak with bare new/delete | Measured (dangling example segfaults); RAII semantics per the C++ standard (the corresponding cppreference entry was not checked verbatim this time) |
| Go | Decided by the GC, concurrent mark-sweep | Unpredictable (frequency tunable) | Official docs (go.dev/doc/gc-guide: "does most of its work concurrently") |
| Java | Decided by the GC, generational + compaction | Unpredictable | Official docs (Oracle GC tuning guide: generational scavenging) |

## Error handling

| Language | Idiomatic approach | Can it be ignored | Basis |
| --- | --- | --- | --- |
| Rust | `Result<T, E>` + `?` propagation | Cannot be silently ignored: forgetting to handle it triggers `warning: unused Result that must be used` (`#[must_use]`) | Measured (`Ok(42)` / `Err(ParseIntError { kind: InvalidDigit })`; must_use warning measured) + official docs (Book, chapter 9) |
| C/C++ (C++17) | Return codes / exceptions | Return codes can be discarded with no notice; an uncaught exception terminates | C side per community knowledge (no single official source found); C++ exception semantics per cppreference (not checked verbatim this time) |
| C/C++ (C++23) | `std::expected<T, E>` (isomorphic to `Result`) | Same as `Result`: a value, not an exception | Measured: g++ 15.2.0 `-std=c++23` compiled and ran cleanly (`7/2 = 3` / `err: division by zero`) |
| Go | Multiple return values `(T, error)` + `if err != nil` | Yes: discarding the return value does not produce a compiler error | Measured (`7/2 = 3` / `err: division by zero`); the pattern is described in Effective Go (the error-handling chapter was not checked verbatim this time) |
| Java | Exceptions (checked/unchecked) | An uncaught exception terminates the thread/process | Community knowledge + Oracle tutorials (the exceptions chapter was not checked verbatim this time) |

## Concurrency

| Language | Model | Consequence of unsynchronized shared mutable data | Basis |
| --- | --- | --- | --- |
| Rust | Ownership + `Send`/`Sync` traits; `Arc<Mutex<T>>` / channels / tokio | **Fails to compile**: `E0499 cannot borrow v as mutable more than once`, `E0277 Rc<String> cannot be sent between threads safely` | Measured + official docs (the Reference lists data races as UB) |
| C/C++ | Threads + locks/atomics, entirely up to the programmer | **Undefined behavior**: the standard draft explicitly states "Any such data race results in undefined behavior" | Official docs (eel.is C++ draft [intro.races]). **Honest note**: with gcc -O2 here, 5 runs of a short loop all produced 200000 and the error did not reproduce — whether UB manifests depends on the platform and optimization level |
| Go | goroutine + channel, with in-language scheduling | Only the runtime race detector (`-race`) finds it; the language level does not stop it | Official docs (Effective Go: a goroutine is "multiplexed onto multiple OS threads"); `-race` not measured |
| Java | Threads + JMM (§17.4) + synchronized/volatile/Atomic* | Well-defined semantics but **unpredictable results**: measured two threads each doing `counter++` 100,000 times, 4 of 5 runs lost updates (196839 / 195987 / 121896 / 200000 / 192473) | Measured + official docs (Oracle concurrency tutorial: happens-before relationships) |

### Measured concurrency scale (same machine)

| Experiment | Wall time | Basis |
| --- | --- | --- |
| Go, 1 million goroutines (WaitGroup join) | 2.87s | Measured |
| Rust, 1 million tokio tasks (Barrier join) | 4.74s | Measured |
| Rust, 10,000 `std::thread`s (AtomicUsize join) | 5.07s | Measured (directly mapped onto OS threads; scale is limited) |

## Polymorphism and dynamic dispatch

| Language | Mechanism | Runtime form | Basis |
| --- | --- | --- | --- |
| Rust | Generics (monomorphization by default) or `dyn Trait` (explicit dynamic dispatch) | `&dyn Shape` is 16 bytes (data pointer + vtable), `&Circle` is 8 bytes; `Vec<Shape>` fails to compile outright (E0277, a trait is a dynamically-sized type) | Measured + official docs (Book chapters 17/18 on trait objects, not checked verbatim) |
| C/C++ | Templates (checked at instantiation) + virtual functions | Zero-cost monomorphization; virtual calls jump indirectly through the vtable | Measured (a template missing `operator+` errors at the instantiation point); virtual function semantics per community knowledge (cppreference not checked verbatim) |
| Go | Interfaces (implicit implementation) + generics (1.18, constraints are interface type sets) | An interface value is a (type, data) pair; generics use dictionary passing | Official docs (go.dev/blog/intro-generics: "type constraints must be interfaces") + measured (`sum([]int{1,2,3})` prints 6) |
| Java | Class inheritance + interfaces; **methods that are neither private nor final are virtual by default**; generics use type erasure | `List<Integer>` and `List<Double>` are the same `ArrayList` class at runtime (measured: `same class? true`) | Measured + official docs (Oracle's generic erasure tutorial) |

## Macros and metaprogramming

| Language | Mechanism | Notes | Basis |
| --- | --- | --- | --- |
| Rust | Declarative macros `macro_rules!` + procedural macros (derive / attribute / function-like) | `vec![]`, `#[derive(Debug)]` are themselves macro output | Official docs (Book's macro chapters; the URL was not checked verbatim on this page, but the mechanism is documented) |
| C/C++ | Preprocessor macros `#define` + template metaprogramming + `constexpr`/`consteval` | Three mechanisms coexist with overlapping capabilities | Qualitative (community consensus; the corresponding cppreference entries were not checked verbatim this time) |
| Go | **No macro system**; code generation goes through `go generate` + external tools | The official FAQ discusses "why no macros", not checked verbatim this time | Qualitative (community consensus) |
| Java | Annotation processors (APT) + reflection + bytecode enhancement (e.g. Lombok) | Code generated at compile time rather than language-level macros | Qualitative (community consensus) |

## Build and dependency management

| Language | Official / de facto tooling | Dependency sources | Basis |
| --- | --- | --- | --- |
| Rust | cargo (official; build + test + publish in one) | crates.io + `Cargo.lock` pinning | Official docs (doc.rust-lang.org/cargo) |
| C/C++ | CMake/Make (build generators, not an official language companion) | No unified standard: system packages / vcpkg / Conan / FetchContent | Qualitative (the official cmake.org site positioning; dependency ecosystem diversity is community consensus) |
| Go | `go build` / `go mod` (built into the language) | Go module proxy (go.dev/ref/mod) | Official docs (go.dev/ref/mod) |
| Java | Maven / Gradle (de facto standard, **not built into the language**) | Maven Central | Qualitative (community consensus) |

## Type system features

| Language | Feature set | Key evidence | Basis |
| --- | --- | --- | --- |
| Rust | Algebraic types (`enum`) + **exhaustiveness checking** on pattern matches + trait bounds (checked at the definition) | A `match` missing a branch: `error[E0004]: non-exhaustive patterns: Shape::Square not covered`; a generic missing a bound: `error[E0369]` reported at the definition | Measured + official docs (Reference) |
| C/C++ | Templates + overloading + `constexpr`; enum + switch with no hard exhaustiveness check | Template errors are reported at the instantiation point (measured); `-Wswitch` is only a warning (not measured) | Measured (template part); the switch part was not measured |
| Go | Structured interfaces (implicit implementation) + generic type sets (1.18) | A `~int \| ~float64` constraint compiled and ran successfully (measured) | Official docs (go.dev/blog/intro-generics) + measured |
| Java | Nominal types + single-root inheritance (`Object`) + generic erasure; no enum match (switch on enum is a statement, not an exhaustive expression check) | `List<Integer>` and `List<Double>` are the same class at runtime (measured) | Measured + official docs (Oracle's erasure tutorial); switch exhaustiveness details were not checked this time (pattern matching in switch has been standardized since Java 21, not checked verbatim) |

## Null semantics

| Language | How "may be absent" is represented | Consequence of not handling it | Basis |
| --- | --- | --- | --- |
| Rust | `Option<T>`, encoded in the type | It **will not compile** without an unwrap (adding 1 to an `Option<i32>` gives `error[E0369]`); an explicit `unwrap()` is what panics | Measured (`called Option::unwrap() on a None value`, exit 101) |
| C/C++ | Pointers may be null; checking before dereferencing is on you | Dereferencing a null pointer = UB | The C++ standard draft UB list (the null-dereference entry was not checked verbatim this time); community consensus |
| Go | Pointers/interfaces may be nil; the idiomatic `, ok` double return | A nil dereference panics (at runtime) | Qualitative (community consensus; runtime panic behavior was not measured on this page) |
| Java | Every reference type may be `null` | An NPE is thrown at runtime: `Cannot invoke "Integer.toString()" because "<local2>" is null` | Measured + JDK 14+ Helpful NPE (the error message includes the variable name, visible in the measurement) |

## Startup cost and artifact form (measured on the same machine)

| Language | hello world startup | Artifact | Basis |
| --- | --- | --- | --- |
| Rust | ~0.00s | Native ELF; 4.5MB with debug info from `rustc -O`, 337KB after strip; dynamically linked against libc/libgcc_s | Measured (`file`/`ldd`) |
| Go | 0.00–0.01s | Native ELF, 2.3MB, **statically linked by default** (`ldd` reports not a dynamic executable) | Measured (`file`/`ldd`) |
| C | ~0.00s | Native ELF, 16KB, dynamically linked against libc | Measured |
| Java | 0.18–0.19s | `.class` bytecode; requires the JVM (startup + JIT warm-up cost) | Measured + Oracle JVM docs (the part on automatic GC memory management) |

## Ecosystem positioning (qualitative judgment, no official source)

| Language | Typical niche | Notes |
| --- | --- | --- |
| Rust | Systems programming, embedded, database/engine cores, safety-sensitive CLIs | Qualitative (community consensus) |
| C/C++ | Operating systems, drivers, game engines, maintaining existing infrastructure | Qualitative (community consensus) |
| Go | Cloud-native services, network services, DevOps/CLI tooling | Qualitative (community consensus) |
| Java | Enterprise backends, the big-data ecosystem, Android (historically) | Qualitative (community consensus) |

## Learning curve (qualitative judgment, no official source)

| Language | Initial barrier | Notes |
| --- | --- | --- |
| Rust | High: ownership, borrowing, and lifetimes are entirely new concepts | Qualitative; "steep learning curve" is a frequent community observation, not an official conclusion |
| C/C++ | Medium to high: the syntax is familiar but UB/memory errors are stealthy, and mastery takes years | Qualitative |
| Go | Low: a tiny grammar, concurrency primitives out of the box | Qualitative |
| Java | Low to medium: conventional concepts, a huge ecosystem | Qualitative |

## How to use this table

- **Check the "Basis" column first when reading any cell**: `Measured` is reproducible (the three comparison pages in this section list the commands), Official docs can be clicked to verify, and Qualitative/No source found need you to verify them yourself.
- **Do not memorize absolute numbers across languages**: binary size, compile time, and concurrency scale all depend heavily on the machine and the environment. The semantic conclusions (compile-time interception vs runtime UB) are the knowledge that actually transfers.
- **How to read UB-class conclusions**: "C/C++ data races are UB" is a standard-level ruling, not a guarantee that every run fails — the c3 measurement on this page, where all 5 runs were correct, is itself a counterexample. The standard ruling and the observed behavior should be stated separately.

## References

- Official docs: *The Rust Reference* · Behavior considered undefined: <https://doc.rust-lang.org/reference/behavior-considered-undefined.html>

## Related pages

- [Rust vs C/C++](./vs-ccpp) — point-by-point measurements of memory safety, generics, and build systems.
- [Rust vs Go](./vs-go) — a comparison of concurrency models and error handling.
- [Rust vs Java](./vs-java) — GC, generic erasure, and the object model.
- [Section overview](./) — a guide to this section.
- [Project notes index](../knowledge) — a site-wide index of key points.
- [Language core](../language-core/) — the fundamentals of ownership, borrowing, and lifetimes.
