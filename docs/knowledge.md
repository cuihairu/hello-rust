# 知识点整理

本页把全站内容收拢成一条复习主线：核心概念、权威书籍、官方文档、应用场景、常见坑。站内链接指向展开正文，条目只留结论，推导与示例在正文里。

## 一、语言核心

1. **所有权：每个值有唯一 owner**：值被 move 后原变量不可再用；owner 离开作用域值被 drop。栈上 Copy 类型（整数、bool 等）赋值即复制，不走 move。[所有权与移动语义](./language-core/ownership-and-move)
2. **借用：不转移所有权的使用**：同一时刻要么多个共享引用 `&T`，要么一个可变引用 `&mut T`，二者不可并存；编译器用借用检查在编译期排除数据竞争。[借用与引用](./language-core/borrowing-and-references)
3. **切片：对连续序列的视图**：`&[T]` 与 `&str` 是「指针 + 长度」的胖指针；`String` 到 `&str` 的自动转换是 deref coercion。[切片与 &str](./language-core/slices-and-str)
4. **生命周期：引用的有效期标注**：`'a` 标注描述引用之间的约束关系而非延长生命周期；函数签名满足省略规则时可省略；`'static` 表示整个程序有效期。[生命周期](./language-core/lifetimes)
5. **枚举与模式匹配：代数数据类型**：enum 变体可携带数据，`match` 强制穷尽所有分支；`Option<T>` 用类型系统消灭空指针。[枚举与模式匹配](./language-core/enums-and-pattern-matching)
6. **trait：共享行为的抽象**：trait 定义方法签名，可带默认实现；`impl Trait for Type` 实现行为，trait bound 约束泛型。[trait 与实现](./language-core/traits)
7. **泛型与单态化：编译期多态**：泛型函数/结构体在编译期为每个具体类型生成单态化代码，无运行时开销；与 trait bound 配合表达「对可比较类型排序」这类约束。[泛型与单态化](./language-core/generics-and-monomorphization)
8. **错误处理：可恢复错误走 Result**：`Option<T>` 表达有无，`Result<T, E>` 表达成败；`?` 在函数内向上传播错误；`panic!` 只用于不可恢复错误。[错误处理](./language-core/error-handling)

## 二、类型系统与抽象

9. **trait 对象与动态分发**：`dyn Trait` 是「胖指针」——数据指针 + vtable，运行时按指针调用；代价是 vtable 间接寻址与代码体积更小。与泛型静态分发是「体积换性能」的取舍。[trait 对象与动态分发](./type-system/trait-objects)
10. **约束的位置决定可读性**：多重 bound 用 `T: A + B` 简写，参数多时用 `where` 子句分行展开；`impl` 块本身可以带约束，实现只对满足条件的类型生效。[泛型约束与 where 子句](./type-system/generic-constraints-and-where)
11. **associated types 固定单一类型**：`Iterator` 的 `Item` 是关联类型而非泛型参数，同一个实现只有一个 `Item`；`Item = Self` 让迭代器返回自身。[associated types](./type-system/associated-types)
12. **零成本抽象的证据**：迭代器链编译为单态化 + 内联后的专用代码，用 `nm` 观察符号即可看到每个具体类型一份。[零成本抽象](./type-system/zero-cost-abstraction)
13. **孤儿规则守住一致性**：不能为「外部 trait + 外部类型」写 impl（E0117）；newtype 包装是绕过的正规手段。[孤儿规则与 newtype](./type-system/orphan-rule-and-newtype)
14. **`impl Trait` 是语法糖，位置决定含义**：参数位置等价于泛型参数（静态分发）；返回位置对外隐藏具体类型，捕获环境也一并隐藏——返回闭包必须靠它表达。[impl Trait](./type-system/impl-trait)
15. **运算符都是 trait**：`std::ops` 的 `Add`/`Sub`/`Mul`/`Index` 等决定 `+`、`[]` 的行为；`Deref` 是自动解引用的机制层。[运算符重载](./type-system/operator-overloading)
16. **Fn 家族按捕获方式区分**：`Fn` 只读捕获，`FnMut` 可变捕获，`FnOnce` 可能移动捕获且只能调用一次；`move` 闭包强制按值捕获。[闭包与 Fn 家族](./type-system/closures-and-fn-trait-family)

## 三、内存与并发

17. **drop 是确定性的**：变量按声明逆序析构，嵌套作用域先析构内层；`std::mem::drop` 提前释放，`ManuallyDrop` 延迟到需要时。[Drop 与析构](./memory-concurrency/drop-and-destructors)
18. **智能指针换所有权**：`Box` 堆上唯一所有权，`Rc`/`Arc` 共享计数，`Weak` 不计入强引用用于破环；`Rc` 循环引用会让计数永不归零。[智能指针](./memory-concurrency/smart-pointers)
19. **内部可变性把借用规则推迟到运行时**：`Cell`/`RefCell` 允许通过 `&self` 修改状态，借用后返回时若已有借用就 panic——规则没消失，只是换了执法时点。[内部可变性](./memory-concurrency/interior-mutability)
20. **Send 与 Sync 是自动 trait**：编译器按字段组成推导，裸指针让类型 `!Send`；`Arc<Mutex<T>>` 是跨线程共享的可变状态标配。[Send 与 Sync](./memory-concurrency/send-and-sync)
21. **无畏并发**：`std::thread` + `mpsc` channel + `Mutex`/`RwLock`，所有权使数据归属明确，编译器阻止写写竞争。[无畏并发](./memory-concurrency/threads-and-channels)

## 四、异步

22. **Future 是惰性的状态机**：`poll` 返回 `Ready` 或 `Pending`，不 `block_on` 就什么都不会发生；async 块被编译成状态机，`await` 是一次状态转移。[async/await 与 Future](./async/async-await-and-future)
23. **执行器就是循环 poll 的那段代码**：`block_on` 的本质是反复 poll 直到 Ready；手写 executor 能看清运行时在做什么。[执行器与运行时](./async/executors-and-runtime)
24. **Pin 保证自引用状态机的内存不被移动**：`Unpin` 类型无需 pin；async 块与 `Future` 的 `self: Pin<&mut Self>` 由此而来。[Pin 与自引用](./async/pin-and-self-reference)
25. **select 命中即丢弃其余分支**：被丢弃的分支不会继续推进，这是协作式取消的实现基础；`timeout` 与 `CancellationToken` 是同一套模式的特化。[select 与超时取消](./async/select-and-cancellation)

## 五、宏与元编程

26. **声明式宏是编译期的模式匹配**：`macro_rules!` 用 fragment 类型（`expr`/`ident`/`pat` 等）与 `$(...)*` 重复匹配 token 流；展开时机在使用点之前。[声明式宏 macro_rules](./macros/declarative-macros)
27. **过程宏跑在独立的编译期进程里**：`#[proc_macro_derive]`/`#[proc_macro_attribute]`/`#[proc_macro]` 三种形态都以 `TokenStream` 进出，用 `syn`/`quote` 解析生成；代价是额外编译开销与受限的错误诊断。[过程宏](./macros/proc-macros)

## 六、工具链

28. **cargo 是构建与依赖的统一入口**：`build/run/test/check` 四个动作 + `Cargo.toml` 元数据 + 可提交的 `Cargo.lock`；特性开关按需启用可选依赖。[cargo 常用工作流](./tooling/cargo-workflow)
29. **rustfmt 与 clippy 分工**：rustfmt 只做格式化（无争议规则），clippy 给出风格与正确性提示（可分级 allow/warn/deny）；CI 用 `--check` 与 `#![deny]` 固化。[rustfmt 与代码风格](./tooling/rustfmt-style)、[clippy 与 lint](./tooling/clippy-lints)
30. **MSRV 是 `rust-version` 字段的事**：工具链选择（stable/nightly）与 edition 迁移要分开管，依赖版本漂移由锁文件与锁版本策略控制。[rustup 与 MSRV](./tooling/rustup-msrv)

## 七、生态与工程

31. **workspace 是多 crate 的工程单元**：共享依赖声明与统一版本，路径依赖在仓库内互通；继承依赖 `version = "workspace"` 要求较新的 cargo。[workspace 与多 crate 工程](./ecosystem/workspace)
32. **发布前先 `cargo publish --dry-run`**：它会完整走一遍打包与元数据校验却不真正发包；semver 里 `0.x` 与 `1.x` 的破坏性变更语义不同。[发布 crate 到 crates.io](./ecosystem/publish-crate)
33. **FFI 的边界是所有权**：`extern "C"` 只规定 ABI，内存归属要靠约定；`Box::into_raw` 与 `from_raw` 必须成对出现，否则泄漏或重复释放。[FFI 与 C 互操作](./ecosystem/ffi-c-interop)
34. **no_std 是嵌入式与 wasm 的共同底座**：去掉 std 后只剩 `core`（与可选 `alloc`）；嵌入式要自己提供入口与分配器，wasm 目标是无 OS 的沙箱。[嵌入式 Rust](./ecosystem/embedded-nostd)、[WebAssembly](./ecosystem/wasm)

## 八、与其他语言对照

35. **与 C/C++**：Rust 用所有权与借用把「数据竞争」和「未定义行为」挡在编译期，RAII 语义强制化；代价是编译期约束的迁移成本。[Rust vs C/C++](./comparison/vs-ccpp)
36. **与 Go**：Rust 用 async/await + 编译器检查换来无 GC 的内存与编译期并发安全；Go 用 goroutine 与 GC 换来开发效率与运行时弹性。[Rust vs Go](./comparison/vs-go)
37. **与 Java**：泛型在 Java 里是类型擦除（`List<Integer>` 与 `List<Double>` 同类型），在 Rust 里是单态化（不同类型）；空指针被 `Option` 替换。[Rust vs Java](./comparison/vs-java)
38. **逐项速查**：所有权、错误处理、并发、内存管理、多态、元编程、构建系统、类型系统特性的横向对照表。[速查总表](./comparison/cheatsheet-table)

## 九、权威书籍要点

1. **《The Rust Programming Language》（Steve Klabnik & Carol Nichols，俗称 "the book"）**：官方免费在线书，语言核心部分（第 1 部分）与它对齐：<https://doc.rust-lang.org/book/>。
2. **《Programming Rust》（Jim Blandy 等，O'Reilly）**：面向有系统编程经验读者的深入讲解，内存与并发部分参考。
3. **《Rust for Rustaceans》（Jon Gjengset）**：所有权、生命周期、trait 对象的进阶视角，类型系统部分参考。
4. **《The Rustonomicon》**：unsafe Rust 与内存模型权威参考，内存与并发部分引用：<https://doc.rust-lang.org/nomicon/>。
5. **《Tokio: Asynchronous Programming in Rust》（Carl Lerche）**：异步执行器与运行时部分参考：<https://tokio.rs/tokio/tutorial/introduction>。

## 十、官方文档要点

1. **The Rust Book**：语言核心与类型系统部分的权威出处：<https://doc.rust-lang.org/book/>。
2. **The Rust Reference**：语法与语义的规范级参考（含宏章节、ABI、生命周期章节）：<https://doc.rust-lang.org/reference/>。
3. **std 文档**：标准库 API 与 trait 语义以它为准：<https://doc.rust-lang.org/std/>。
4. **The Cargo Book**：工具链与发布部分的权威出处：<https://doc.rust-lang.org/cargo/>。
5. **RFC 仓库**：语言与库特性设计的决策记录（如 RFC 3185 static async fn in trait、RFC 1238/1327 dropck）：<https://rust-lang.github.io/rfcs/>。
6. **The Rustonomicon**：unsafe、内存布局、并发原语的权威参考：<https://doc.rust-lang.org/nomicon/>。

## 十一、应用场景

1. **系统编程与基础设施**：操作系统、数据库、网络代理——所有权与零成本抽象的直接用武之地。
2. **Web 后端**：axum/actix-web + tokio 异步运行时，错误处理与并发模型见第 4 部分。
3. **命令行工具**：clap 解析参数、anyhow 处理错误，cargo 生态开箱即用。
4. **嵌入式与 wasm**：no_std 与 wasm32 target，见第 7 部分生态与工程。

## 十二、常见坑误区

1. **move 之后继续使用原变量**：编译错误 `use of moved value` 是所有权在起作用，不是 bug。[所有权与移动语义](./language-core/ownership-and-move)
2. **以为可变引用可以随便同时存在**：`&mut T` 独占是数据竞争编译期防线的一部分。[借用与引用](./language-core/borrowing-and-references)
3. **生命周期标注能延长引用寿命**：`'a` 只描述约束，不改变任何值的实际存活时间。[生命周期](./language-core/lifetimes)
4. **把 panic 当错误处理**：panic 会展开栈、终止线程（默认），可恢复错误应走 `Result`。[错误处理](./language-core/error-handling)
5. **`Rc` 循环引用导致泄漏**：强引用互相持有，计数永不归零；破环用 `Weak`。[智能指针](./memory-concurrency/smart-pointers)
6. **选错分发方式**：类型数量不可控时用泛型会显著拖慢编译并膨胀产物，该用 `dyn Trait` 时用 `dyn Trait`。[trait 对象与动态分发](./type-system/trait-objects)
7. **select 分支被丢弃**：命中一个分支后其余分支被 drop，不要在其中假设一定执行。[select 与超时取消](./async/select-and-cancellation)
8. **FFI 里谁分配谁释放不匹配**：Rust 分配的内存必须由 Rust 释放，`into_raw`/`from_raw` 不成对就是泄漏或 double free。[FFI 与 C 互操作](./ecosystem/ffi-c-interop)
