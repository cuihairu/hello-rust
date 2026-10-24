# Zero-Cost Abstraction

"Zero-cost abstraction" is often treated as a slogan, but it has a precise meaning, inherited from C++'s zero-overhead principle: **abstractions you don't use cost nothing; abstractions you do use aren't worse than hand-written code**. Rust's iterators, generics, and `impl Trait` are all designed to this standard. This page verifies it with real run and assembly evidence.

## Iterator chains vs hand-written loops

An iterator chain of `map + filter + sum` looks like "three passes + two intermediate collections." Actual timing (`rustc -O`, 10 million elements):

```rust
use std::time::Instant;

fn main() {
    let n = 10_000_000i64;
    let v: Vec<i64> = (1..=n).collect();

    // 迭代器链
    let t0 = Instant::now();
    let sum1: i64 = v.iter().map(|x| x * 2).filter(|x| x % 3 == 0).sum();
    let d1 = t0.elapsed();

    // 手写循环
    let t1 = Instant::now();
    let mut sum2 = 0i64;
    for x in &v {
        let y = *x * 2;
        if y % 3 == 0 {
            sum2 += y;
        }
    }
    let d2 = t1.elapsed();

    println!("iter chain: sum = {sum1}, 耗时 {d1:?}");
    println!("hand loop: sum = {sum2}, 耗时 {d2:?}");
    assert_eq!(sum1, sum2);
}
```

Actual run output (the three runs each have their own winner, and the gap is within noise):

```text
iter chain: sum = 33333336666666, 耗时 41.219398ms
hand loop: sum = 33333336666666, 耗时 47.383519ms
```

## Assembly evidence: why they can be equally fast

The reason is settled at compile time: iterators are **lazy** — `map` and `filter` are just small structs wrapping the upstream iterator, and after `next()` is inlined one level at a time, the entire chain collapses into a single loop. Force the two summing functions into independent functions with `#[inline(never)]`, then compare with `rustc -O --emit=asm`:

```rust
use std::hint::black_box;

#[inline(never)]
fn chain_sum(v: &[i64]) -> i64 {
    v.iter().map(|x| x * 2).filter(|x| x % 3 == 0).sum()
}

#[inline(never)]
fn loop_sum(v: &[i64]) -> i64 {
    let mut total = 0;
    for x in v {
        let y = *x * 2;
        if y % 3 == 0 {
            total += y;
        }
    }
    total
}

fn main() {
    let v: Vec<i64> = (1..=100).map(|x| black_box(x)).collect();
    println!("chain = {}  loop = {}", black_box(chain_sum(&v)), black_box(loop_sum(&v)));
}
```

Actual run output:

```text
chain = 3366  loop = 3366
```

Actual assembly output (x86-64, the hot loop of `chain_sum`; the symbol name is v0-mangled `iter_vs_loop::chain_sum`):

```text
.LBB6_5:
	movq	(%rdi,%r9,8), %r11
	movq	%r11, %rbx
	imulq	%rcx, %rbx
	addq	%r8, %rbx
	cmpq	%rdx, %rbx
	jb	.LBB6_6
```

- `movq (%rdi,%r9,8), %r11` reads the element straight from the slice — **no intermediate buffer**; the wrapping structs of `map`/`filter` have been optimized away entirely;
- `imulq %rcx, %rbx` gets by in one shot: the `% 3` check is rewritten by the compiler as a single magic-number multiply (`6148914691236517206` inside `%rcx` is the magic number used to test divisibility by 3); and `* 2` goes even further — algebraic simplification hoists it out of the loop, and the `leaq (%rax,%rax), %rdi` at the end of the function is that one multiplication;
- Both function bodies are about 80 lines of assembly each with **0 `call` instructions** — no "iterator method" is ever called, everything is inlined.

## Monomorphization: one copy of code per type used

The zero cost of generics comes from **monomorphization**: the compiler generates a dedicated copy of the code for each type actually used, statically dispatched with no vtable. `nm` shows you directly what "one copy" looks like inside the binary:

```rust
use std::fmt::Debug;

// 阻止内联，让符号留在二进制里，便于观察
#[inline(never)]
fn show<T: Debug>(x: T) {
    println!("{x:?}");
}

fn main() {
    show(42);
    show("hi");
    show(1.5);
}
```

Actual run output (the first three lines of `nm run_show_types | grep show`):

```text
0000000000015d00 t _RINvCseau0GDIhzNJ_10show_types4showdEB2_
0000000000015d40 t _RINvCseau0GDIhzNJ_10show_types4showlEB2_
0000000000015cb0 t _RINvCseau0GDIhzNJ_10show_types4showReEB2_
```

These three symbols are the three monomorphized instances of `show`; the trailing `d`, `l`, and `Re` correspond to the type parameters `f64`, `i32`, and `&str` respectively — there is only one `show` in the source, three in the binary, each carrying code specialized for its concrete type.

## The limits of "zero-cost"

- **Abstractions you don't use cost nothing**: a generic that is never instantiated generates no code at all; an iterator chain that never `collect`s allocates no intermediate collection;
- **Abstractions you do use aren't worse than hand-written**: static dispatch + inlining makes the abstraction layer disappear in the machine code (the assembly above is the evidence);
- **The cost moves to compile time**: monomorphization copies one version of the code per type, buying you longer compile times and larger binaries — "zero" refers to **runtime overhead** being zero.

## References

- Official docs: "The Rust Programming Language" Chapter 13 · Performance in Loops vs. Iterators: <https://doc.rust-lang.org/book/ch13-04-performance.html>

## Related pages

- [Generics and monomorphization](../language-core/generics-and-monomorphization) — the introductory explanation of the monomorphization mechanism.
- [Trait objects](./trait-objects) — a comparison of the cost on the dynamic dispatch route.
- [Associated types](./associated-types) — the type mechanism that iterator abstractions rest on.
- [`impl Trait`](./impl-trait) — the most common signature syntax for writing this kind of abstraction.
- [Glossary](../glossary) — the Chinese-English cross-reference and authoritative sources for the site's core terminology.
