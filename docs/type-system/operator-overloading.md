# 运算符重载

Rust 的运算符不是特殊语法，而是**方法调用的别名**：`a + b` 就是 `Add::add(a, b)`，`buf[i]` 就是 `*Index::index(&buf, i)`。给自定义类型实现 `std::ops`、`std::cmp` 里的对应 trait，运算符就随之生效。这一页用向量运算走一遍完整流程，再看两个「语法级」的重载 `Index` 与 `Deref`。

## 用 `Add`/`Sub`/`Mul`/`Neg` 实现向量运算

每个运算 trait 都带一个 `Output` 关联类型（见[关联类型](./associated-types)），声明「运算结果是什么类型」：

```rust
use std::ops::{Add, Sub, Mul, Neg};

#[derive(Debug, Clone, Copy, PartialEq)]
struct Vec2 { x: f64, y: f64 }

impl Add for Vec2 {
    type Output = Self;
    fn add(self, rhs: Self) -> Self { Vec2 { x: self.x + rhs.x, y: self.y + rhs.y } }
}

impl Sub for Vec2 {
    type Output = Self;
    fn sub(self, rhs: Self) -> Self { Vec2 { x: self.x - rhs.x, y: self.y - rhs.y } }
}

// Rhs 指定为 f64：向量 × 标量
impl Mul<f64> for Vec2 {
    type Output = Self;
    fn mul(self, k: f64) -> Self { Vec2 { x: self.x * k, y: self.y * k } }
}

impl Neg for Vec2 {
    type Output = Self;
    fn neg(self) -> Self { Vec2 { x: -self.x, y: -self.y } }
}

fn main() {
    let a = Vec2 { x: 1.0, y: 2.0 };
    let b = Vec2 { x: 3.0, y: 4.0 };
    println!("a + b    = {:?}", a + b);
    println!("a - b    = {:?}", a - b);
    println!("a * 2.5  = {:?}", a * 2.5);
    println!("-a       = {:?}", -a);
}
```

真实运行输出：

```text
a + b    = Vec2 { x: 4.0, y: 6.0 }
a - b    = Vec2 { x: -2.0, y: -2.0 }
a * 2.5  = Vec2 { x: 2.5, y: 5.0 }
-a       = Vec2 { x: -1.0, y: -2.0 }
```

三个细节：

- 算术运算的接收者是 `self`（按值消费），所以示例给 `Vec2` derive 了 `Copy`，`a + b` 之后 `a` 还能用；
- `Mul<f64>` 把默认类型参数 `Rhs` 显式换成 `f64`——同一对类型可以同时定义「向量乘标量」与「向量乘向量」两种乘法；
- 复合赋值 `+=` 由 `AddAssign` 家族单独控制，和 `Add` 是两个 trait。

## `Index`/`IndexMut`：让 `buf[i]` 生效

`[]` 下标语法对应 `Index`（读）与 `IndexMut`（写）两个 trait，自定义容器实现它们就能用原生下标语法：

```rust
use std::ops::{Index, IndexMut, Deref, DerefMut};

struct Buffer {
    data: Vec<u8>,
}

// Index：让 buf[i] 读语法生效
impl Index<usize> for Buffer {
    type Output = u8;
    fn index(&self, i: usize) -> &u8 { &self.data[i] }
}

// IndexMut：让 buf[i] = x 写语法生效
impl IndexMut<usize> for Buffer {
    fn index_mut(&mut self, i: usize) -> &mut u8 { &mut self.data[i] }
}

impl Deref for Buffer {
    type Target = [u8];
    fn deref(&self) -> &[u8] { &self.data }
}

impl DerefMut for Buffer {
    fn deref_mut(&mut self) -> &mut [u8] { &mut self.data }
}

fn main() {
    let mut buf = Buffer { data: vec![10, 20, 30] };
    println!("buf[1] = {}", buf[1]);
    buf[1] = 99;                                // 需要 IndexMut
    println!("after write, buf[1] = {}", buf[1]);
    println!("len via Deref = {}", buf.len());  // 方法调用自动解引用到 [u8]
}
```

真实运行输出：

```text
buf[1] = 20
after write, buf[1] = 99
len via Deref = 3
```

## `Deref`/`DerefMut` 与自动解引用

上面 `buf.len()` 能跑通，靠的是**deref 强制转换**：方法解析在 `Buffer` 上找不到 `len`，就沿着 `Deref::deref` 一路找下去——`Buffer` 变 `[u8]`，`len` 命中。`*x`、`&x` 场景同理，`Box<T>`、`Rc<T>` 让用起来像 `T` 就是这个机制。

但 `Deref` 是给「智能指针语义」准备的，不是给「继承」用的。给 newtype 加 `Deref` 好像能补救[孤儿规则](./orphan-rule-and-newtype)页里「方法丢失」的问题，代价是内部类型的**全部**方法（包括不该暴露的）都会漏出来——一般只建议在明确的包装类型上使用。

## 不能重载的运算符

参考文档的运算符表列出了全部可重载项（`std::ops`/`std::cmp` 里的 trait），不在表里的都不能重载：

- `&&`、`||`——短路求值语义必须由语言保证，没有对应 trait；
- `.` 字段访问——没有「拦截字段访问」的机制；
- `as` 类型转换、`&`/`&mut` 借用——参考文档明确写了「cannot be overloaded」；
- `=` 普通赋值不可重载（`==` 走 `PartialEq`，`+=` 走 `AddAssign`）。

调用运算符 `()` 的「重载」是个特例：它由 `Fn`/`FnMut`/`FnOnce` 家族提供，也就是闭包机制本身，见[闭包与 `Fn` 家族](./closures-and-fn-trait-family)。

## 相关页面

- [关联类型](./associated-types)——每个运算 trait 的 `Output` 与默认类型参数。
- [闭包与 `Fn` 家族](./closures-and-fn-trait-family)——调用运算符 `()` 的重载机制。
- [孤儿规则与 newtype](./orphan-rule-and-newtype)——`Deref` 补救方法丢失的权衡。
- [trait 与实现](../language-core/traits)——运算 trait 也是普通 trait。

官方文档：<https://doc.rust-lang.org/std/ops/>
