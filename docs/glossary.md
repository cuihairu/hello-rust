# 术语表

本表收录本站 Rust 语言核心、类型系统、内存与并发、异步、工具链与生态的核心术语，每条给出中英对照、一句话定义、权威出处与相关页。

**维护口径**：新增条目必须给出可点的权威出处（本表出处均为本站写作时逐条实测可达的官方文档）；查不到就写「未找到权威出处（待核）」，不得凭印象编造链接。

## 语言核心

### 所有权（Ownership）
Rust 的内存管理模型：每个值有唯一所有者，值离开作用域时其内存被自动释放。
**出处**：[The Book · What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)
**相关页**：[所有权与移动语义](/language-core/ownership-and-move)

### 借用（Borrowing）
通过引用临时使用值而不取得所有权；同一时刻要么多个共享引用，要么一个可变引用，不可并存。
**出处**：[The Book · References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
**相关页**：[借用与引用](/language-core/borrowing-and-references)

### 切片（Slice）
对连续内存片段的「指针 + 长度」视图；`&str` 与 `[T]` 切片是其具体形态。
**出处**：[The Book · The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html)
**相关页**：[切片与 &str](/language-core/slices-and-str)

### 枚举（Enum）
可在多个互斥变体中取其一的类型，变体可携带数据；`Option` 与 `Result` 是标准库最常用的两枚举。
**出处**：[The Book · Defining an Enum](https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html)
**相关页**：[枚举与模式匹配](/language-core/enums-and-pattern-matching)、[错误处理](/language-core/error-handling)

### 模式匹配（Pattern Matching）
`match`、`if let` 等语法按「形状」分解值的机制；编译器强制穷尽所有分支。
**出处**：[The Book · Patterns and Matching](https://doc.rust-lang.org/book/ch19-00-patterns.html)
**相关页**：[枚举与模式匹配](/language-core/enums-and-pattern-matching)

### trait（特征）
定义共享行为的接口，可带默认实现；类型用 `impl Trait for Type` 提供行为。
**出处**：[The Book · Defining Shared Behavior with Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)
**相关页**：[trait 与实现](/language-core/traits)

### 泛型（Generics）
类型参数化：函数与类型对「任意满足约束的类型」写一份代码，编译期展开。
**出处**：[The Book · Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)
**相关页**：[泛型与单态化](/language-core/generics-and-monomorphization)

### 单态化（Monomorphization）
编译器把泛型代码替换为实际用到的具体类型实例的过程，运行时零开销但膨胀二进制。
**出处**：[The Book · Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)
**相关页**：[泛型与单态化](/language-core/generics-and-monomorphization)

### 生命周期（Lifetime）
引用有效期的静态标注；只描述约束关系，不改变值的实际存活时间，编译期防悬垂引用。
**出处**：[The Book · Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)
**相关页**：[生命周期](/language-core/lifetimes)

### 错误处理（Error Handling）
可恢复错误走 `Result<T, E>` 与 `?` 传播，不可恢复错误走 `panic!`；`Option<T>` 表达「可能没有」。
**出处**：[The Book · Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)、[std::result](https://doc.rust-lang.org/std/result/)
**相关页**：[错误处理](/language-core/error-handling)

### 模块与 crate（Module and Crate）
crate 是编译单元与发布单元，模块控制代码组织与可见性；路径、`mod`、`use` 三件套。
**出处**：[The Book · Packages, Crates, and Modules](https://doc.rust-lang.org/book/ch07-00-managing-growing-projects-with-packages-crates-and-modules.html)
**相关页**：[cargo 常用工作流](/tooling/cargo-workflow)

## 类型系统

### trait 对象（Trait Object）
`dyn Trait`：数据指针 + vtable 的胖指针，运行时动态分发；与泛型静态分发是体积换性能的取舍。
**出处**：[The Rust Reference · Trait object types](https://doc.rust-lang.org/reference/types/trait-object.html)
**相关页**：[trait 对象与动态分发](/type-system/trait-objects)

### dyn 兼容性（Dyn Compatibility）
判定一个 trait 能否被做成 trait 对象的规则集合（旧称「对象安全」，object safety）。
**出处**：[The Rust Reference · Traits（Dyn compatibility 节）](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility)
**相关页**：[trait 对象与动态分发](/type-system/trait-objects)

### 关联类型（Associated Type）
trait 内部的类型占位符；一个实现对每个关联类型只给一个具体类型，如 `Iterator::Item`。
**出处**：[The Rust Reference · Associated items](https://doc.rust-lang.org/reference/items/associated-items.html)
**相关页**：[associated types](/type-system/associated-types)

### 孤儿规则（Orphan Rule）
实现必须满足「trait 或类型之一属于当前 crate」，防止依赖图中的实现冲突。
**出处**：[The Rust Reference · Implementations（Orphan rules 节）](https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules)
**相关页**：[孤儿规则与 newtype](/type-system/orphan-rule-and-newtype)

### impl Trait
「不写出具体类型」的静态抽象：参数位置对调用方隐藏类型，返回位置由编译器生成唯一具体类型。
**出处**：[The Rust Reference · Impl trait type](https://doc.rust-lang.org/reference/types/impl-trait.html)
**相关页**：[impl Trait](/type-system/impl-trait)

### 零成本抽象（Zero-cost Abstraction）
高层抽象不付出额外运行时代价：抽象在编译期消除，只为你用到的部分付账。
**出处**：[Rust Blog · Abstraction without overhead: traits in Rust](https://blog.rust-lang.org/2015/05/11/traits/)
**相关页**：[零成本抽象](/type-system/zero-cost-abstraction)

### 闭包（Closure）
捕获所在环境变量的匿名函数；编译为实现 `Fn`/`FnMut`/`FnOnce` 的类型。
**出处**：[The Book · Closures](https://doc.rust-lang.org/book/ch13-01-closures.html)
**相关页**：[闭包与 Fn 家族](/type-system/closures-and-fn-trait-family)

## 内存与并发

### 智能指针（Smart Pointer）
带额外元数据与所有权语义的指针类型：`Box`、`Rc`、`RefCell` 等。
**出处**：[The Book · Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)、[std::boxed::Box](https://doc.rust-lang.org/std/boxed/struct.Box.html)
**相关页**：[智能指针](/memory-concurrency/smart-pointers)

### 内部可变性（Interior Mutability）
在仅有共享引用的前提下改变内部状态的规则：借用检查从编译期挪到运行时（`RefCell`）。
**出处**：[The Book · RefCell&lt;T&gt; and the Interior Mutability Pattern](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html)、[std::cell::RefCell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)
**相关页**：[内部可变性](/memory-concurrency/interior-mutability)

### Copy（Copy Trait）
按位复制语义的标记 trait：赋值即复制、离开作用域不执行析构；与 `Drop` 互斥。
**出处**：[std::marker::Copy](https://doc.rust-lang.org/std/marker/trait.Copy.html)
**相关页**：[所有权与移动语义](/language-core/ownership-and-move)

### Drop（Drop Trait）
值离开作用域时执行的析构逻辑；与 RAII 直接对应，`dropck` 约束其借用存活期。
**出处**：[std::ops::Drop](https://doc.rust-lang.org/std/ops/trait.Drop.html)、[The Rustonomicon · Drop Check](https://doc.rust-lang.org/nomicon/dropck.html)
**相关页**：[Drop 与析构](/memory-concurrency/drop-and-destructors)

### Send 与 Sync
跨线程安全性的标记 trait：`Send` 表示所有权可转移至别的线程，`Sync` 表示共享引用可跨线程使用。
**出处**：[The Rustonomicon · Send and Sync](https://doc.rust-lang.org/nomicon/send-and-sync.html)、[std::marker::Send](https://doc.rust-lang.org/std/marker/trait.Send.html)
**相关页**：[Send 与 Sync](/memory-concurrency/send-and-sync)

### Mutex（互斥锁）
包装共享数据的互斥锁；`lock()` 返回守卫值，作用域结束即解锁，数据被类型系统保护。
**出处**：[std::sync::Mutex](https://doc.rust-lang.org/std/sync/struct.Mutex.html)
**相关页**：[无畏并发](/memory-concurrency/threads-and-channels)

### 无畏并发（Fearless Concurrency）
Rust 的并发主张：借用检查与 `Send`/`Sync` 让数据竞争在编译期报错，而不是运行期爆炸。
**出处**：[The Book · Fearless Concurrency](https://doc.rust-lang.org/book/ch16-00-concurrency.html)
**相关页**：[无畏并发](/memory-concurrency/threads-and-channels)

### 未定义行为（Undefined Behavior）
Rust 安全代码不会触发的语言级未定义行为集合；只有 unsafe 代码可能踩到。
**出处**：[The Rust Reference · Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)
**相关页**：[Rust vs C/C++](/comparison/vs-ccpp)

### 自定义分配器（Global Allocator）
实现 `GlobalAlloc` 接口接管全局内存分配；`#[global_allocator]` 指定实例。
**出处**：[std::alloc::GlobalAlloc](https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html)
**相关页**：[自定义分配器](/memory-concurrency/custom-allocator)

## 异步

### Future（Future Trait）
异步计算的核心抽象：`poll` 推进状态机，`Pending` 让出、`Ready` 交付。
**出处**：[std::future::Future](https://doc.rust-lang.org/std/future/trait.Future.html)
**相关页**：[async/await 与 Future](/async/async-await-and-future)

### async/await
`async fn`/`async` 块把代码编译为实现 `Future` 的状态机；`await` 挂起直到就绪。
**出处**：[《Asynchronous Programming in Rust》官方书](https://rust-lang.github.io/async-book/)
**相关页**：[async/await 与 Future](/async/async-await-and-future)

### 执行器（Executor）
驱动 Future 完成的调度循环：唤醒入队、轮询推进；Rust 只定抽象不定实现。
**出处**：[《Asynchronous Programming in Rust》· Applied: Build an Executor](https://rust-lang.github.io/async-book/02_execution/04_executor.html)
**相关页**：[执行器与运行时](/async/executors-and-runtime)

### Pin（钉住）
`std::pin`：保证值在移动后位置不变，是自引用 Future 安全存在的前提。
**出处**：[std 标准库 · std::pin](https://doc.rust-lang.org/std/pin/index.html)
**相关页**：[Pin 与自引用](/async/pin-and-self-reference)

### Tokio
Rust 生态最主流的异步运行时：执行器、定时器、IO 驱动与任务协作工具的集合。
**出处**：[Tokio 官方教程](https://tokio.rs/tokio/tutorial)
**相关页**：[tokio 生态](/async/tokio-ecosystem)

## 工具链与生态

### Cargo
Rust 的构建系统与包管理器：依赖解析、构建脚本、测试基准、发布一条龙。
**出处**：[The Cargo Book](https://doc.rust-lang.org/cargo/)
**相关页**：[cargo 常用工作流](/tooling/cargo-workflow)

### Workspace（工作空间）
共享一份锁文件与 `target/` 的多 crate 工程；路径依赖自动成为成员。
**出处**：[The Cargo Book · Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)
**相关页**：[workspace 与多 crate 工程](/ecosystem/workspace)

### crate 发布（Publishing）
`cargo publish` 把 crate 发布到 crates.io；路径依赖需先补版本号。
**出处**：[The Cargo Book · Publishing on crates.io](https://doc.rust-lang.org/cargo/reference/publishing.html)
**相关页**：[发布 crate 到 crates.io](/ecosystem/publish-crate)

### rustup
官方工具链安装器：多版本 Rust、组件与目标三元组管理。
**出处**：[The rustup book](https://rust-lang.github.io/rustup/)
**相关页**：[rustup 与 MSRV](/tooling/rustup-msrv)

### Clippy
官方 lint 工具：500+ 条规则捕捉惯用法偏差与常见错误。
**出处**：[Clippy 官方 lint 列表](https://rust-lang.github.io/rust-clippy/master/)
**相关页**：[clippy 与 lint](/tooling/clippy-lints)

### Rustfmt
官方代码格式化工具：风格争议交给工具，review 只看逻辑。
**出处**：[Rustfmt 官方文档](https://rust-lang.github.io/rustfmt/)
**相关页**：[rustfmt 与代码风格](/tooling/rustfmt-style)

### rust-analyzer
官方推荐的 LSP 实现：跳转、补全、内联错误、宏展开都靠它。
**出处**：[rust-analyzer 官网](https://rust-analyzer.github.io/)
**相关页**：[rust-analyzer 与编辑器](/tooling/rust-analyzer-editor)

### 交叉编译（Cross Compilation）
为目标三元组编译：`--target` 指定平台，链接器与 sysroot 另配。
**出处**：[The rustc book · Platform Support](https://doc.rust-lang.org/rustc/platform-support.html)
**相关页**：[交叉编译](/memory-concurrency/cross-compilation)、[交叉编译实战](/tooling/cross-compilation-practice)

### FFI（Foreign Function Interface）
与其他语言互操作的边界：`extern` 声明、`#[no_mangle]` 导出、谁分配谁释放。
**出处**：[The Rustonomicon · FFI](https://doc.rust-lang.org/nomicon/ffi.html)
**相关页**：[FFI 与 C 互操作](/ecosystem/ffi-c-interop)

### no_std 与嵌入式（Embedded）
无标准库的运行环境：`#![no_std]` 搭配 `core`/`alloc`，面向 MCU 与裸机。
**出处**：[The Embedded Rust Book](https://docs.rust-embedded.org/book/)
**相关页**：[嵌入式 Rust](/ecosystem/embedded-nostd)

### WebAssembly（Wasm）
浏览器与宿主环境运行 Rust 的目标平台；`wasm-bindgen` 桥接 JS。
**出处**：[《Rust and WebAssembly》官方书](https://rustwasm.github.io/docs/book/)
**相关页**：[WebAssembly](/ecosystem/wasm)

## 相关页面

- [知识点整理](./knowledge.md)——全站复习主线，术语在这里逐条展开。
