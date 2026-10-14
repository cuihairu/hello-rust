# Rust vs C/C++：内存安全、泛型与工程设施

用**同一段逻辑、两边各跑一遍**的实测，看 Rust 把多少 C/C++ 里只能靠规范和自觉的问题挪到了编译器。

| 场景 | Rust（rustc 1.99.0） | C/C++（gcc/g++ 15.2.0） |
| --- | --- | --- |
| 固定下标越界 `a[5]`（数组长 3） | **编译失败**：`error: this operation will panic at runtime` | **编译通过**（exit 0），运行打印垃圾值 `a[5] = -9065552` |
| 返回局部变量地址 | **编译失败**：`error[E0505] cannot move out of v because it is borrowed` | **编译通过**，运行时 **Segmentation fault**（exit 139） |
| 无锁共享变量并发写 | **编译失败**：`error[E0499]` | **编译通过**，标准判定为**未定义行为** |
| 泛型 `a + b` 缺约束 | **编译失败**，报在**定义处** | **编译失败**，报在**实例化处** |

## 内存安全

### 越界访问：编译期拦截 vs 运行时静默越界

Rust 侧，常量下标访问长度 3 的数组：

```rust
fn main() {
    let a = [1, 2, 3];
    println!("{}", a[5]);
}
```

真实运行输出（`rustc r1_oob_array.rs`，失败）：

```text
error: this operation will panic at runtime
 --> r1_oob_array.rs:3:20
  |
3 |     println!("{}", a[5]);
  |                    ^^^^ index out of bounds: the length is 3 but the index is 5
  |
  = note: `#[deny(unconditional_panic)]` on by default
```

常量越界直接拒绝编译。下标是运行期变量时退到运行时**边界检查**，仍不发生任何越界读（`rustc r2_oob_vec.rs` 后执行，exit 101）：

```text
thread 'main' (21070) panicked at r2_oob_vec.rs:4:21:
index out of bounds: the len is 3 but the index is 5
```

C 侧同一份逻辑（`int a[3] = {1,2,3}; printf("%d", a[5]);`），无 flags 编译 exit 0、**零警告**：

```text
$ gcc c1_oob.c -o c1 && ./c1
a[5] = -9065552
```

`gcc -Wall -O2` 下仍 exit 0，只多一条 `warning: array subscript 5 is above array bounds`，运行输出变为 `a[5] = 0`——同样是不报错、不可信的值。gcc 的这个 warning 默认开启，但**不改变退出码**，也不会让 `make` 停下来；大型工程里这类 warning 通常被淹没。《Rust 程序设计语言》9.1 节明确对比了 C 的行为：「在 C 中，尝试读取数据结构末尾之外的内容是未定义行为……如果攻击者能够操纵下标，这可能成为安全漏洞。」

### use-after-free：引用有效性是类型的一部分

Rust 里试图在释放后继续使用引用，编译期就被拦下：

```rust
fn main() {
    let v = vec![1, 2, 3];
    let first = &v[0];
    drop(v);
    println!("first = {first}");
}
```

真实运行输出（`rustc r3_use_after_free.rs`，失败，摘录）：

```text
error[E0505]: cannot move out of `v` because it is borrowed
 --> r3_use_after_free.rs:4:10
  |
2 |     let v = vec![1, 2, 3];
  |         - binding `v` declared here
3 |     let first = &v[0];
  |                  - borrow of `v` occurs here
4 |     drop(v);
  |          ^ move out of `v` occurs here
5 |     println!("first = {first}");
  |                        ----- borrow later used here
```

C 侧的等价写法（返回局部数组首地址）：编译只给一条 `warning: function returns address of local variable [-Wreturn-local-addr]`，运行 `Segmentation fault (core dumped)`（exit 139）。这类 bug 往往以崩溃、读到脏数据、或在特定布局下「看起来正常」的形式出现；Rust 在编译期就指出「borrow later used here」，把责任落在源码行上。

> **注意**：这份保证的边界是「safe Rust」。Rust Reference《Behavior considered undefined》明确：`unsafe` 只是把避免 UB 的责任转移给程序员，并不允许 UB 本身存在；Rust 程序不得出现该页列出的任何 UB 行为。

### 数据竞争：编译期禁止 vs 未定义行为

C++ 标准（draft [intro.races]）的定义：两个潜在的并发动作访问同一内存位置、至少一个是写、且两者之间不存在 happens-before 关系，即构成 data race；并明确「**Any such data race results in undefined behavior**」。

Rust 侧，两个线程无锁共享同一个 `Vec`：

```rust
let mut v = vec![1, 2, 3];
let h1 = thread::spawn(|| v.push(4));
let h2 = thread::spawn(|| v.push(5));
h1.join().unwrap();
h2.join().unwrap();
```

真实运行输出（`rustc r5_threads_share.rs`，失败，共 4 个错误）：

```text
error[E0373]: closure may outlive the current function, but it borrows `v`, which is owned by the current function
error[E0499]: cannot borrow `v` as mutable more than once at a time
error[E0373]: closure may outlive the current function, but it borrows `v`, which is owned by the current function
error[E0502]: cannot borrow `v` as immutable because it is also borrowed as mutable
```

`E0499` 的报错位置指向 `std::thread::spawn` 要求的 `F: Send + 'static` 约束——**借用检查器把「线程间共享可变数据」直接判为非法**。正确写法是 `Arc<Mutex<Vec<_>>>`，类型系统保证并发访问互斥。

C 侧同样的无锁计数（两线程各 `counter++` 10 万次），gcc -O2 编译干净通过，5 次运行都是 `counter = 200000 (expected 200000)`。

**诚实说明**：本机没复现丢失更新。这是数据竞争 UB 的典型表现——**是否出错取决于平台、调度与优化级别**，本机没炸不等于程序正确。标准层面的结论不变：这段代码是未定义行为。和 Rust 的 `E0499` 对比，差距一目了然：C/C++ 把正确性交给程序员和 code review，Rust 把它交给编译器。

## 泛型 vs 模板：错误报在定义处还是实例化处

这是 Rust 泛型与 C++ 模板**语义上最实质的差异**。Rust 侧，`add` 没有约束就写 `a + b`：

```rust
fn add<T>(a: T, b: T) -> T {
    a + b
}
```

真实运行输出（`rustc r4_generic_add.rs`，失败）：

```text
error[E0369]: cannot add `T` to `T`
 --> r4_generic_add.rs:2:7
  |
2 |     a + b
  |     - ^ - T
help: consider restricting type parameter `T` with trait `Add`
  |
1 | fn add<T: std::ops::Add<Output = T>>(a: T, b: T) -> T {
```

错误指向**定义处的第 2 行**，编译器给出了修复建议——Rust 在泛型**定义时**就用 trait bound 完成检查。

C++ 侧，同样的模板在没有 `operator+` 的 `Point` 类型上实例化，`g++ -std=c++17` 报错：

```text
cpp1_template_err.cpp: In instantiation of ‘T add(T, T) [with T = Point]’:
cpp1_template_err.cpp:15:21:   required from here
cpp1_template_err.cpp:5:14: error: no match for ‘operator+’ (operand types are ‘Point’ and ‘Point’)
```

错误指向**实例化点**（第 15 行的调用），并把模板定义「展开回溯」到内部。C++ 模板本质是实例化时的鸭子类型检查：模板本身不做充分检查，错误在「用错的地方」爆发——这也是模板错误信息常被称为「一英里长」的原因。

| 维度 | C++ 模板 | Rust 泛型 |
| --- | --- | --- |
| 检查时机 | 实例化时 | 定义时（trait bound） |
| 多态实现 | 实例化单态化；也可虚函数 | 默认单态化；`dyn Trait` 显式动态分发 |
| 编译期计算 | 模板元编程 / `constexpr` | `const fn` / const generics |
| 动态分发代价 | 虚函数 vtable 间接跳转 | `dyn Trait` 胖指针（实测 `&dyn Shape` 16 字节，`&Circle` 8 字节） |

## 构建与错误处理

| 维度 | Rust | C | C++ |
| --- | --- | --- | --- |
| 构建/依赖 | cargo（官方，`Cargo.toml` 声明、`Cargo.lock` 锁定、crates.io 拉取、`cargo test` 跑单测） | CMake/Make（构建生成器）；依赖无统一标准（系统包/vcpkg/FetchContent） | 同 C |
| 错误处理 | `Result<T, E>` + `?`；忘记处理报 `unused_must_use` 警告 | 返回码 + 全局 `errno`；返回值可丢弃无提示 | 异常；C++23 起有 `std::expected` |
| 错误形态 | 错误是值，`?` 零开销 | 错误是返回码，每层手动判断 | 异常有抛出/展开成本；`std::expected` 与 `Result` 同构 |

Rust 侧实测（`rustc r8_result_question.rs`）输出 `Ok(42)` 与 `Err(ParseIntError { kind: InvalidDigit })`；C++23 的 `std::expected` 用 g++ 15.2.0 `-std=c++23` 实测编译运行通过，输出 `7/2 = 3` / `err: division by zero`。两者都是「错误是值」而非控制流异常。而 C 返回码的问题在实测里也有影子：上面那个 C 越界程序返回码是 0——错误路径和成功路径在 OS 层面无法区分。

## 注意事项与常见坑

- **C/C++ 并非「不安全」所以不能用**：大量系统基础设施是 C/C++ 写的。差异在于**默认保障级别**——C/C++ 要求规范、review、静态分析工具（ASan/UBSan）兜底；Rust 把最常见的几类错误直接变成编译错误。
- **RAII 不是 Rust 独有**：C++ 也有 RAII。区别在于 Rust 的所有权/生命周期把它推广到**所有值**，并让借用检查器强制「释放后不可再引用」。
- **Rust 也有逃生口**：`unsafe` 允许绕过检查（FFI、底层数据结构、性能关键路径），但它是「把责任显式移交给程序员」，不是「关掉安全检查」。
- **模板元编程没有直接对应物**：C++ 的图灵完备模板元编程在 Rust 里由 `const fn`、const generics 和过程宏分担，能力边界不同，不要指望一一映射。

## 参考资料

- 官方文档：《The Rust Reference》· Behavior considered undefined：<https://doc.rust-lang.org/reference/behavior-considered-undefined.html>

## 相关页面

- [Rust vs Go](./vs-go)——并发模型与错误处理的另一条对照线。
- [Rust vs Java](./vs-java)——GC、泛型擦除与对象模型。
- [速查总表](./cheatsheet-table)——按维度逐项汇总。
- [所有权与移动语义](../language-core/ownership-and-move)——Rust 内存模型的根基。
- [生命周期](../language-core/lifetimes)——引用有效期的标注规则。
- [泛型与单态化](../language-core/generics-and-monomorphization)——trait bound 与单态化细节。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
