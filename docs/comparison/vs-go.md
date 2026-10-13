# Rust vs Go：并发模型、错误处理与产物形态

Go 和 Rust 最常被拿来比较：都强调工程效率、都强类型、都编译到原生代码。但两者的**并发抽象**和**错误处理哲学**几乎是对照组——Go 用 goroutine + channel 把并发做成语言级原语，Rust 用所有权 + `async`/`await` 把并发安全做成类型系统约束。

## 并发模型：goroutine vs async task

Go 官方文档（Effective Go）对 goroutine 的定位：

> A goroutine has a simple model: it is a function executing concurrently with other goroutines in the same address space. It is lightweight, costing little more than the allocation of stack space. And the stacks start small, so they are cheap, and grow by allocating (and freeing) heap storage as required.
>
> Goroutines are multiplexed onto multiple OS threads so if one should block, such as while waiting for I/O, others continue to run.

goroutine 是**运行时调度**的轻量协程，栈按需增长，多路复用到少量 OS 线程。Rust 的对应物是 `async`/`await` + 执行器（tokio 等），同样是协作式调度的轻量单元。

同机实测（release 构建）：

| 实验 | 命令 | 结果 |
| --- | --- | --- |
| Go 100 万 goroutine | `go run g1_goroutines.go` | `1000000 goroutines done`，wall **2.87s** |
| Rust 100 万 tokio task | `cargo run --release` | `1000000 tokio tasks done`，wall **4.74s** |
| Rust 1 万 OS 线程 | `rustc r14_threads_scale.rs` | `count = 10000`，wall **5.07s** |

结论很直接：

- **Go goroutine 与 tokio task 在同一数量级**（百万级协程），这是两者真正的可比项。
- **`std::thread` 不是协程**：它直接映射 OS 线程，1 万个就耗时 5 秒，且受 OS 线程数/栈空间限制。Rust 要跑百万级并发必须走 `async` 任务。
- Go 的并发是**语言内建**（`go` 关键字 + 运行时调度器）；Rust 的并发是**语言 + 库**（`async`/`await` 是语言特性，执行器在标准库之外，tokio 是事实标准）。

channel 与 mpsc 的对照。Go 侧 `close` 后 `range` 自然结束，实测输出 `got 10 / got 20 / got 30`；Rust 侧 `drop` 发送端后 `for` 循环结束：

```rust
let (tx, rx) = mpsc::channel();
for i in 0..3 {
    let tx = tx.clone();
    thread::spawn(move || { tx.send(i * 10).unwrap(); });
}
drop(tx);
for got in rx { println!("got {got}"); }
```

真实运行输出（`rustc r12_mpsc.rs`）：

```text
got 10
got 0
got 20
```

顺序不确定——channel 只保证**同一发送端**的顺序，多发送端之间不保证。Go 的 channel 语义相同。

## 错误处理：`Result` + `?` vs 多返回值 + `if err != nil`

Go 没有异常，惯用模式是**多返回值**：函数返回 `(T, error)`，调用方立刻 `if err != nil`。Rust 用 `Result<T, E>` + `?`，错误是**类型化的值**，且 `?` 让错误传播在语法层面显式。

Go 侧实测（`go run g2_err.go`）：

```text
7/2 = 3
err: division by zero
```

Rust 侧实测（`rustc r8_result_question.rs`）：

```text
Ok(42)
Err(ParseIntError { kind: InvalidDigit })
```

| 维度 | Go | Rust |
| --- | --- | --- |
| 错误载体 | 多返回值 `(T, error)`，`error` 是接口 | `Result<T, E>`，`E` 是泛型参数 |
| 传播方式 | 每层手写 `if err != nil { return ..., err }` | `?` 运算符自动传播 |
| 能否被忽略 | 可以（丢弃返回值，编译器不报错） | 编译器警告 `unused_must_use`（`Result` 标注 `#[must_use]`） |
| 错误类型 | 运行时接口，可 `errors.Is` / `errors.As` | 编译期具体类型，可 `match` 穷尽 |

Go 的 `if err != nil` 在简单场景下直白，但**错误路径会淹没业务逻辑**，且编译器不会提醒你漏判。Rust 的 `?` 把「传播」和「处理」分开：`?` 负责传播，`match`/`unwrap_or` 负责处理，而 `Result` 是 `#[must_use]`——**忘记处理错误会被编译器点名**。

## 编译产物：体积、链接方式与启动

hello world 同机实测（优化构建）：

| 语言 | 构建命令 | 产物体积 | 链接方式（`file` / `ldd`） |
| --- | --- | --- | --- |
| C | `gcc -O2` | **15,952 B** | 动态链接 libc |
| Rust | `rustc -O -C debuginfo=0` | **4,536,400 B**（含 debug info；`strip` 后 **336,744 B**） | 动态链接 `libgcc_s.so.1` + `libc.so.6` |
| Go | `go build` | **2,342,537 B** | **静态链接**（`file` 报 `statically linked`，`ldd` 报 `not a dynamic executable`） |

几个值得注意的事实：

- **Go 默认静态链接**（纯 Go 代码、无 CGO 依赖时），产物自包含。这是实测结论，不是印象。
- **Rust 默认动态链接 libc/libgcc_s**（`ldd` 输出可见）。要静态链接需切到 musl target（`--target x86_64-unknown-linux-musl`）。
- **Rust 的 debug 信息是体积大头**：`rustc -O` 默认带 debug info（4.5MB），`strip` 后 337KB。
- 体积数字随版本、平台、依赖数量浮动，**不要跨环境比较绝对值**，比较量级和链接方式。

启动时间实测（各 3 次）：Rust ~0.00s、Go 0.00–0.01s、C ~0.00s、Java 0.18–0.19s（见 [Rust vs Java](./vs-java)）。原生三语言都在毫秒级。

## GC vs 无 GC

Go 官方 GC 指南（go.dev/doc/gc-guide）的要点：

> The Go GC is not fully stop-the-world and does most of its work concurrently with the application. This is primarily to reduce application latencies.

Go 的 GC 是**并发、非移动式**标记-清除，通过 `GOGC`（堆增长目标）和 `GOMEMLIMIT`（Go 1.19 起的内存上限）调节 CPU/内存/延迟权衡。代价是**运行时开销**：GC 线程与业务线程同时跑，占用 CPU 和内存。

Rust 没有 GC。内存释放由所有权在编译期决定，drop 顺序**确定且可预测**。实测（`rustc r11_drop_order.rs`）：

```text
main 主体结束
drop b
drop a
```

变量按声明**逆序** drop，嵌套作用域先 drop 内层。这个确定性是 RAII 的基础——文件句柄、锁、连接靠离开作用域自动释放，没有 GC 停顿，也没有「忘记释放」。

| 维度 | Go | Rust |
| --- | --- | --- |
| 内存管理 | 并发 GC（`GOGC`/`GOMEMLIMIT` 可调） | 所有权 + RAII，编译期决定 |
| 释放时机 | GC 运行时决定，不可预测 | 作用域结束，确定且逆序 |
| 运行时开销 | GC 线程常驻，有 CPU/内存成本 | 无 GC 线程；drop 有确定但微小的成本 |
| 循环引用 | GC 可回收（标记-清除） | `Rc` 会泄漏，需 `Weak` 或改用 `Arc` 设计 |

## 泛型：1.18 起 vs Rust 的 trait bound

Go 1.18 引入泛型（官方博客《An Introduction to Generics》：「The Go 1.18 release adds support for generics」）。Go 泛型的约束模型是**接口即类型集合**：

> In Go, type constraints must be interfaces. ... the type set defined by an interface specifies exactly the types that are permitted as type arguments.

Go 侧实测（`go run g5_generics.go`）：

```go
type Number interface { ~int | ~float64 }

func sum[T Number](xs []T) T {
    var total T
    for _, x := range xs { total += x }
    return total
}
```

真实运行输出：

```text
6
4
```

| 维度 | Go 泛型 | Rust 泛型 |
| --- | --- | --- |
| 引入版本 | Go 1.18（2022） | Rust 1.0（2015） |
| 约束表达 | 接口 + 类型集合（`~int \| ~float64`） | trait bound（`T: Add<Output = T>`） |
| 检查时机 | 实例化时（约束不满足在调用点报错） | **定义时**（trait bound 在定义处检查，见 [Rust vs C/C++](./vs-ccpp) 的 `E0369`） |
| 特化 | 无特化（社区长期讨论，未落地） | 无特化（`min_specialization` 未稳定） |
| 运行时表示 | 字典传递（GC shape 单态化 + 字典） | 单态化（零成本）或 `dyn Trait`（动态分发） |

关键差异：**Go 泛型在实例化时检查约束**，错误报在调用点（类似 C++ 模板）；**Rust 在定义时检查**，错误报在定义处并给出修复建议。

## 生态位与工程定位

| 维度 | Go | Rust |
| --- | --- | --- |
| 设计目标 | 简单、快速开发、网络服务与工具 | 安全、零成本抽象、系统编程 |
| 典型场景 | 微服务、CLI、DevOps 工具、云原生 | 操作系统、嵌入式、数据库/引擎、CLI |
| 并发原语 | 语言内建（goroutine/channel） | 语言 + 库（async/tokio、std::thread） |
| 内存管理 | 并发 GC | 所有权，无 GC |
| 学习曲线 | 语法极小，几天可上手 | 所有权/生命周期有显著学习成本 |
| 编译速度 | 以快著称（增量编译 + 缓存） | 以慢著称（单态化 + 借用检查） |

「Go 编译快、Rust 编译慢」是社区广泛流传的经验性结论，但**工程级编译时间取决于依赖图规模、增量编译配置和机器性能**，本页不做量化断言。hello world 单文件冷编译实测：Go 0.016–0.022s、Rust 0.067–0.078s、gcc 0.078–0.099s、javac 1.15–1.16s——单文件不具代表性，仅作量级参考。

## 注意事项与常见坑

- **goroutine 不是免费的**：百万级可行，但每个 goroutine 仍有栈和调度开销；CPU 密集型任务用 goroutine 不会比线程更快。
- **`std::thread` 不是 Rust 的并发答案**：需要百万级并发时用 `async` + tokio，否则会先撞上 OS 线程限制。
- **Go 的 `error` 是接口**：错误路径的**业务逻辑淹没**问题只能靠约定和 lint 工具缓解。
- **Rust 的 `?` 不是异常**：它是「提前返回 `Err`」的语法糖，没有栈展开成本，也不会跨越多层调用栈隐式传播。
- **两者都在向对方靠拢**：Go 在补泛型、在补 `any` 之外的抽象能力；Rust 在补异步生态、在改善编译速度。

## 相关页面

- [Rust vs C/C++](./vs-ccpp)——内存安全与泛型的另一条对照线。
- [Rust vs Java](./vs-java)——GC、泛型擦除与对象模型。
- [速查总表](./cheatsheet-table)——按维度逐项汇总。
- [所有权与移动语义](../language-core/ownership-and-move)——Rust 无 GC 的根基。
- [错误处理](../language-core/error-handling)——`Result` 与 `?` 的完整语义。

官方文档：<https://go.dev/doc/effective_go>
