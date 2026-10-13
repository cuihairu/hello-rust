# 知识点整理

本页把全站内容收拢成一条复习主线：核心概念、权威书籍、官方文档、应用场景、常见坑。站内链接指向展开正文，条目只留结论，推导与示例在正文里。

## 一、核心概念（语言核心）

1. **所有权：每个值有唯一 owner**：值被 move 后原变量不可再用；owner 离开作用域值被 drop。栈上 Copy 类型（整数、bool 等）赋值即复制，不走 move。[所有权与移动语义](./language-core/ownership-and-move)
2. **借用：不转移所有权的使用**：同一时刻要么多个共享引用 `&T`，要么一个可变引用 `&mut T`，二者不可并存；编译器用借用检查在编译期排除数据竞争。[借用与引用](./language-core/borrowing-and-references)
3. **切片：对连续序列的视图**：`&[T]` 与 `&str` 是「指针 + 长度」的胖指针；`String` 到 `&str` 的自动转换是 deref coercion。[切片与 &str](./language-core/slices-and-str)
4. **生命周期：引用的有效期标注**：`'a` 标注描述引用之间的约束关系而非延长生命周期；函数签名满足省略规则时可省略；`'static` 表示整个程序有效期。[生命周期](./language-core/lifetimes)
5. **枚举与模式匹配：代数数据类型**：enum 变体可携带数据，`match` 强制穷尽所有分支；`Option<T>` 用类型系统消灭空指针。[枚举与模式匹配](./language-core/enums-and-pattern-matching)
6. **trait：共享行为的抽象**：trait 定义方法签名，可带默认实现；`impl Trait for Type` 实现行为，trait bound 约束泛型。[trait 与实现](./language-core/traits)
7. **泛型与单态化：编译期多态**：泛型函数/结构体在编译期为每个具体类型生成单态化代码，无运行时开销；与 trait bound 配合表达「对可比较类型排序」这类约束。[泛型与单态化](./language-core/generics-and-monomorphization)
8. **错误处理：可恢复错误走 Result**：`Option<T>` 表达有无，`Result<T, E>` 表达成败；`?` 在函数内向上传播错误；`panic!` 只用于不可恢复错误。[错误处理](./language-core/error-handling)

## 二、权威书籍要点

1. **《The Rust Programming Language》（Steve Klabnik & Carol Nichols，俗称 "the book"）**：官方免费在线书，语言核心部分（第 1 部分）与它对齐：<https://doc.rust-lang.org/book/>。
2. **《Programming Rust》（Jim Blandy 等，O'Reilly）**：面向有系统编程经验读者的深入讲解，内存与并发部分参考。
3. **《Rust for Rustaceans（Jon Gjengset）》**：所有权、生命周期、trait 对象的进阶视角，类型系统部分参考。
4. **《The Rustonomicon》**：unsafe Rust 与内存模型权威参考，内存与并发部分引用：<https://doc.rust-lang.org/nomicon/>。

## 三、官方文档要点

1. **The Rust Book**：语言核心部分全站引用的权威出处：<https://doc.rust-lang.org/book/>。
2. **The Rust Reference**：语法与语义的规范级参考：<https://doc.rust-lang.org/reference/>。
3. **std 文档**：标准库 API 与 trait 语义以它为准：<https://doc.rust-lang.org/std/>。
4. **RFC 仓库**：语言与库特性设计的决策记录：<https://rust-lang.github.io/rfcs/>。
5. **The Rustonomicon**：unsafe、内存布局、并发原语的权威参考：<https://doc.rust-lang.org/nomicon/>。

## 四、应用场景

1. **系统编程与基础设施**：操作系统、数据库、网络代理——所有权与零成本抽象的直接用武之地。
2. **Web 后端**：axum/actix-web + tokio 异步运行时，错误处理与并发模型见第 4 部分。
3. **命令行工具**：clap 解析参数、anyhow 处理错误，cargo 生态开箱即用。
4. **嵌入式与 wasm**：no_std 与 wasm32 target，见第 7 部分生态与工程。

## 五、常见坑误区

1. **move 之后继续使用原变量**：编译错误 `use of moved value` 是所有权在起作用，不是 bug。[所有权与移动语义](./language-core/ownership-and-move)
2. **以为可变引用可以随便同时存在**：`&mut T` 独占是数据竞争编译期防线的一部分。[借用与引用](./language-core/borrowing-and-references)
3. **生命周期标注能延长引用寿命**：`'a` 只描述约束，不改变任何值的实际存活时间。[生命周期](./language-core/lifetimes)
4. **把 panic 当错误处理**：panic 会展开栈、终止线程（默认），可恢复错误应走 `Result`。[错误处理](./language-core/error-handling)
