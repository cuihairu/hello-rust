# Hello Rust 知识点目录（OUTLINE）

> 本站点的知识地图与页面规划。写作会话按本表逐页产出，每完成一页把状态改为 `[x]`。
> 参考姊妹仓 hello-postgresql / hello-golang 的结构与写作口径（中文正文、每页一到两个核心知识点、代码示例 `rustc`/`cargo` 真跑）。

---

## 第 1 部分：语言核心 language-core（8 页，P1）

- [x] 所有权与移动语义（三规则、String 与栈/堆、move 之后不能用）
- [x] 借用与引用（共享引用与可变引用、借用规则、NLL 非词法作用域生命周期）
- [x] 切片与 &str（&[T]、字符串切片、deref coercion String→&str）
- [x] 生命周期（为什么需要、'a 标注、省略规则、'static）
- [x] 枚举与模式匹配（enum 携带数据、Option、match 穷尽性、if let）
- [x] trait 与实现（trait 定义、默认方法、trait bound 入门、常用标准库 trait）
- [x] 泛型与单态化（泛型函数/结构体、单态化、与 trait bound 配合）
- [x] 错误处理（Option 与 Result、? 运算符、panic 的使用边界、Box<dyn Error>）

## 第 2 部分：类型系统与抽象 type-system（P2）

- [ ] trait 对象与动态分发（dyn Trait、对象安全、vtable、与泛型静态分发对比）
- [ ] 泛型约束与 where 子句（多重 bound、条件实现）
- [ ] associated types（type 关联类型、与泛型参数的取舍）
- [ ] 零成本抽象（迭代器链、内联、benchmark 思路）
- [ ] 孤儿规则与 newtype（coherence、newtype 绕过孤儿规则）
- [ ] impl Trait（参数位置与返回位置、APIT/RPIT、返回闭包）
- [ ] 运算符重载（std::ops、Add 等常用 trait）
- [ ] 闭包与 Fn 家族（Fn/FnMut/FnOnce、捕获方式、move 闭包）

## 第 3 部分：内存与并发 memory-concurrency（P2）

- [ ] Drop 与析构（Drop trait、drop 顺序、std::mem::drop、Drop 检查器 dropck 入门）
- [ ] 智能指针（Box/Rc/Arc、Deref 与 Drop、循环引用与 Weak）
- [ ] 内部可变性（Cell/RefCell、借用规则运行时化）
- [ ] 自定义分配器（GlobalAlloc、global_allocator、 jemalloc/mimalloc 切换）
- [ ] Send 与 Sync（自动 trait、unsafe impl、Arc<Mutex<T>> 模式）
- [ ] 无畏并发（std::thread、channel、Mutex/RwLock、scoped threads）
- [ ] 交叉编译（target triple、--target、交叉工具链与 linker）

## 第 4 部分：异步 async（P2）

- [ ] async/await 与 Future（状态机、Future trait、poll 模型、惰性执行）
- [ ] 执行器与运行时（executor 原理、block_on、任务调度）
- [ ] Pin 与自引用结构（Unpin、pin!、为什么 async 块需要 Pin）
- [ ] tokio 生态（runtime、spawn、任务与阻塞治理 spawn_blocking）
- [ ] select 与超时取消（select!、CancellationToken、优雅关停）
- [ ] async 中的 Send 问题（跨 await 的锁、Send bound、async trait 现状）

## 第 5 部分：宏 macros（P3）

- [ ] 声明式宏 macro_rules（匹配器、重复、卫生性、调试宏展开）
- [ ] 过程宏（derive 宏、属性宏、函数式宏、proc-macro2/syn/quote）

## 第 6 部分：工具链 tooling（P3）

- [ ] cargo 常用工作流（new/build/test/run、Cargo.toml 与 Cargo.lock、特性开关）
- [ ] rustfmt 与代码风格（默认规则、rustfmt.toml、CI 里 --check）
- [ ] clippy 与 lint（常用 lint 族、deny 警告、自定义配置）
- [ ] rust-analyzer 与编辑器（IDE 功能、rustup component）
- [ ] rustup 与工具链管理（stable/nightly、component、MSRV 策略）
- [ ] 交叉编译实战（target add、cargo build --target、cross 工具）

## 第 7 部分：生态与工程 ecosystem（P3）

- [ ] workspace 与多 crate 工程（工作区依赖共享、统一版本）
- [ ] 发布 crate 到 crates.io（元数据、semver、cargo publish、yank）
- [ ] FFI 与 C 互操作（extern、#[no_mangle]、bindgen、repr(C)、内存所有权边界）
- [ ] 嵌入式 Rust（no_std、 embassy/rtic、HAL）
- [ ] WebAssembly（wasm32-unknown-unknown、wasm-pack、与 JS 交互）

## 第 8 部分：与其他语言对照 comparison（P3）

- [ ] Rust vs C/C++（内存安全、RAII 对比、模板 vs 泛型、构建系统）
- [ ] Rust vs Go（并发模型、错误处理、编译产物、生态位）
- [ ] Rust vs Java（内存模型、GC 与所有权、泛型擦除 vs 单态化）
- [ ] 速查总表（所有权/错误处理/并发/工具链逐项对照）
