# 零成本抽象

「零成本抽象（zero-cost abstraction）」常被当作口号，但它有确切含义，源自 C++ 的零开销原则：**你不用的抽象，不付钱；你用的抽象，不比手写差**。Rust 的迭代器、泛型、`impl Trait` 都按这个标准设计。这一页用真实的运行和汇编证据验证它。

## 迭代器链 vs 手写循环

迭代器链 `map + filter + sum` 看起来像「遍历三遍 + 两个中间集合」。实际计时（`rustc -O`，1000 万个元素）：

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

真实运行输出（三次运行互有胜负，差距属于噪声）：

```text
iter chain: sum = 33333336666666, 耗时 41.219398ms
hand loop: sum = 33333336666666, 耗时 47.383519ms
```

## 汇编证据：为什么能一样快

原因在编译期就注定了：迭代器是**惰性**的，`map`、`filter` 只是包装上层迭代器的小结构体，`next()` 一层层内联后，整条链塌缩成一个循环。用 `#[inline(never)]` 强制两个求和函数独立成函数，再 `rustc -O --emit=asm` 对比：

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

真实运行输出：

```text
chain = 3366  loop = 3366
```

真实汇编输出（x86-64，`chain_sum` 的热点循环；符号名是 v0 修饰的 `iter_vs_loop::chain_sum`）：

```text
.LBB6_5:
	movq	(%rdi,%r9,8), %r11
	movq	%r11, %rbx
	imulq	%rcx, %rbx
	addq	%r8, %rbx
	cmpq	%rdx, %rbx
	jb	.LBB6_6
```

- `movq (%rdi,%r9,8), %r11` 直接从切片取元素——**没有中间缓冲区**，`map`/`filter` 的包装结构体已被优化干净；
- `imulq %rcx, %rbx` 一带而过：`% 3` 的检查被编译器改写成一次魔数乘法（`%rcx` 里的 `6148914691236517206` 就是除 3 检验用的魔数）；而 `* 2` 更彻底——被代数化简挪出了循环，函数结尾那行 `leaq (%rax,%rax), %rdi` 才是那次乘 2；
- 两个函数体都约 80 行汇编、**各 0 条 `call` 指令**——没有任何被调用的「迭代器方法」，全部内联。

## 单态化：每个用到的类型一份代码

泛型的零成本来自**单态化**：编译器为每个实际用到的类型生成一份专属代码，静态分发、没有虚表。用 `nm` 可以直接在二进制里看到「一份」长什么样：

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

真实运行输出（`nm run_show_types | grep show` 的前三行）：

```text
0000000000015d00 t _RINvCseau0GDIhzNJ_10show_types4showdEB2_
0000000000015d40 t _RINvCseau0GDIhzNJ_10show_types4showlEB2_
0000000000015cb0 t _RINvCseau0GDIhzNJ_10show_types4showReEB2_
```

三个符号就是 `show` 的三份实例，结尾的 `d`、`l`、`Re` 分别对应类型参数 `f64`、`i32`、`&str`——源代码里只有一个 `show`，二进制里有三个，各自带着具体类型的代码。

## 「零成本」的边界

- **不用的抽象不付钱**：没有实例化的泛型不生成任何代码；迭代器链不 `collect` 就不分配中间集合；
- **用了的不比手写差**：静态分发 + 内联让抽象层在机器码里消失（上面的汇编就是证据）；
- **成本转移到了编译期**：单态化为每个类型复制一份代码，换来的是编译时间变长、二进制变大——「零」指的是**运行时开销**为零。

## 参考资料

- 官方文档：《The Rust Programming Language》第 13 章 · Performance in Loops vs. Iterators：<https://doc.rust-lang.org/book/ch13-04-performance.html>

## 相关页面

- [泛型与单态化](../language-core/generics-and-monomorphization)——单态化机制的入门讲法。
- [trait 对象](./trait-objects)——动态分发这条路线的代价对比。
- [关联类型](./associated-types)——迭代器抽象赖以成立的类型机制。
- [`impl Trait`](./impl-trait)——写这类抽象最常用的签名语法。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
