# Rust vs Java

Java and Rust are two nearly opposite sets of trade-offs: Java buys developer productivity with GC + everything-is-an-object, while Rust buys GC-free determinism with ownership + traits. This page contrasts them with **measurements run once on each side**.

## Memory model: GC vs ownership

Oracle's official JVM GC tuning guide (Java 26): GC "automatically manages the application's dynamic memory allocation requests"; its purpose is to free developers from "allocating paired with freeing, carefully managing lifetimes", and it "completely eliminates some classes of errors related to memory management at the cost of some additional runtime overhead".

The cost is **runtime overhead**: HotSpot provides several collectors (Serial, G1, and others); server-class machines default to G1, using generational collection, parallel/concurrent marking, and compaction.

On the Rust side there is no GC. Memory is decided by ownership rules at compile time, and the drop timing is **deterministic and in reverse order**. Measured (`rustc r11_drop_order.rs`):

```text
main 主体结束
drop b
drop a
```

Variables drop in **reverse** declaration order, and nested scopes drop the inner scope first. File handles, locks, and connections all rely on this determinism to be released automatically on scope exit — no GC pause, and no "forgot to release".

| Dimension | Java | Rust |
| --- | --- | --- |
| Memory management | Automatic GC collection (HotSpot, G1 by default) | Ownership + RAII, decided at compile time |
| When memory is released | Decided by the GC, unpredictable | End of scope, deterministic and in reverse order |
| Runtime overhead | GC threads + write barriers + compaction; GC pauses are tunable but still present | No GC; drop is an ordinary function call |
| Reference cycles | Collectable by the GC | `Rc` cycles leak; `Weak` is needed to break them |

## Generics: type erasure vs monomorphization

This is the **most substantive semantic difference** between the two type systems. Oracle's official tutorial *Type Erasure* states explicitly what the Java compiler does:

> Replace all type parameters in generic types with their bounds or Object if the type parameters are unbounded.
>
> Type erasure ensures that no new classes are created for parameterized types; consequently, generics incur no runtime overhead.

In other words: **Java's `List<Integer>` and `List<Double>` are the same class at runtime**. The official tutorial does not state this verbatim (it is an inference from "no new classes are created for parameterized types"), so the measurements below verify it directly.

Measured on the Java side (after `javac j1_erasure.java`, then run):

```text
class java.util.ArrayList
class java.util.ArrayList
same class? true
```

Measured on the Rust side (`rustc r10_type_names.rs`):

```text
alloc::vec::Vec<i32>
alloc::vec::Vec<f64>
```

In Rust, `Vec<i32>` and `Vec<f64>` are **two distinct types** — trying to swap them fails to compile outright. Actual error (`rustc r10b_vec_mismatch.rs`, failed, excerpt):

```text
error[E0308]: mismatched types
 --> r10b_vec_mismatch.rs:3:28
  |
3 |     let floats: Vec<f64> = ints;
  |                 --------   ^^^^ expected `Vec<f64>`, found `Vec<i32>`
```

| Dimension | Java generics | Rust generics |
| --- | --- | --- |
| Runtime representation | Type erasure; `List<Integer>` and `List<Double>` are the same class | Monomorphization; `Vec<i32>` and `Vec<f64>` are distinct types |
| Runtime type checking | Only the raw type `ArrayList` can be observed | Every instantiation is a concrete type |
| Boxing | `List<Integer>` boxes `Integer` objects | `Vec<i32>` stores raw `i32` directly, no boxing |
| Runtime overhead | None (erasure is zero-cost) | None (monomorphization is zero-cost, but it generates multiple copies of code, making the binary larger) |

The **boxing difference** is worth noting: Java generics cannot be used with primitive types (`List<int>` is illegal), so every `add(int)` implicitly boxes into an `Integer` object; Rust's `Vec<i32>` is a contiguous array of `i32` with no indirection.

## Null references: NPE vs `Option`

Every Java reference type can be `null`; null safety relies on programmer discipline and the `@Nullable` annotation family (not enforced by the language). Rust uses `Option<T>` to encode "may be absent" in the **type**; not handling `None` will not compile.

Measured on the Java side (after `javac j2_npe.java`, then run):

```text
bob = null
Exception in thread "main" java.lang.NullPointerException: Cannot invoke "java.lang.Integer.toString()" because "<local2>" is null
	at j2_npe.main(j2_npe.java:10)
```

It only explodes at line 10, and the `bob = null` step is **completely invisible to the compiler**. JDK 14+ Helpful NullPointerExceptions tell you **which variable** is null (the `"<local2>"` in the error), but they do not prevent the NPE itself. On the Rust side, the same HashMap lookup returns `Option<&V>`, and doing arithmetic on an `Option` directly errors at compile time (`rustc r9c_option_arith.rs`, failed, excerpt):

```text
error[E0369]: cannot add `{integer}` to `Option<i32>`
 --> r9c_option_arith.rs:3:24
  |
3 |     println!("{}", bob + 1);
  |                    --- ^ - {integer}
  |                    |
  |                    Option<i32>
```

The type system **forces** you to deal with "is there or isn't there" first. Only an explicit `.unwrap()` call panics (`rustc r9_option_unwrap.rs`, failed):

```text
thread 'main' (21203) panicked at r9_option_unwrap.rs:8:37:
called `Option::unwrap()` on a `None` value
```

Even when it panics, it is the result of an **explicit choice** (unwrap); Java's NPE is a side effect of **forgetting to check**.

## Object model: virtual calls by default vs trait + explicit dispatch

In Java, **every instance method that is not `private` and not `final` is virtual by default** — once a subclass overrides it, calling through a superclass reference triggers dynamic dispatch. Measured (after `javac j5_virtual.java`, then run, with `Animal a = new Dog(); a.speak()`):

```text
wang
```

Any `Animal` reference may point to a subclass; this dynamism is **on by default and cannot be turned off** (except with `final`/`private`).

In Rust, traits have two dispatch modes, and you **choose one explicitly**:

| Dispatch mode | Syntax | Mechanism | Measured cost |
| --- | --- | --- | --- |
| Static dispatch | `fn draw<T: Shape>(s: &T)` | Monomorphization; the call target is fixed at compile time | Zero-cost (possible code bloat) |
| Dynamic dispatch | `&dyn Shape` / `Box<dyn Shape>` | Indirect jump through the vtable | `&dyn Shape` is 16 bytes (data pointer + vtable pointer); `&Circle` is only 8 bytes |

Measured (`rustc r16_dyn_size.rs`): `&Circle` is 8 bytes, `&dyn Shape` is 16 bytes (data pointer + vtable pointer), and `Vec<Box<dyn Shape>>` can be iterated and called normally.

Trying to use a trait directly as a type (`Vec<Shape>`) does not work — a trait itself is a dynamically-sized type. Actual error (`rustc r7_dyn_vec.rs`, failed, excerpt):

```text
error[E0277]: the size for values of type `dyn Shape` cannot be known at compilation time
   --> r7_dyn_vec.rs:14:17
    |
14 |     let shapes: Vec<Shape> = vec![Circle];
   |                 ^^^^^^^^^^ doesn't have a size known at compile-time
```

You have to write `Vec<Box<dyn Shape>>` — **dynamic dispatch in Rust is an explicit choice**, and you pay for the `Box` allocation plus vtable indirection, whereas in Java this is the free default (at the cost that every virtual call may fail to be inlined by the JIT).

## Concurrency: synchronized/JMM vs borrow checking + `Send`/`Sync`

Java's concurrency correctness relies on the **Java Memory Model (JMM)** and synchronization primitives. Oracle's official tutorial describes the consequences of sharing variables without synchronization: thread A changes `counter`, and thread B is not guaranteed to see it — "there's no guarantee that thread A's change to `counter` will be visible to thread B — unless the programmer has established a happens-before relationship between these two statements".

Java data races have **well-defined semantics** (JLS §17.4): no crash, no UB, but **results are unpredictable** — a thread's update may be lost, or may not be visible to other threads. Measured (`javac j3_race.java`, two threads each doing `counter++` 100,000 times, 5 runs):

```text
counter = 196839 (expected 200000)
counter = 195987 (expected 200000)
counter = 121896 (expected 200000)
counter = 200000 (expected 200000)
counter = 192473 (expected 200000)
```

4 of the 5 runs were wrong, losing at least 78,000 updates. The fix on the Java side is `synchronized`, `volatile`, `AtomicLong`, or a lock.

On the Rust side, the same "unsynchronized shared mutable data" **does not compile**. Two threads sharing a `Vec` (`rustc r5_threads_share.rs`, failed, 4 errors, excerpt):

```text
error[E0499]: cannot borrow `v` as mutable more than once at a time
error[E0502]: cannot borrow `v` as immutable because it is also borrowed as mutable
```

Not even the "thread-safe" `Rc` gets through — `Rc`'s reference count is not atomic, and sharing across threads is prohibited at the type-system level (`rustc r6_rc_thread.rs`, failed, excerpt):

```text
error[E0277]: `Rc<String>` cannot be sent between threads safely
   = help: within `{closure@r6_rc_thread.rs:6:27: 6:34}`, the trait `Send` is not implemented for `Rc<String>`
```

`Send`/`Sync` are **compile-time traits**: `thread::spawn` requires the closure to be `F: Send + 'static`, and failing that means a compile error. The right approach is `Arc<Mutex<_>>` (sharing + mutual exclusion) or a channel (message passing), and the **type system guarantees you cannot forget to lock**.

| Dimension | Java | Rust |
| --- | --- | --- |
| Consequences of a data race | Well-defined semantics, unpredictable results (lost updates, visibility problems) | **Fails to compile** (borrow checking + `Send`/`Sync`) |
| Typical fix | `synchronized`, `volatile`, `Atomic*`, `ConcurrentHashMap` | `Arc<Mutex<T>>`, `Arc<AtomicU64>`, channels |
| Where correctness is guaranteed | The programmer following the JMM (happens-before); forgetting to lock is an occasional runtime error | The compiler enforcing it (trait bounds); forgetting to wrap fails to compile outright |

## Startup cost and artifact form

hello world measured on the same machine (3 runs each):

| Language | Startup to output | Artifact form |
| --- | --- | --- |
| Java | 0.18–0.19s | `.class` bytecode; requires the JVM |
| Rust | ~0.00s | Native ELF; 337KB after strip (4.5MB with debug info) |

Java's startup cost comes from JVM initialization + class loading + JIT warm-up — the first few executions run under the interpreter, and only hot code gets compiled. For **short-lived processes** (CLIs, serverless cold starts) this is a real, concrete cost, and it is the reason AOT solutions such as GraalVM native image exist. Rust compiles straight to native code, with no such startup tax.

## Notes and common pitfalls

- **Java is not "slow"**: after JIT warm-up, Java's performance on long-running server workloads is not poor; Rust's edge is **deterministic latency with no GC pauses** and **cold starts**, not an across-the-board domination.
- **Type erasure does not mean useless**: Java generics provide compile-time type checking; it is only the runtime information that gets erased. When runtime type information is needed, use reflection or pass `Class<T>` explicitly.
- **Rust has no "universal base class"**: the `Object` inheritance hierarchy in Rust corresponds to traits + generics, so the mental model has to shift from "is-a inheritance" to "has-a capability".
- **`Option` is not a silver bullet for nullability**: overusing `unwrap()` just swaps NPEs for panics; the idiomatic approach is `match`/`if let`/`unwrap_or`/`?`.

## References

- Official docs: *The Java Tutorials* · Type Erasure: <https://docs.oracle.com/javase/tutorial/java/generics/erasure.html>

## Related pages

- [Rust vs C/C++](./vs-ccpp) — the other axis of comparison: memory safety and generics.
- [Rust vs Go](./vs-go) — concurrency model and error handling.
- [Quick Comparison Table](./cheatsheet-table) — everything summarized dimension by dimension.
- [Ownership and move semantics](../language-core/ownership-and-move) — the foundation of Rust being GC-free.
- [Error handling](../language-core/error-handling) — `Result` and `?`.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
