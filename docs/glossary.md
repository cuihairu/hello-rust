---
title: 术语表
layout: page
---

# 术语表

同一门语言里，「所有权」在 Rust 与 C++ 的含义完全不同，「零成本」在不同主题各有所指。这里集中整理全站八个主题的核心术语，给出统一释义和所在主题，并链接回原文。支持检索，也可按主题浏览。

词条中的「出处」链接指向经实测可用的官方文档（The Rust Programming Language、The Rust Reference、The Cargo Book、std 文档、Tokio 教程等），逐条经 curl 验证；查无权威出处的词条不写链接，不用印象代替出处。

## 维护口径

新增条目必须给出可点的权威出处（须先实测可用）；查不到就写「未找到权威出处（待核）」，不得凭印象编造链接。出处链接的章节名一律取自该页实测 `<title>`，不手写猜测。

## 语言核心

### 所有权（Ownership）

每个值在任一时刻有且仅有一个 owner；赋值与传参默认转移所有权，owner 离开作用域时值被 drop。

**出处**：[《The Rust Programming Language》· What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)、[std · Drop in std::ops](https://doc.rust-lang.org/std/ops/trait.Drop.html)

**相关页**：[language-core/ownership-and-move](/language-core/ownership-and-move)、[memory-concurrency/drop-and-destructors](/memory-concurrency/drop-and-destructors)

### 借用（Borrowing）

以引用方式使用值而不转移所有权；同一时刻要么多个共享引用 `&T`，要么一个可变引用 `&mut T`。

**出处**：[《The Rust Programming Language》· References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)、[《The Rust Reference》· Visibility and privacy](https://doc.rust-lang.org/reference/visibility-and-privacy.html)

**相关页**：[language-core/borrowing-and-references](/language-core/borrowing-and-references)、[memory-concurrency/interior-mutability](/memory-concurrency/interior-mutability)

### 切片（Slice）

对连续内存的一段视图，用「指针 + 长度」的胖指针表示，不拥有数据。

**出处**：[《The Rust Programming Language》· The Slice Type](https://doc.rust-lang.org/book/ch04-03-slices.html)、[std · slice](https://doc.rust-lang.org/std/primitive.slice.html)

**相关页**：[language-core/slices-and-str](/language-core/slices-and-str)

### 生命周期（Lifetime）

标注引用之间的有效期约束关系；`'static` 表示整个程序期间有效，是 trait 对象的上界要求。

**出处**：[《The Rust Programming Language》· Validating References with Lifetimes](https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html)、[《The Rust Reference》· Trait and lifetime bounds](https://doc.rust-lang.org/reference/trait-bounds.html)

**相关页**：[language-core/lifetimes](/language-core/lifetimes)、[type-system/trait-objects](/type-system/trait-objects)

### 结构体（Struct）

具命或匿名的数据结构；具名字段按名访问，字段可为元组式或具名式。

**出处**：[《The Rust Programming Language》· Defining and Instantiating Structs](https://doc.rust-lang.org/book/ch05-01-defining-structs.html)

**相关页**：[language-core/ownership-and-move](/language-core/ownership-and-move)、[memory-concurrency/smart-pointers](/memory-concurrency/smart-pointers)

### 枚举（Enum）

代数数据类型：每个变体可携带数据，`match` 强制穷尽所有可能路径。

**出处**：[《The Rust Programming Language》· Defining an Enum](https://doc.rust-lang.org/book/ch06-01-defining-an-enum.html)

**相关页**：[language-core/enums-and-pattern-matching](/language-core/enums-and-pattern-matching)

### 模式匹配（Pattern Matching）

`match`、`if let`、`while let`、`let` 解构与循环中解构的结构化取值机制。

**出处**：[《The Rust Programming Language》· The match Control Flow Construct](https://doc.rust-lang.org/book/ch06-02-match.html)、[《The Rust Programming Language》· Concise Control Flow with if let and let...else](https://doc.rust-lang.org/book/ch06-03-if-let.html)、[《The Rust Programming Language》· All the Places Patterns Can Be Used](https://doc.rust-lang.org/book/ch19-01-all-the-places-for-patterns.html)

**相关页**：[language-core/enums-and-pattern-matching](/language-core/enums-and-pattern-matching)

### trait

定义方法签名与关联项的抽象接口；`impl Trait for Type` 实现行为，trait bound 约束泛型。

**出处**：[《The Rust Programming Language》· Defining Shared Behavior with Traits](https://doc.rust-lang.org/book/ch10-02-traits.html)、[Rust Blog · Abstraction without overhead: traits in Rust](https://blog.rust-lang.org/2015/05/11/traits/)

**相关页**：[language-core/traits](/language-core/traits)、[type-system/associated-types](/type-system/associated-types)

### 泛型与单态化（Generics and Monomorphization）

泛型在编译期为每个具体类型生成一份特化代码，运行时零额外开销。

**出处**：[《The Rust Programming Language》· Generic Types, Traits, and Lifetimes](https://doc.rust-lang.org/book/ch10-00-generics.html)、[《The Rust Programming Language》· Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)

**相关页**：[language-core/generics-and-monomorphization](/language-core/generics-and-monomorphization)、[type-system/zero-cost-abstraction](/type-system/zero-cost-abstraction)

### 错误处理（Error Handling）

`Result` 表达可恢复错误、`Option` 表达有无、`panic!` 表达不可恢复错误；`?` 在函数内向上传播。

**出处**：[《The Rust Programming Language》· Error Handling](https://doc.rust-lang.org/book/ch09-00-error-handling.html)、[《The Rust Programming Language》· Recoverable Errors with Result](https://doc.rust-lang.org/book/ch09-02-recoverable-errors-with-result.html)、[std · Result in std::result](https://doc.rust-lang.org/std/result/enum.Result.html)、[std · Option in std::option](https://doc.rust-lang.org/std/option/enum.Option.html)

**相关页**：[language-core/error-handling](/language-core/error-handling)

### 包与 crate（Package and Crate）

包是构建与发布单元，crate 是编译单元；一个包可含多个 crate（含库与二进制目标）。

**出处**：[《The Rust Programming Language》· Packages and Crates](https://doc.rust-lang.org/book/ch07-01-packages-and-crates.html)、[《The Rust Programming Language》· Control Scope and Privacy with Modules](https://doc.rust-lang.org/book/ch07-02-defining-modules-to-control-scope-and-privacy.html)

**相关页**：[ecosystem/workspace](/ecosystem/workspace)、[ecosystem/publish-crate](/ecosystem/publish-crate)

### Copy trait

标记「按位复制而非 move」的自动 trait；实现 `Copy` 的类型不能同时实现 `Drop`。

**出处**：[std · Copy in std::marker](https://doc.rust-lang.org/std/marker/trait.Copy.html)、[《The Rust Programming Language》· What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)

**相关页**：[language-core/ownership-and-move](/language-core/ownership-and-move)、[memory-concurrency/drop-and-destructors](/memory-concurrency/drop-and-destructors)

## 类型系统与抽象

### trait 对象（Trait Object / dyn Trait）

以胖指针（数据指针 + vtable）表达「对满足该 trait 的任意类型」的抽象；要求 `'static` 与对象安全。

**出处**：[《The Rust Programming Language》· Using Trait Objects to Abstract over Shared Behavior](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)、[《The Rust Reference》· Traits](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility)、[《The Rust Reference》· Trait object types](https://doc.rust-lang.org/reference/types/trait-object.html)

**相关页**：[type-system/trait-objects](/type-system/trait-objects)、[language-core/traits](/language-core/traits)

### 动态分发（Dynamic Dispatch）

运行时经 vtable 查表调用方法，与泛型的静态分发是「体积换性能」的反向取舍。

**出处**：[《The Rust Programming Language》· Performance in Loops vs. Iterators](https://doc.rust-lang.org/book/ch13-04-performance.html)

**相关页**：[type-system/trait-objects](/type-system/trait-objects)、[type-system/zero-cost-abstraction](/type-system/zero-cost-abstraction)

### dyn 兼容性（dyn Compatibility）

一个 trait 能否做成 `dyn Trait` 须满足对象安全：方法不能有泛型、不能 `impl Trait` 返回等。

**出处**：[《The Rust Reference》· Traits](https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility)、[《The Rust Programming Language》· Using Trait Objects to Abstract over Shared Behavior](https://doc.rust-lang.org/book/ch18-02-trait-objects.html)

**相关页**：[type-system/trait-objects](/type-system/trait-objects)、[type-system/associated-types](/type-system/associated-types)

### 关联类型（Associated Type）

trait 中声明的单一类型占位符，同一实现只有一个 `Item` 之类取值。

**出处**：[《The Rust Programming Language》· Advanced Traits](https://doc.rust-lang.org/book/ch20-02-advanced-traits.html)

**相关页**：[type-system/associated-types](/type-system/associated-types)、[language-core/traits](/language-core/traits)

### 零成本抽象（Zero-cost Abstraction）

高层抽象编译后不产生额外运行时开销；traits 的博客原文即以此命名。

**出处**：[Rust Blog · Abstraction without overhead: traits in Rust](https://blog.rust-lang.org/2015/05/11/traits/)、[《The Rust Programming Language》· Performance in Loops vs. Iterators](https://doc.rust-lang.org/book/ch13-04-performance.html)

**相关页**：[type-system/zero-cost-abstraction](/type-system/zero-cost-abstraction)

### 孤儿规则（Orphan Rule）

禁止为「外部 trait + 外部类型」写 impl，保证各 crate 新增实现不冲突（E0117）。

**出处**：[《The Rust Reference》· Implementations](https://doc.rust-lang.org/reference/items/implementations.html#orphan-rules)

**相关页**：[type-system/orphan-rule-and-newtype](/type-system/orphan-rule-and-newtype)

### newtype 模式（Newtype）

用单字段新类型包裹外部类型，既满足孤儿规则又获得额外类型安全。

**出处**：[《The Rust Programming Language》· Advanced Types](https://doc.rust-lang.org/book/ch20-03-advanced-types.html)

**相关页**：[type-system/orphan-rule-and-newtype](/type-system/orphan-rule-and-newtype)

### impl Trait

参数位置等价于匿名泛型参数，编译期静态分发；返回位置隐藏具体类型。

**出处**：[《The Rust Reference》· Impl trait type](https://doc.rust-lang.org/reference/types/impl-trait.html)、[《The Rust Programming Language》· Advanced Functions and Closures](https://doc.rust-lang.org/book/ch20-04-advanced-functions-and-closures.html)

**相关页**：[type-system/impl-trait](/type-system/impl-trait)

### 运算符重载（Operator Overloading）

重写 `std::ops` 中的 `Add`/`Index` 等 trait 即重载对应运算符；`Deref` 驱动自动解引用。

**出处**：[std · std::ops](https://doc.rust-lang.org/std/ops/)、[《The Rust Programming Language》· Treating Smart Pointers Like Regular References](https://doc.rust-lang.org/book/ch15-02-deref.html)、[std · Deref in std::ops](https://doc.rust-lang.org/std/ops/trait.Deref.html)

**相关页**：[type-system/operator-overloading](/type-system/operator-overloading)、[memory-concurrency/smart-pointers](/memory-concurrency/smart-pointers)

### 闭包与 Fn 家族（Closures and Fn Traits）

捕获环境的匿名函数；`Fn` 只读捕获、`FnMut` 可变捕获、`FnOnce` 可能移动捕获，`move` 强制按值捕获。

**出处**：[《The Rust Programming Language》· Closures](https://doc.rust-lang.org/book/ch13-01-closures.html)、[std · Fn in std::ops](https://doc.rust-lang.org/std/ops/trait.Fn.html)、[std · FnMut in std::ops](https://doc.rust-lang.org/std/ops/trait.FnMut.html)、[std · FnOnce in std::ops](https://doc.rust-lang.org/std/ops/trait.FnOnce.html)

**相关页**：[type-system/closures-and-fn-trait-family](/type-system/closures-and-fn-trait-family)

### 类型擦除（Type Erasure）

把异构具体类型藏在同一运行时表示之后；Rust 用 `dyn Trait` + vtable 实现，Java 泛型则在字节码层擦除。

**出处**：[《The Rust Reference》· Trait object types](https://doc.rust-lang.org/reference/types/trait-object.html)、[Java Tutorials · Type Erasure](https://docs.oracle.com/javase/tutorial/java/generics/erasure.html)

**相关页**：[type-system/trait-objects](/type-system/trait-objects)、[comparison/vs-java](/comparison/vs-java)

## 内存与并发

### 析构与 Drop

值离开作用域时按声明逆序析构；实现 `Drop` 即定制清理逻辑。

**出处**：[《The Rust Programming Language》· Running Code on Cleanup with the Drop Trait](https://doc.rust-lang.org/book/ch15-03-drop.html)、[std · Drop in std::ops](https://doc.rust-lang.org/std/ops/trait.Drop.html)

**相关页**：[memory-concurrency/drop-and-destructors](/memory-concurrency/drop-and-destructors)

### 智能指针（Smart Pointer）

实现 `Deref` 的指针类型；`Box` 堆上唯一所有权，`Rc`/`Arc` 共享计数，`Weak` 不计强引用。

**出处**：[《The Rust Programming Language》· Smart Pointers](https://doc.rust-lang.org/book/ch15-00-smart-pointers.html)、[《The Rust Programming Language》· Using Box&lt;T&gt; to Point to Data on the Heap](https://doc.rust-lang.org/book/ch15-01-box.html)、[std · Box in std::boxed](https://doc.rust-lang.org/std/boxed/struct.Box.html)

**相关页**：[memory-concurrency/smart-pointers](/memory-concurrency/smart-pointers)

### 引用计数（Reference Counting）

`Rc` 单线程、`Arc` 跨线程共享所有权；强引用成环会永不归零，需 `Weak` 破环。

**出处**：[《The Rust Programming Language》· Rc&lt;T&gt;, the Reference Counted Smart Pointer](https://doc.rust-lang.org/book/ch15-04-rc.html)、[《The Rust Programming Language》· Reference Cycles Can Leak Memory](https://doc.rust-lang.org/book/ch15-06-reference-cycles.html)、[std · Arc in std::sync](https://doc.rust-lang.org/std/sync/struct.Arc.html)、[std · Weak in std::sync](https://doc.rust-lang.org/std/sync/struct.Weak.html)

**相关页**：[memory-concurrency/smart-pointers](/memory-concurrency/smart-pointers)

### 内部可变性（Interior Mutability）

通过 `&self` 修改自身状态，把借用检查推迟到运行时；`Cell` 整体替换值，`RefCell` 运行时借用计数。

**出处**：[《The Rust Programming Language》· RefCell&lt;T&gt; and the Interior Mutability Pattern](https://doc.rust-lang.org/book/ch15-05-interior-mutability.html)、[std · Cell in std::cell](https://doc.rust-lang.org/std/cell/struct.Cell.html)、[std · RefCell in std::cell](https://doc.rust-lang.org/std/cell/struct.RefCell.html)

**相关页**：[memory-concurrency/interior-mutability](/memory-concurrency/interior-mutability)

### Send 与 Sync

自动 trait，按字段组成推导；`Send` 表示可跨线程移动，`Sync` 表示 `&T` 可跨线程共享。

**出处**：[《The Rust Programming Language》· Extensible Concurrency with Send and Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html)、[std · Send in std::marker](https://doc.rust-lang.org/std/marker/trait.Send.html)、[std · Sync in std::marker](https://doc.rust-lang.org/std/marker/trait.Sync.html)、[《The Rustonomicon》· Send and Sync](https://doc.rust-lang.org/nomicon/send-and-sync.html)

**相关页**：[memory-concurrency/send-and-sync](/memory-concurrency/send-and-sync)、[memory-concurrency/threads-and-channels](/memory-concurrency/threads-and-channels)

### 无畏并发（Fearless Concurrency）

所有权与类型系统在编译期排除数据竞争，使跨线程编程无需人工加锁推理。

**出处**：[《The Rust Programming Language》· Fearless Concurrency](https://doc.rust-lang.org/book/ch16-00-concurrency.html)

**相关页**：[memory-concurrency/threads-and-channels](/memory-concurrency/threads-and-channels)

### 线程与消息传递（Threads and Message Passing）

`std::thread` 起线程，`mpsc` channel 传数据；发送即转移所有权。

**出处**：[《The Rust Programming Language》· Using Threads to Run Code Simultaneously](https://doc.rust-lang.org/book/ch16-01-threads.html)、[《The Rust Programming Language》· Transfer Data Between Threads with Message Passing](https://doc.rust-lang.org/book/ch16-02-message-passing.html)、[std · std::thread](https://doc.rust-lang.org/std/thread/index.html)、[std · std::sync::mpsc](https://doc.rust-lang.org/std/sync/mpsc/index.html)

**相关页**：[memory-concurrency/threads-and-channels](/memory-concurrency/threads-and-channels)

### 共享状态（Shared State）

跨线程共享可变状态用 `Mutex`/`RwLock`；守卫对象与 guard 同生命周期绑定。

**出处**：[《The Rust Programming Language》· Shared-State Concurrency](https://doc.rust-lang.org/book/ch16-03-shared-state.html)、[std · Mutex in std::sync](https://doc.rust-lang.org/std/sync/struct.Mutex.html)、[std · RwLock in std::sync](https://doc.rust-lang.org/std/sync/struct.RwLock.html)

**相关页**：[memory-concurrency/threads-and-channels](/memory-concurrency/threads-and-channels)

### 原子类型（Atomics）

`std::sync::atomic` 提供无锁的整数原子操作与内存序控制。

**出处**：[std · std::sync::atomic](https://doc.rust-lang.org/std/sync/atomic/index.html)、[《The Rust Programming Language》· Extensible Concurrency with Send and Sync](https://doc.rust-lang.org/book/ch16-04-extensible-concurrency-sync-and-send.html)

**相关页**：[memory-concurrency/send-and-sync](/memory-concurrency/send-and-sync)

### unsafe 与未定义行为（Unsafe and UB）

`unsafe` 解锁五类编译器无法验证的操作；Reference 明确定义了「未定义行为」清单。

**出处**：[《The Rust Programming Language》· Unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html)、[《The Rust Reference》· The unsafe keyword](https://doc.rust-lang.org/reference/unsafe-keyword.html)、[《The Rust Reference》· Behavior considered undefined](https://doc.rust-lang.org/reference/behavior-considered-undefined.html)、[《The Rustonomicon》· Introduction](https://doc.rust-lang.org/nomicon/)

**相关页**：[ecosystem/ffi-c-interop](/ecosystem/ffi-c-interop)、[memory-concurrency/custom-allocator](/memory-concurrency/custom-allocator)

## 异步

### Future

代表一个将来可能完成的计算；`poll` 返回 `Ready(T)` 或 `Pending`，不 poll 就不会推进。

**出处**：[std · Future in std::future](https://doc.rust-lang.org/std/future/trait.Future.html)、[《The Rust Programming Language》· Futures and the Async Syntax](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html)

**相关页**：[async/async-await-and-future](/async/async-await-and-future)

### async / await

`async fn` 构造 Future，`await` 是一次挂起-恢复的状态转移，不阻塞线程。

**出处**：[《The Rust Programming Language》· Futures and the Async Syntax](https://doc.rust-lang.org/book/ch17-01-futures-and-syntax.html)、[《The Rust Programming Language》· Applying Concurrency with Async](https://doc.rust-lang.org/book/ch17-02-concurrency-with-async.html)

**相关页**：[async/async-await-and-future](/async/async-await-and-future)

### 执行器（Executor）

反复调用 `poll` 驱动 Future 的那层代码；`block_on` 即最简单的执行器。

**出处**：[async-book · Applied: Build an Executor](https://rust-lang.github.io/async-book/02_execution/04_executor.html)、[std · std::task](https://doc.rust-lang.org/std/task/index.html)

**相关页**：[async/executors-and-runtime](/async/executors-and-runtime)

### Waker

唤醒注册表句柄：执行器在 Future 返回 `Pending` 后用它安排再次 poll。

**出处**：[std · Waker in std::task](https://doc.rust-lang.org/std/task/struct.Waker.html)、[async-book · Runtimes](https://rust-lang.github.io/async-book/part-guide/runtimes.html)

**相关页**：[async/executors-and-runtime](/async/executors-and-runtime)、[async/pin-and-self-reference](/async/pin-and-self-reference)

### Pin 与自引用（Pin and Self-Referential）

`Pin` 保证被指向的值不会被移动，async 状态机由此安全；`Unpin` 类型不受约束。

**出处**：[std · std::pin](https://doc.rust-lang.org/std/pin/index.html)、[async-book · Concurrent programming](https://rust-lang.github.io/async-book/part-guide/concurrency.html)

**相关页**：[async/pin-and-self-reference](/async/pin-and-self-reference)

### select 与协作式取消（Select and Cancellation）

`select!` 命中一个分支即丢弃其余分支，是协作式取消的基础。

**出处**：[Tokio · Select | Tokio](https://tokio.rs/tokio/tutorial/select)

**相关页**：[async/select-and-cancellation](/async/select-and-cancellation)

### 多线程运行时（Multi-threaded Runtime）

Tokio 等运行时用工作线程池并行 poll 任务，需开启 `Send` 约束。

**出处**：[Tokio · Shared state | Tokio](https://tokio.rs/tokio/tutorial/shared-state)、[Tokio · Spawning | Tokio](https://tokio.rs/tokio/tutorial/spawning)

**相关页**：[async/tokio-ecosystem](/async/tokio-ecosystem)、[async/executors-and-runtime](/async/executors-and-runtime)

### Tokio

事实标准的异步运行时，提供 `spawn`、定时器、同步原语与 channel。

**出处**：[Tokio · Tutorial | Tokio](https://tokio.rs/tokio/tutorial)、[Tokio · Channels | Tokio](https://tokio.rs/tokio/tutorial/channels)、[Tokio · Streams | Tokio](https://tokio.rs/tokio/tutorial/streams)

**相关页**：[async/tokio-ecosystem](/async/tokio-ecosystem)

### 异步中的 trait（Traits for Async）

`async fn` in trait 与 `trait_variant` 让异步方法可被泛型与 trait 对象使用。

**出处**：[《The Rust Programming Language》· A Closer Look at the Traits for Async](https://doc.rust-lang.org/book/ch17-05-traits-for-async.html)、[《The Rust RFC Book》· 3185-static-async-fn-in-trait](https://rust-lang.github.io/rfcs/3185-static-async-fn-in-trait.html)

**相关页**：[async/async-send-and-async-trait](/async/async-send-and-async-trait)、[language-core/traits](/language-core/traits)

## 宏

### 声明宏（Declarative Macros / macro_rules!）

按 token 匹配改写代码的编译期宏，不引入运行时抽象。

**出处**：[《The Rust Programming Language》· Macros](https://doc.rust-lang.org/book/ch20-05-macros.html)、[《The Rust Reference》· Macros by example](https://doc.rust-lang.org/reference/macros-by-example.html)

**相关页**：[macros/declarative-macros](/macros/declarative-macros)

### 过程宏（Procedural Macros）

以 Rust 代码实现的编译器插件，运行在编译期，能解析任意 token 流。

**出处**：[《The Rust Reference》· Procedural macros](https://doc.rust-lang.org/reference/procedural-macros.html)、[《The Rust Programming Language》· Generic Data Types](https://doc.rust-lang.org/book/ch10-01-syntax.html)

**相关页**：[macros/proc-macros](/macros/proc-macros)

## 工具链与工程

### Cargo

官方构建与依赖管理工具，统一了构建、测试、文档、发布全流程。

**出处**：[《Cargo Book》· Introduction](https://doc.rust-lang.org/cargo/)、[《Cargo Book》· cargo build](https://doc.rust-lang.org/cargo/commands/cargo-build.html)

**相关页**：[tooling/cargo-workflow](/tooling/cargo-workflow)

### rustup

官方工具链管理器，负责安装与切换 toolchain、component 与 target。

**出处**：[rustup book · Introduction](https://rust-lang.github.io/rustup/)、[rustup book · Toolchains](https://rust-lang.github.io/rustup/concepts/toolchains.html)、[rustup book · Components](https://rust-lang.github.io/rustup/concepts/components.html)

**相关页**：[tooling/rustup-msrv](/tooling/rustup-msrv)

### rustfmt

官方格式化工具，配置项由 `rustfmt.toml` 或 `.rustfmt.toml` 提供。

**出处**：[rustfmt](https://rust-lang.github.io/rustfmt/)、[rustfmt · Configurations.md](https://github.com/rust-lang/rustfmt/blob/master/Configurations.md)

**相关页**：[tooling/rustfmt-style](/tooling/rustfmt-style)

### Clippy

官方 lint 集合，覆盖风格、易错写法与代码异味，`clone_on_copy`、`ptr_arg` 等是高频命中项。

**出处**：[《Cargo Book》· cargo clippy](https://doc.rust-lang.org/cargo/commands/cargo-clippy.html)、[Clippy Lints · clone_on_copy](https://rust-lang.github.io/rust-clippy/master/index.html#clone_on_copy)、[Clippy Lints · ptr_arg](https://rust-lang.github.io/rust-clippy/master/index.html#ptr_arg)、[Clippy Lints · cognitive_complexity](https://rust-lang.github.io/rust-clippy/master/index.html#cognitive_complexity)

**相关页**：[tooling/clippy-lints](/tooling/clippy-lints)

### rust-analyzer

官方推荐的 LSP 语言服务器，提供补全、跳转与内联诊断。

**出处**：[rust-analyzer](https://rust-analyzer.github.io/)

**相关页**：[tooling/rust-analyzer-editor](/tooling/rust-analyzer-editor)

### 测试与文档（Cargo Test and Doc Test）

`cargo test` 跑单测与文档测试，`cargo doc` 生成文档并验证示例代码。

**出处**：[《Cargo Book》· cargo test](https://doc.rust-lang.org/cargo/commands/cargo-test.html)、[《Cargo Book》· cargo doc](https://doc.rust-lang.org/cargo/commands/cargo-doc.html)

**相关页**：[tooling/cargo-workflow](/tooling/cargo-workflow)

### workspace

共享同一 `Cargo.lock` 与 target 目录的多个包，统一依赖与构建。

**出处**：[《The Rust Programming Language》· Cargo Workspaces](https://doc.rust-lang.org/book/ch14-03-cargo-workspaces.html)、[《Cargo Book》· Workspaces](https://doc.rust-lang.org/cargo/reference/workspaces.html)

**相关页**：[ecosystem/workspace](/ecosystem/workspace)

### crates.io 发布（Publishing to crates.io）

`cargo publish` 打包上传；发布前需填写包元数据并通过文档与测试检查。

**出处**：[《The Rust Programming Language》· Publishing a Crate to Crates.io](https://doc.rust-lang.org/book/ch14-02-publishing-to-crates-io.html)、[《Cargo Book》· Publishing on crates.io](https://doc.rust-lang.org/cargo/reference/publishing.html)、[《Cargo Book》· cargo publish](https://doc.rust-lang.org/cargo/commands/cargo-publish.html)、[docs.rs](https://docs.rs/)

**相关页**：[ecosystem/publish-crate](/ecosystem/publish-crate)

### 交叉编译（Cross Compilation）

通过 target  triples 为其他架构编译；标准库 target 由 rustup 组件安装。

**出处**：[rustc book · Platform Support](https://doc.rust-lang.org/rustc/platform-support.html)、[《The Rust Programming Language》· 附录 G · How Rust is Made and “Nightly Rust”](https://doc.rust-lang.org/book/appendix-07-nightly-rust.html)

**相关页**：[memory-concurrency/cross-compilation](/memory-concurrency/cross-compilation)、[tooling/cross-compilation-practice](/tooling/cross-compilation-practice)

### edition

语言版本的兼容层：一套代码按 edition 切换语义，便于演进而不破坏存量代码。

**出处**：[《The Rust Edition Guide》· Introduction](https://doc.rust-lang.org/edition-guide/)、[《The Rust Programming Language》· 附录 E · Editions](https://doc.rust-lang.org/book/appendix-05-editions.html)

**相关页**：[tooling/rustup-msrv](/tooling/rustup-msrv)、[type-system/closures-and-fn-trait-family](/type-system/closures-and-fn-trait-family)

## 生态与跨语言

### no_std

不使用标准库的可选环境，替代项由 `core`/`alloc` 与自行提供的 `#[global_allocator]` 承担。

**出处**：[Embedded Book · Introduction](https://docs.rust-embedded.org/book/intro/index.html)、[std · GlobalAlloc in std::alloc](https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html)

**相关页**：[ecosystem/embedded-nostd](/ecosystem/embedded-nostd)、[memory-concurrency/custom-allocator](/memory-concurrency/custom-allocator)

### FFI 与 C 互操作（FFI and C Interop）

`extern "C"` 声明 ABI，`unsafe` 转换所有权；Nomicon 给出实践规约。

**出处**：[《The Rustonomicon》· FFI](https://doc.rust-lang.org/nomicon/ffi.html)、[《The Rust Programming Language》· Unsafe Rust](https://doc.rust-lang.org/book/ch20-01-unsafe-rust.html)

**相关页**：[ecosystem/ffi-c-interop](/ecosystem/ffi-c-interop)

### WebAssembly

以无 GC、小体积为目标的编译目标；wasm-bindgen 负责与 JS 互操作。

**出处**：[《Rust and WebAssembly》· Introduction](https://rustwasm.github.io/docs/book/)、[wasm-pack Book](https://rustwasm.github.io/docs/wasm-pack/)

**相关页**：[ecosystem/wasm](/ecosystem/wasm)

### 全局分配器（Global Allocator）

程序堆分配的入口；实现 `GlobalAlloc` 并标注 `#[global_allocator]` 即可整体替换。

**出处**：[std · GlobalAlloc in std::alloc](https://doc.rust-lang.org/std/alloc/trait.GlobalAlloc.html)

**相关页**：[memory-concurrency/custom-allocator](/memory-concurrency/custom-allocator)

### 移动语义与析构对照（Move Semantics versus Others）

Rust 编译期确定析构点，C++ 需 RAII 约定，Go 依赖 GC——三者的资源回收模型直接决定程序形态。

**出处**：[《The Rust Programming Language》· What is Ownership?](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html)、[Go 官方文档 · Effective Go](https://go.dev/doc/effective_go)

**相关页**：[comparison/vs-ccpp](/comparison/vs-ccpp)、[comparison/vs-go](/comparison/vs-go)

### 文档系统（Documentation）

`///` 文档注释写入 rustdoc，Markdown 与 doctest 双用；Rust By Example 提供可运行示例。

**出处**：[Rust By Example · Introduction](https://doc.rust-lang.org/rust-by-example/)、[《Cargo Book》· cargo doc](https://doc.rust-lang.org/cargo/commands/cargo-doc.html)

**相关页**：[tooling/cargo-workflow](/tooling/cargo-workflow)
