# 第8部分：与其他语言对照

用「同一段逻辑、两边各跑一遍」的实测，对照 Rust 与 C/C++、Go、Java 在内存安全、错误处理、并发模型、泛型语义、构建系统与生态定位上的差异。结论以实测输出与官方文档为准。

- [Rust vs C/C++](vs-ccpp.md) —— 越界访问/悬垂指针在 Rust 编译期被拦下，在 C 里是 UB 或段错误；泛型与模板的检查时机差异；数据竞争编译期禁止 vs UB；cargo vs CMake；`Result` vs 返回码/异常。
- [Rust vs Go](vs-go.md) —— goroutine 与 tokio task 同处百万级但调度模型不同；`Result` + `?` 与 `if err != nil` 的错误处理对照；Go 默认静态链接 vs Rust 动态链接 libc；并发 GC vs 所有权；Go 1.18 泛型与 Rust trait bound。
- [Rust vs Java](vs-java.md) —— GC vs 所有权；`List<Integer>` 与 `List<Double>` 在 Java 运行时同类、Rust 是两种类型；NPE vs `Option`；默认虚调用 vs 显式 `dyn`；JMM 数据竞争「定义良好但不可预测」vs Rust 编译期禁止。
- [速查总表](cheatsheet-table.md) —— 按维度汇总：所有权/生命周期、错误处理、并发、内存管理、多态、宏/元编程、构建与依赖、类型系统、生态定位、学习曲线，每格标注依据类型。

---

- [语言核心](../language-core/) —— 所有权、借用、生命周期等基础概念。
- [异步与并发](../async/) —— Rust 侧 async/await 的完整语义。
- [知识点整理](../knowledge) —— 全站复习主线。
