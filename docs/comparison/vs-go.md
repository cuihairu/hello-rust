# Rust vs Go

Go and Rust are the most frequently compared pair: both emphasize engineering efficiency, both are strongly typed, both compile to native code. But their **concurrency abstractions** and **error-handling philosophies** are nearly a control group for each other — Go makes concurrency a language-level primitive with goroutine + channel, while Rust makes concurrency safety a type-system constraint with ownership + `async`/`await`.

## Concurrency model: goroutine vs async task

How Go's official docs (Effective Go) position the goroutine:

> A goroutine has a simple model: it is a function executing concurrently with other goroutines in the same address space. It is lightweight, costing little more than the allocation of stack space. And the stacks start small, so they are cheap, and grow by allocating (and freeing) heap storage as required.
>
> Goroutines are multiplexed onto multiple OS threads so if one should block, such as while waiting for I/O, others continue to run.

A goroutine is a lightweight coroutine **scheduled by the runtime**, with a stack that grows on demand, multiplexed onto a small number of OS threads. Rust's counterpart is `async`/`await` + an executor (tokio and friends) — likewise lightweight, cooperatively scheduled units.

Measured on the same machine (release builds):

| Experiment | Command | Result |
| --- | --- | --- |
| Go 1 million goroutines | `go run g1_goroutines.go` | `1000000 goroutines done`, wall **2.87s** |
| Rust 1 million tokio tasks | `cargo run --release` | `1000000 tokio tasks done`, wall **4.74s** |
| Rust 10,000 OS threads | `rustc r14_threads_scale.rs` | `count = 10000`, wall **5.07s** |

The conclusion is direct:

- **Go goroutines and tokio tasks are in the same order of magnitude** (millions of coroutines); that is the genuinely comparable item between the two.
- **`std::thread` is not a coroutine**: it maps directly onto OS threads; 10,000 of them already take 5 seconds, and it is limited by OS thread counts / stack space. To reach million-scale concurrency, Rust has to go through `async` tasks.
- Go's concurrency is **built into the language** (the `go` keyword + the runtime scheduler); Rust's concurrency is **language + library** (`async`/`await` is a language feature, the executor lives outside the standard library, and tokio is the de facto standard).

channel versus mpsc. On the Go side, `range` ends naturally after `close`, measured output `got 10 / got 20 / got 30`; on the Rust side, the `for` loop ends after `drop`ping the sender:

```rust
let (tx, rx) = mpsc::channel();
for i in 0..3 {
    let tx = tx.clone();
    thread::spawn(move || { tx.send(i * 10).unwrap(); });
}
drop(tx);
for got in rx { println!("got {got}"); }
```

Actual run output (`rustc r12_mpsc.rs`):

```text
got 10
got 0
got 20
```

The order is not deterministic — a channel only guarantees ordering from **the same sender**; across multiple senders nothing is guaranteed. Go's channel semantics are the same.

## Error handling: `Result` + `?` vs multiple return values + `if err != nil`

Go has no exceptions; the idiomatic pattern is **multiple return values**: the function returns `(T, error)` and the caller immediately does `if err != nil`. Rust uses `Result<T, E>` + `?`, where errors are **typed values** and `?` makes error propagation explicit at the syntax level.

Measured on the Go side (`go run g2_err.go`):

```text
7/2 = 3
err: division by zero
```

Measured on the Rust side (`rustc r8_result_question.rs`):

```text
Ok(42)
Err(ParseIntError { kind: InvalidDigit })
```

| Dimension | Go | Rust |
| --- | --- | --- |
| Error carrier | Multiple return values `(T, error)`; `error` is an interface | `Result<T, E>`; `E` is a generic parameter |
| Propagation | Hand-written `if err != nil { return ..., err }` at every layer | Propagated automatically by the `?` operator |
| Can it be ignored | Yes (discard the return value; the compiler says nothing) | The compiler warns `unused_must_use` (`Result` is annotated `#[must_use]`) |
| Error type | A runtime interface; use `errors.Is` / `errors.As` | A concrete compile-time type; `match` can be exhaustive |

Go's `if err != nil` is straightforward in simple cases, but **the error path drowns out business logic**, and the compiler will not remind you about a missed check. Rust's `?` separates "propagate" from "handle": `?` takes care of propagation, `match`/`unwrap_or` take care of handling, and `Result` is `#[must_use]` — **forgetting to handle an error gets you called out by the compiler**.

## Build artifacts: size, linking, and startup

hello world measured on the same machine (optimized builds):

| Language | Build command | Artifact size | Linking (`file` / `ldd`) |
| --- | --- | --- | --- |
| C | `gcc -O2` | **15,952 B** | Dynamically linked libc |
| Rust | `rustc -O -C debuginfo=0` | **4,536,400 B** (with debug info; **336,744 B** after `strip`) | Dynamically linked `libgcc_s.so.1` + `libc.so.6` |
| Go | `go build` | **2,342,537 B** | **Statically linked** (`file` reports `statically linked`, `ldd` reports `not a dynamic executable`) |

A few facts worth noting:

- **Go is statically linked by default** (with pure Go code and no CGO dependencies), so the artifact is self-contained. That is a measured conclusion, not an impression.
- **Rust dynamically links libc/libgcc_s by default** (visible in the `ldd` output). Static linking requires switching to a musl target (`--target x86_64-unknown-linux-musl`).
- **Debug info is the bulk of Rust's size**: `rustc -O` includes debug info by default (4.5MB); after `strip` it is 337KB.
- Size numbers fluctuate with version, platform, and dependency count; **do not compare absolute values across environments** — compare order of magnitude and linking method.

Measured startup times (3 runs each): Rust ~0.00s, Go 0.00–0.01s, C ~0.00s, Java 0.18–0.19s (see [Rust vs Java](./vs-java)). All three native languages are in the millisecond range.

## GC vs no GC

Key points from Go's official GC guide (go.dev/doc/gc-guide):

> The Go GC is not fully stop-the-world and does most of its work concurrently with the application. This is primarily to reduce application latencies.

Go's GC is a **concurrent, non-moving** mark-sweep collector, with the CPU/memory/latency trade-off tuned through `GOGC` (heap growth target) and `GOMEMLIMIT` (a memory ceiling since Go 1.19). The cost is **runtime overhead**: GC threads run alongside application threads, consuming CPU and memory.

Rust has no GC. Memory release is decided at compile time by ownership, and the drop order is **deterministic and predictable**. Measured (`rustc r11_drop_order.rs`):

```text
main 主体结束
drop b
drop a
```

Variables drop in **reverse** declaration order, and nested scopes drop the inner scope first. This determinism is the foundation of RAII — file handles, locks, and connections are released automatically on scope exit, with no GC pause and no "forgot to release".

| Dimension | Go | Rust |
| --- | --- | --- |
| Memory management | Concurrent GC (tunable via `GOGC`/`GOMEMLIMIT`) | Ownership + RAII, decided at compile time |
| When memory is released | Decided by the GC at runtime, unpredictable | End of scope, deterministic and in reverse order |
| Runtime overhead | GC threads are resident, costing CPU/memory | No GC threads; drop has a deterministic but tiny cost |
| Reference cycles | Collectable by the GC (mark-sweep) | `Rc` leaks; you need `Weak` or a redesign around `Arc` |

## Generics: since 1.18 vs Rust's trait bounds

Go 1.18 introduced generics (official blog post, *An Introduction To Generics*: "The Go 1.18 release adds support for generics"). Go's constraint model is **interfaces as type sets**:

> In Go, type constraints must be interfaces. ... the type set defined by an interface specifies exactly the types that are permitted as type arguments.

Measured on the Go side (`go run g5_generics.go`):

```go
type Number interface { ~int | ~float64 }

func sum[T Number](xs []T) T {
    var total T
    for _, x := range xs { total += x }
    return total
}
```

Actual run output:

```text
6
4
```

| Dimension | Go generics | Rust generics |
| --- | --- | --- |
| Version introduced | Go 1.18 (2022) | Rust 1.0 (2015) |
| How constraints are expressed | Interfaces + type sets (`~int \| ~float64`) | trait bound (`T: Add<Output = T>`) |
| When checked | At instantiation (an unsatisfied constraint errors at the call site) | **At definition time** (trait bounds are checked at the definition; see `E0369` in [Rust vs C/C++](./vs-ccpp)) |
| Specialization | None (long-running community discussion, never landed) | None (`min_specialization` is not stable) |
| Runtime representation | Dictionary passing (GC-shape monomorphization + dictionaries) | Monomorphization (zero-cost) or `dyn Trait` (dynamic dispatch) |

The key difference: **Go generics check constraints at instantiation**, reporting the error at the call site (like C++ templates); **Rust checks at definition time**, reporting the error at the definition along with a suggested fix.

## Ecosystem niche and engineering positioning

| Dimension | Go | Rust |
| --- | --- | --- |
| Design goals | Simplicity, fast development, network services and tooling | Safety, zero-cost abstraction, systems programming |
| Typical use cases | Microservices, CLIs, DevOps tooling, cloud native | Operating systems, embedded, databases/engines, CLIs |
| Concurrency primitives | Built into the language (goroutine/channel) | Language + library (async/tokio, std::thread) |
| Memory management | Concurrent GC | Ownership, no GC |
| Learning curve | Tiny syntax; productive in days | Ownership/lifetimes carry a significant learning cost |
| Compile speed | Known for being fast (incremental compilation + caching) | Known for being slow (monomorphization + borrow checking) |

"Go compiles fast, Rust compiles slow" is a widely circulated community rule of thumb, but **engineering-scale compile time depends on the size of the dependency graph, incremental compilation settings, and machine performance**, and this page makes no quantitative claims. hello world single-file cold-compile measured: Go 0.016–0.022s, Rust 0.067–0.078s, gcc 0.078–0.099s, javac 1.15–1.16s — a single file is not representative and serves only as an order-of-magnitude reference.

## Notes and common pitfalls

- **goroutines are not free**: millions are feasible, but each goroutine still carries stack and scheduling overhead; for CPU-bound work, goroutines are not faster than threads.
- **`std::thread` is not Rust's answer to concurrency**: when you need million-scale concurrency, use `async` + tokio, or you will hit OS thread limits first.
- **Go's `error` is an interface**: the **business-logic drowning** problem on the error path can only be mitigated by convention and lint tooling.
- **Rust's `?` is not an exception**: it is syntactic sugar for "return `Err` early", with no stack-unwinding cost and no implicit propagation across multiple call frames.
- **Both are converging toward each other**: Go is filling in generics and abstraction beyond `any`; Rust is filling out its async ecosystem and improving compile times.

## References

- Official docs: *Effective Go* (official Go docs): <https://go.dev/doc/effective_go>

## Related pages

- [Rust vs C/C++](./vs-ccpp) — the other axis of comparison: memory safety and generics.
- [Rust vs Java](./vs-java) — GC, generic erasure, and the object model.
- [Quick Comparison Table](./cheatsheet-table) — everything summarized dimension by dimension.
- [Ownership and move semantics](../language-core/ownership-and-move) — the foundation of Rust being GC-free.
- [Error handling](../language-core/error-handling) — the full semantics of `Result` and `?`.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
