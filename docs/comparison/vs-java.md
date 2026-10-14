# Rust vs Java：GC、泛型擦除与对象模型

Java 与 Rust 是两套几乎相反的取舍：Java 用 GC + 一切皆对象换取开发效率，Rust 用所有权 + trait 换取无 GC 的确定性。这一页用**两边各跑一遍的实测**对照。

## 内存模型：GC vs 所有权

Oracle 官方 JVM GC 调优指南（Java 26）：GC「automatically manages the application's dynamic memory allocation requests」，其目的是把开发者从「分配配对释放、小心管理生命周期」中解放出来，「completely eliminates some classes of errors related to memory management at the cost of some additional runtime overhead」。

代价是**运行时开销**：HotSpot 提供多个收集器（Serial、G1 等），server-class 机器默认 G1，并采用分代回收、并行/并发标记、压缩整理等技术。

Rust 侧没有 GC。内存由所有权规则在编译期决定，drop 时机**确定且逆序**。实测（`rustc r11_drop_order.rs`）：

```text
main 主体结束
drop b
drop a
```

变量按声明**逆序** drop，嵌套作用域先 drop 内层。文件句柄、锁、连接都靠这个确定性在离开作用域时自动释放——没有 GC 停顿，也没有「忘记释放」。

| 维度 | Java | Rust |
| --- | --- | --- |
| 内存管理 | GC 自动回收（HotSpot，默认 G1） | 所有权 + RAII，编译期决定 |
| 释放时机 | GC 决定，不可预测 | 作用域结束，确定且逆序 |
| 运行时开销 | GC 线程 + 写屏障 + 压缩整理；GC 停顿可调优但仍有 | 无 GC；drop 是普通函数调用 |
| 循环引用 | GC 可回收 | `Rc` 循环泄漏，需 `Weak` 打断 |

## 泛型：类型擦除 vs 单态化

这是两个类型系统**最实质的语义差异**。Oracle 官方教程《Type Erasure》明确 Java 编译器做的事：

> Replace all type parameters in generic types with their bounds or Object if the type parameters are unbounded.
>
> Type erasure ensures that no new classes are created for parameterized types; consequently, generics incur no runtime overhead.

也就是说：**Java 的 `List<Integer>` 和 `List<Double>` 在运行时是同一个类**。这个结论官方教程没有逐字写出（它说的是「不会为参数化类型创建新类」的推论），所以下面用两边实测直接验证。

Java 侧实测（`javac j1_erasure.java` 后运行）：

```text
class java.util.ArrayList
class java.util.ArrayList
same class? true
```

Rust 侧实测（`rustc r10_type_names.rs`）：

```text
alloc::vec::Vec<i32>
alloc::vec::Vec<f64>
```

Rust 里 `Vec<i32>` 和 `Vec<f64>` 是**两个不同的类型**——试图互换直接编译失败。真实报错（`rustc r10b_vec_mismatch.rs`，失败，摘录）：

```text
error[E0308]: mismatched types
 --> r10b_vec_mismatch.rs:3:28
  |
3 |     let floats: Vec<f64> = ints;
  |                 --------   ^^^^ expected `Vec<f64>`, found `Vec<i32>`
```

| 维度 | Java 泛型 | Rust 泛型 |
| --- | --- | --- |
| 运行时表示 | 类型擦除，`List<Integer>` 与 `List<Double>` 同一类 | 单态化，`Vec<i32>` 与 `Vec<f64>` 是不同类型 |
| 运行时类型检查 | 只能检查到原始类型 `ArrayList` | 每个实例化都是具体类型 |
| 装箱 | `List<Integer>` 装箱 `Integer` 对象 | `Vec<i32>` 直接存原始 `i32`，无装箱 |
| 运行时开销 | 无（擦除零开销） | 无（单态化零开销，但生成多份代码，二进制更大） |

值得注意的是**装箱差异**：Java 泛型不能用于原始类型（`List<int>` 非法），每次 `add(int)` 都隐式装箱为 `Integer` 对象；Rust 的 `Vec<i32>` 是连续的 `i32` 数组，没有间接层。

## 空指针：NPE vs `Option`

Java 的引用类型都可以是 `null`，空安全靠程序员自觉和 `@Nullable` 注解体系（语言层面不强制）。Rust 用 `Option<T>` 把「可能没有」编码进**类型**，不处理 `None` 就编译不过。

Java 侧实测（`javac j2_npe.java` 后运行）：

```text
bob = null
Exception in thread "main" java.lang.NullPointerException: Cannot invoke "java.lang.Integer.toString()" because "<local2>" is null
	at j2_npe.main(j2_npe.java:10)
```

运行到第 10 行才炸，且 `bob = null` 这一步**编译器毫无察觉**。JDK 14+ 的 Helpful NullPointerExceptions 会告诉你**是哪个变量**为 null（报错里的 `"<local2>"`），但阻止不了 NPE 本身。Rust 侧，同样的 HashMap 取值返回 `Option<&V>`，直接对 `Option` 做算术编译期就报错（`rustc r9c_option_arith.rs`，失败，摘录）：

```text
error[E0369]: cannot add `{integer}` to `Option<i32>`
 --> r9c_option_arith.rs:3:24
  |
3 |     println!("{}", bob + 1);
  |                    --- ^ - {integer}
  |                    |
  |                    Option<i32>
```

类型系统**强制**你先处理「有没有」。只有显式调用 `.unwrap()` 才会 panic（`rustc r9_option_unwrap.rs`，失败）：

```text
thread 'main' (21203) panicked at r9_option_unwrap.rs:8:37:
called `Option::unwrap()` on a `None` value
```

即使 panic，也是**显式选择**的结果（unwrap），而 Java 的 NPE 是**忘记检查**的副作用。

## 对象模型：默认虚调用 vs trait + 显式分发

Java 里**所有非 `private`、非 `final` 的实例方法默认都是虚方法**——子类覆写后，父类引用调用即触发动态分发。实测（`javac j5_virtual.java` 后运行，`Animal a = new Dog(); a.speak()`）：

```text
wang
```

任何 `Animal` 引用都可能指向子类，这个动态性是**默认且不可关闭**的（除非 `final`/`private`）。

Rust 里 trait 有两种分发方式，**显式二选一**：

| 分发方式 | 写法 | 机制 | 实测代价 |
| --- | --- | --- | --- |
| 静态分发 | `fn draw<T: Shape>(s: &T)` | 单态化，编译期确定调用目标 | 零开销（可能代码膨胀） |
| 动态分发 | `&dyn Shape` / `Box<dyn Shape>` | vtable 间接跳转 | `&dyn Shape` 占 16 字节（数据指针 + vtable 指针），`&Circle` 只占 8 字节 |

实测（`rustc r16_dyn_size.rs`）：`&Circle` 占 8 字节，`&dyn Shape` 占 16 字节（数据指针 + vtable 指针），`Vec<Box<dyn Shape>>` 可正常遍历调用。

想直接把 trait 当类型用（`Vec<Shape>`）不行——trait 本身是不定长类型。真实报错（`rustc r7_dyn_vec.rs`，失败，摘录）：

```text
error[E0277]: the size for values of type `dyn Shape` cannot be known at compilation time
   --> r7_dyn_vec.rs:14:17
    |
14 |     let shapes: Vec<Shape> = vec![Circle];
   |                 ^^^^^^^^^^ doesn't have a size known at compile-time
```

必须写 `Vec<Box<dyn Shape>>`——**动态分发在 Rust 里是一个显式选择**，你要付出 `Box` 分配 + vtable 间接跳转的代价，而 Java 里这是免费的默认行为（代价是所有虚调用都可能被 JIT 内联失败）。

## 并发：synchronized/JMM vs 借用检查 + `Send`/`Sync`

Java 的并发正确性靠 **Java 内存模型（JMM）**和同步原语。Oracle 官方教程对无同步共享变量的后果表述：线程 A 改了 `counter`，线程 B 未必看得到——「there's no guarantee that thread A's change to `counter` will be visible to thread B — unless the programmer has established a happens-before relationship between these two statements」。

Java 的数据竞争**语义是良好定义的**（JLS §17.4）：不会崩溃、不会 UB，但**结果不可预测**——某个线程的更新可能丢失，或对其他线程不可见。实测（`javac j3_race.java`，两个线程各 `counter++` 10 万次，运行 5 次）：

```text
counter = 196839 (expected 200000)
counter = 195987 (expected 200000)
counter = 121896 (expected 200000)
counter = 200000 (expected 200000)
counter = 192473 (expected 200000)
```

5 次里 4 次结果错误，最少丢了 7.8 万次更新。Java 侧修法是 `synchronized`、`volatile`、`AtomicLong` 或锁。

Rust 侧，同样的「无同步共享可变数据」**编译不过**。两个线程共享一个 `Vec`（`rustc r5_threads_share.rs`，失败，4 个错误，摘录）：

```text
error[E0499]: cannot borrow `v` as mutable more than once at a time
error[E0502]: cannot borrow `v` as immutable because it is also borrowed as mutable
```

即使是「线程安全」的 `Rc` 也过不去——`Rc` 的引用计数不是原子的，跨线程共享是类型系统层面禁止的（`rustc r6_rc_thread.rs`，失败，摘录）：

```text
error[E0277]: `Rc<String>` cannot be sent between threads safely
   = help: within `{closure@r6_rc_thread.rs:6:27: 6:34}`, the trait `Send` is not implemented for `Rc<String>`
```

`Send`/`Sync` 是**编译期 trait**：`thread::spawn` 要求闭包 `F: Send + 'static`，不满足直接编译失败。正确做法是 `Arc<Mutex<_>>`（共享 + 互斥）或 channel（消息传递），**类型系统保证你不会忘记加锁**。

| 维度 | Java | Rust |
| --- | --- | --- |
| 数据竞争后果 | 语义定义良好，结果不可预测（更新丢失、可见性问题） | **编译失败**（借用检查 + `Send`/`Sync`） |
| 典型修复 | `synchronized`、`volatile`、`Atomic*`、`ConcurrentHashMap` | `Arc<Mutex<T>>`、`Arc<AtomicU64>`、channel |
| 正确性保证来源 | 程序员遵守 JMM（happens-before）；忘记加锁是运行时偶发错误 | 编译器强制（trait bound）；忘记包装直接编译失败 |

## 启动成本与产物形态

hello world 同机实测（各 3 次）：

| 语言 | 启动到输出 | 产物形态 |
| --- | --- | --- |
| Java | 0.18–0.19s | `.class` 字节码，需 JVM 运行 |
| Rust | ~0.00s | 原生 ELF，strip 后 337KB（含 debug info 时 4.5MB） |

Java 的启动成本来自 JVM 初始化 + 类加载 + JIT 预热——前几次执行跑的是解释器，热点代码才被编译。这对**短生命周期进程**（CLI、serverless 冷启动）是实打实的成本，也是 GraalVM native image 这类 AOT 方案存在的理由。Rust 直接编译到原生代码，没有这层启动税。

## 注意事项与常见坑

- **Java 不是「慢」**：JIT 预热后，长期运行的服务端负载 Java 性能不差；Rust 的优势在**无 GC 停顿的确定性延迟**和**冷启动**，不是全方位碾压。
- **类型擦除不等于无用**：Java 泛型提供了编译期类型检查，只是运行时信息被擦除；需要运行时类型信息时用反射或显式传 `Class<T>`。
- **Rust 没有「万能基类」**：`Object` 的继承体系在 Rust 里对应的是 trait + 泛型，思维模型要从「is-a 继承」转向「has-a 能力」。
- **`Option` 不是可空的银弹**：`unwrap()` 滥用等于把 NPE 换成 panic；惯用做法是 `match`/`if let`/`unwrap_or`/`?`。

## 参考资料

- 官方文档：《The Java Tutorials》· Type Erasure：<https://docs.oracle.com/javase/tutorial/java/generics/erasure.html>

## 相关页面

- [Rust vs C/C++](./vs-ccpp)——内存安全与泛型的另一条对照线。
- [Rust vs Go](./vs-go)——并发模型与错误处理。
- [速查总表](./cheatsheet-table)——按维度逐项汇总。
- [所有权与移动语义](../language-core/ownership-and-move)——Rust 无 GC 的根基。
- [错误处理](../language-core/error-handling)——`Result` 与 `?`。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
