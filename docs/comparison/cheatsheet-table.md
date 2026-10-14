# 四语言速查总表

这一页把本板块三篇对照页的结论，按维度汇总成表。**每一格都标注依据类型**：`实测`（本页作者用 rustc 1.99.0 / gcc & g++ 15.2.0 / go 1.27.1 / javac 21.0.12 在本机跑过并贴了输出）、`官方文档`（查证过官方页面）、`定性`（工程共识，无官方出处，请自行验证）。查不到出处的结论一律标「未找到出处」。

> 实测环境：Linux x86-64，rustc 1.99.0、gcc/g++ 15.2.0、go 1.27.1、javac 21.0.12。跨环境数字会变，**结论看量级与语义，不要背数字**。

## 所有权与生命周期

| 语言 | 机制 | 关键证据 | 依据 |
| --- | --- | --- | --- |
| Rust | 所有权三规则 + 借用检查，引用有效性编译期验证 | `error[E0505]: cannot move out of v because it is borrowed`（释放后使用直接编译失败） | 实测 + 官方文档（Reference「Behavior considered undefined」） |
| C/C++ | 手动管理（`malloc`/`free`、`new`/`delete`）；RAII 可选（智能指针）；悬垂指针编译期不拦 | 返回局部数组首址：编译 exit 0（一条 warning），运行 Segmentation fault | 实测 + C++ 标准草案（UB 列表） |
| Go | GC 全托管，无所有权概念 | GC 由 `GOGC`/`GOMEMLIMIT` 调节堆增长目标 | 官方文档（go.dev/doc/gc-guide） |
| Java | GC 全托管（HotSpot，server-class 机器默认 G1） | 官方明确「自动管理动态内存分配请求」「消除一类内存管理错误」 | 官方文档（Oracle GC 调优指南） |

## 内存释放时机与开销

| 语言 | 释放时机 | 确定性 | 依据 |
| --- | --- | --- | --- |
| Rust | 作用域结束，按声明**逆序** drop | 完全确定 | 实测：`main 主体结束 → drop b → drop a`；官方文档（Book 4 章） |
| C/C++ | `free`/`delete` 显式调用；RAII/智能指针离开作用域释放 | 显式调用即确定；裸 new/delete 易漏 | 实测（dangling 例子段错误）；RAII 语义依据 C++ 标准（本次未逐字查证 cppreference 对应条目） |
| Go | GC 决定，并发标记-清除 | 不可预测（可调频率） | 官方文档（go.dev/doc/gc-guide：「does most of its work concurrently」） |
| Java | GC 决定，分代 + 压缩整理 | 不可预测 | 官方文档（Oracle GC 调优指南：generational scavenging） |

## 错误处理

| 语言 | 惯用方式 | 能否被忽略 | 依据 |
| --- | --- | --- | --- |
| Rust | `Result<T, E>` + `?` 传播 | 不能静默忽略：忘记处理报 `warning: unused Result that must be used`（`#[must_use]`） | 实测（`Ok(42)` / `Err(ParseIntError { kind: InvalidDigit })`；must_use 警告实测） + 官方文档（Book 9 章） |
| C/C++（C++17） | 返回码 / 异常 | 返回码可丢弃无提示；异常不捕获则终止 | C 侧依据社区常识（未找到单一官方出处）；C++ 异常语义见 cppreference（本次未逐字查证） |
| C/C++（C++23） | `std::expected<T, E>`（与 `Result` 同构） | 同 `Result`，是值不是异常 | 实测：g++ 15.2.0 `-std=c++23` 编译运行通过（`7/2 = 3` / `err: division by zero`） |
| Go | 多返回值 `(T, error)` + `if err != nil` | 可以：返回值丢弃编译器不报错 | 实测（`7/2 = 3` / `err: division by zero`）；模式见 Effective Go（本次未逐字查证错误处理章节） |
| Java | 异常（checked/unchecked） | 不捕获则线程/进程终止 | 社区常识 + Oracle 教程（本次未逐字查证异常章节） |

## 并发

| 语言 | 模型 | 无同步共享可变数据的后果 | 依据 |
| --- | --- | --- | --- |
| Rust | 所有权 + `Send`/`Sync` trait；`Arc<Mutex<T>>` / channel / tokio | **编译失败**：`E0499 cannot borrow v as mutable more than once`、`E0277 Rc<String> cannot be sent between threads safely` | 实测 + 官方文档（Reference 将 data race 列为 UB） |
| C/C++ | 线程 + 锁/原子，全靠程序员 | **未定义行为**：标准草案明确「Any such data race results in undefined behavior」 | 官方文档（eel.is C++ draft [intro.races]）。**诚实标注**：本机 gcc -O2 短循环 5 次运行均得 200000，未复现错误——UB 是否显形取决于平台与优化级别 |
| Go | goroutine + channel，语言内建调度 | 运行时竞态检测器（`-race`）才能发现，语言层面不拦 | 官方文档（Effective Go：goroutine「multiplexed onto multiple OS threads」）；`-race` 未实测 |
| Java | 线程 + JMM（§17.4）+ synchronized/volatile/Atomic* | 语义定义良好但**结果不可预测**：实测两线程各 `counter++` 10 万次，5 次运行 4 次丢更新（196839 / 195987 / 121896 / 200000 / 192473） | 实测 + 官方文档（Oracle 并发教程：happens-before 关系） |

### 并发规模实测（同机对比）

| 实验 | 耗时（wall） | 依据 |
| --- | --- | --- |
| Go 100 万 goroutine（WaitGroup 汇合） | 2.87s | 实测 |
| Rust 100 万 tokio task（Barrier 汇合） | 4.74s | 实测 |
| Rust 1 万 `std::thread`（AtomicUsize 汇合） | 5.07s | 实测（OS 线程直接映射，规模受限） |

## 多态与动态分发

| 语言 | 机制 | 运行时形态 | 依据 |
| --- | --- | --- | --- |
| Rust | 泛型（默认单态化）或 `dyn Trait`（显式动态分发） | `&dyn Shape` 占 16 字节（数据指针 + vtable），`&Circle` 8 字节；`Vec<Shape>` 直接编译失败（E0277，trait 是不定长类型） | 实测 + 官方文档（Book 17/18 章 trait 对象，未逐字查证） |
| C/C++ | 模板（实例化时检查）+ 虚函数 | 单态化零开销；虚调用经 vtable 间接跳转 | 实测（模板缺 `operator+` 报错在实例化点）；虚函数语义依据社区常识（未逐字查证 cppreference） |
| Go | 接口（隐式实现）+ 泛型（1.18，约束即接口类型集合） | 接口值 = (类型, 数据) 二元组；泛型经字典传递 | 官方文档（go.dev/blog/intro-generics：「type constraints must be interfaces」）+ 实测（`sum([]int{1,2,3})` 输出 6） |
| Java | 类继承 + 接口；**非 private 非 final 方法默认虚调用**；泛型类型擦除 | `List<Integer>` 与 `List<Double>` 运行时同一 `ArrayList` 类（实测 `same class? true`） | 实测 + 官方文档（Oracle 泛型擦除教程） |

## 宏与元编程

| 语言 | 机制 | 备注 | 依据 |
| --- | --- | --- | --- |
| Rust | 声明宏 `macro_rules!` + 过程宏（derive / attribute / function-like） | `vec![]`、`#[derive(Debug)]` 即宏产物 | 官方文档（Book 宏章节；本页未逐字查证 URL，机制为公开文档内容） |
| C/C++ | 预处理器宏 `#define` + 模板元编程 + `constexpr`/`consteval` | 三套机制并存，能力重叠 | 定性（社区共识；cppreference 对应条目本次未逐字查证） |
| Go | **无宏系统**；代码生成走 `go generate` + 外部工具 | 官方 FAQ 有「为什么没有宏」的讨论，本次未逐字查证 | 定性（社区共识） |
| Java | 注解处理器（APT）+ 反射 + 字节码增强（如 Lombok） | 编译期生成代码而非语言级宏 | 定性（社区共识） |

## 构建与依赖管理

| 语言 | 官方/事实标准工具 | 依赖来源 | 依据 |
| --- | --- | --- | --- |
| Rust | cargo（官方，构建+测试+发布一体） | crates.io + `Cargo.lock` 锁定 | 官方文档（doc.rust-lang.org/cargo） |
| C/C++ | CMake/Make（构建生成器，非官方语言配套） | 无统一标准：系统包 / vcpkg / Conan / FetchContent | 定性（cmake.org 官方站点定位；依赖生态多样性为社区共识） |
| Go | `go build` / `go mod`（语言自带） | Go module proxy（`go.dev/ref/mod`） | 官方文档（go.dev/ref/mod） |
| Java | Maven / Gradle（事实标准，**非语言自带**） | Maven Central | 定性（社区共识） |

## 类型系统特性

| 语言 | 特性组合 | 关键证据 | 依据 |
| --- | --- | --- | --- |
| Rust | 代数类型（`enum`）+ 模式匹配**穷尽性检查** + trait bound（定义处检查） | `match` 漏分支：`error[E0004]: non-exhaustive patterns: Shape::Square not covered`；泛型缺 bound：`error[E0369]` 报在定义处 | 实测 + 官方文档（Reference） |
| C/C++ | 模板 + 重载 + `constexpr`；enum + switch 无穷尽硬检查 | 模板错误报在实例化点（实测）；`-Wswitch` 仅 warning（未实测） | 实测（模板部分）；switch 部分未实测 |
| Go | 结构化接口（隐式实现）+ 泛型类型集合（1.18） | `~int \| ~float64` 约束实测编译运行通过 | 官方文档（go.dev/blog/intro-generics）+ 实测 |
| Java | 名义类型 + 单根继承（`Object`）+ 泛型擦除；无枚举 match（switch on enum 为语句非表达式穷尽检查） | `List<Integer>` 与 `List<Double>` 运行时同类（实测） | 实测 + 官方文档（Oracle 擦除教程）；switch 穷尽性细节本次未查证（Java 21 起模式匹配 switch 已标准化，未逐字查证） |

## 空值语义

| 语言 | 「可能没有」的表示 | 忘记处理的后果 | 依据 |
| --- | --- | --- | --- |
| Rust | `Option<T>`，类型层面编码 | 不 unwrap 就**编译不过**（对 `Option<i32>` 做 `+1` 报 `error[E0369]`）；显式 `unwrap()` 才 panic | 实测（`called Option::unwrap() on a None value`，exit 101） |
| C/C++ | 指针可空，解引用前靠检查 | 空指针解引用 = UB | C++ 标准草案 UB 列表（本次未逐字查证空解引用条目）；社区共识 |
| Go | 指针/接口可 nil；惯用 `, ok` 双返回值 | nil 解引用 panic（运行时） | 定性（社区共识；runtime panic 行为本页未实测） |
| Java | 引用类型皆可为 `null` | NPE 运行时抛出：`Cannot invoke "Integer.toString()" because "<local2>" is null` | 实测 + JDK 14+ Helpful NPE（报错信息含变量名，实测可见） |

## 启动成本与产物形态（同机实测）

| 语言 | hello world 启动 | 产物 | 依据 |
| --- | --- | --- | --- |
| Rust | ~0.00s | 原生 ELF；`rustc -O` 含 debug info 4.5MB，strip 后 337KB；动态链接 libc/libgcc_s | 实测（`file`/`ldd`） |
| Go | 0.00–0.01s | 原生 ELF 2.3MB，**默认静态链接**（`ldd` 报 not a dynamic executable） | 实测（`file`/`ldd`） |
| C | ~0.00s | 原生 ELF 16KB，动态链接 libc | 实测 |
| Java | 0.18–0.19s | `.class` 字节码，需 JVM（启动 + JIT 预热成本） | 实测 + Oracle JVM 文档（GC 自动管理部分） |

## 生态定位（定性判断，无官方出处）

| 语言 | 典型生态位 | 说明 |
| --- | --- | --- |
| Rust | 系统编程、嵌入式、数据库/引擎核心、对安全敏感的 CLI | 定性（社区共识） |
| C/C++ | 操作系统、驱动、游戏引擎、既有基础设施维护 | 定性（社区共识） |
| Go | 云原生服务、网络服务、DevOps/CLI 工具 | 定性（社区共识） |
| Java | 企业级后端、大数据生态、Android（历史） | 定性（社区共识） |

## 学习曲线（定性判断，无官方出处）

| 语言 | 前期门槛 | 说明 |
| --- | --- | --- |
| Rust | 高：所有权、借用、生命周期是全新概念 | 定性；「学习曲线陡峭」是社区高频反馈，非官方结论 |
| C/C++ | 中到高：语法常见但 UB/内存错误隐蔽，精通需多年 | 定性 |
| Go | 低：语法集极小，并发原语开箱即用 | 定性 |
| Java | 低到中：概念常规，生态庞大 | 定性 |

## 使用建议

- **查某格结论时先看「依据」列**：`实测` 可复现（本板块三篇对照页附了命令），`官方文档` 可点击核对，`定性`/`未找到出处` 需要自己再验证。
- **不要跨语言背绝对数字**：二进制体积、编译时间、并发规模都强依赖机器与环境，语义结论（编译期拦截 vs 运行时 UB）才是可迁移的知识。
- **UB 类结论的读法**：「C/C++ 数据竞争是 UB」是标准层面的判定，不代表每次运行都出错——本页 c3 实测就是 5 次全对的反例。标准判定 + 实测现象要分开陈述。

## 参考资料

- 官方文档：《The Rust Reference》· Behavior considered undefined：<https://doc.rust-lang.org/reference/behavior-considered-undefined.html>

## 相关页面

- [Rust vs C/C++](./vs-ccpp)——内存安全、泛型、构建系统的逐项实测。
- [Rust vs Go](./vs-go)——并发模型与错误处理对照。
- [Rust vs Java](./vs-java)——GC、泛型擦除与对象模型。
- [板块首页](./)——本板块导览。
- [知识点整理](../knowledge)——全站复习主线。
- [语言核心](../language-core/)——所有权、借用、生命周期等基础概念。
