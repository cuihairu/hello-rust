# trait 对象与动态分发

**trait 对象**（`dyn Trait`）让「同一套接口、不同类型」的值可以放进同一个容器、走同一条代码路径。与泛型的**静态分发**（编译期单态化）相对，trait 对象是**动态分发**——运行时通过 vtable 查表调用。这一页讲 `dyn Trait` 的用法、对象安全条件、vtable 的内存布局，以及与泛型的权衡。

## 基本用法

`dyn Trait` 是**动态大小类型**，不能按值使用，必须放在指针后面：`&dyn Trait`、`Box<dyn Trait>`、`Rc<dyn Trait>` 等。

```rust
trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> &str;
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r }
    fn name(&self) -> &str { "circle" }
}

impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }
    fn name(&self) -> &str { "square" }
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { r: 1.0 }),
        Box::new(Square { side: 2.0 }),
    ];
    for s in &shapes {
        println!("{} area = {:.4}", s.name(), s.area());
    }
}
```

真实运行输出：

```text
circle area = 3.1416
square area = 4.0000
```

- `Vec<Box<dyn Shape>>` 是**异构容器**：不同类型（`Circle`、`Square`）经 `Box` 装箱到堆上，`Vec` 里存的是一组 trait 对象指针；
- 调用 `s.area()` 时编译器**不知道** `s` 的具体类型，只能运行时查表——这就是动态分发。

## 对象安全：不是所有 trait 都能变成 `dyn`

trait 要能作为 trait 对象使用，必须满足**对象安全**（旧称 object safety，Rust 参考文档现称 dyn compatibility）。最常见的违规是**方法带泛型参数**——vtable 要为每个具体类型存一份方法指针，泛型方法有无穷多种实例化，无法建表：

```rust
trait Bad {
    fn make<T>(&self, x: T) -> T { x }
}

fn use_it(_b: &dyn Bad) {}

fn main() {}
```

真实编译输出（rustc 1.99.0）：

```text
error[E0038]: the trait `Bad` is not dyn compatible
 --> p1_unsafe.rs:5:16
  |
5 | fn use_it(_b: &dyn Bad) {}
  |                ^^^^^^^ `Bad` is not dyn compatible
  |
note: for a trait to be dyn compatible it needs to allow building a vtable
      for more information, visit <https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility>
 --> p1_unsafe.rs:2:8
  |
1 | trait Bad {
  |       --- this trait is not dyn compatible...
2 |     fn make<T>(&self, x: T) -> T { x }
  |        ^^^^ ...because method `make` has generic type parameters
  = help: consider moving `make` to another trait
```

另一类违规是**方法返回 `Self`**——具体类型运行时才确定，编译期不知道返回值多大：

```rust
trait Bad {
    fn clone_it(&self) -> Self;
}
```

真实编译输出（rustc 1.99.0，写 `&dyn Bad` 时触发）：

```text
error[E0038]: the trait `Bad` is not dyn compatible
2 |     fn clone_it(&self) -> Self;
  |                           ^^^^ ...because method `clone_it` references the `Self` type in its return type
```

完整规则（Rust 参考文档）：trait 不能要求 `Self: Sized`、不能有关联常量；方法不能有泛型类型参数、不能在返回类型用 `Self`、不能返回不透明类型（`async fn`、`-> impl Trait`）。带 `where Self: Sized` 的方法被显式排除在 vtable 之外，只能通过具体类型调用。注意：定义带泛型方法的 trait **不报错**，只有写成 `&dyn Bad` 时才报 E0038。

## vtable：动态分发的实现

`&dyn Trait` 是**胖指针**：一个指向数据的指针 + 一个指向 vtable 的指针。vtable 里存着该具体类型的方法指针、`size`、`align`、`drop_in_place`。用 `size_of` 实证（rustc 1.99.0）：

```rust
use std::mem::size_of_val;

trait Shape {
    fn area(&self) -> f64;
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle { fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r } }
impl Shape for Square { fn area(&self) -> f64 { self.side * self.side } }

fn main() {
    let c = Circle { r: 1.0 };
    let sq = Square { side: 2.0 };
    let dc: &dyn Shape = &c;
    let ds: &dyn Shape = &sq;
    println!("size_of_val(&Circle)   = {}", size_of_val(&c));
    println!("size_of_val(dyn Shape) = {}", size_of_val(dc));
    println!("size_of(&dyn Shape)    = {}", size_of_val(&dc));
    println!("area circle = {}, square = {}", dc.area(), ds.area());
}
```

真实运行输出：

```text
size_of_val(&Circle)   = 8
size_of_val(dyn Shape) = 8
size_of(&dyn Shape)    = 16
area circle = 3.141592653589793, square = 4
```

`&Circle` 是 8 字节单指针，`&dyn Shape` 是 16 字节胖指针——多出的 8 字节就是 vtable 指针。把胖指针拆开（`unsafe` `transmute` 成两个裸指针），能看到两个具体类型的 vtable 指针确实不同：

```rust
let (pc, vc): (*const (), *const ()) = unsafe { transmute(dc) };
let (ps, vs): (*const (), *const ()) = unsafe { transmute(ds) };
println!("data ptr  equal: {}", pc == ps);
println!("vtable ptr equal: {}", vc == vs);
println!("vtable ptr circle = {vc:p}, square = {vs:p}");
```

真实运行输出：

```text
data ptr  equal: false
vtable ptr equal: false
vtable ptr circle = 0x5590f64f3808, square = 0x5590f64f3828
```

两个 vtable 指针相差 0x20（32 字节）——每个 vtable 条目是 8 字节指针，两个 vtable 在内存里相邻存放。调用 `dc.area()` 时，CPU 从 vtable 取出 `Circle::area` 的地址跳过去——动态分发的全部开销就是这一次间接跳转。

## 与泛型静态分发的权衡

泛型是**静态分发**：编译器为每个具体类型生成一份专用代码，运行时直接调用，没有查表。代价是**代码体积**——每个实例化类型一份。用 `nm` 看符号表实证（rustc 1.99.0，`-C opt-level=0`）：一个 `fn show<T: Debug>(x: T)` 被 7 种类型调用后，符号表里出现 7 个独立符号（节选 3 个）：

```text
0000000000016080 t _RINvCseNfuMIpMiGP_10p1_generic4showcEB2_
0000000000016140 t _RINvCseNfuMIpMiGP_10p1_generic4showhEB2_
0000000000016010 t _RINvCseNfuMIpMiGP_10p1_generic4showReEB2_
```

同样的逻辑改成 `fn show_dyn(x: &dyn Debug)`，符号表只剩 1 个，二进制也略小：

```text
00000000000160a0 t _RNvCsbJWdSRWE0oY_9p1_dynver8show_dyn
-rwxr-xr-x 1 cui cui 4568424 ... p1_dynver0
-rwxr-xr-x 1 cui cui 4570120 ... p1_generic0
```

| 维度 | 泛型（静态分发） | `dyn Trait`（动态分发） |
|---|---|---|
| 性能 | 直接调用，可内联 | 一次间接跳转，通常无法内联 |
| 代码体积 | 每个类型一份 | 一份代码 + 每类型一个 vtable |
| 类型数量 | 编译期可知 | 运行期才确定（插件、UI 组件树） |
| 典型场景 | 热路径、类型有限 | 异构集合、类型擦除、缩短编译时间 |

经验法则：**默认用泛型**；类型数量不可控或编译时间成为瓶颈时改用 `dyn Trait`。两者可混用——泛型函数内部用 `dyn Trait` 收敛实例化数量。

## 注意事项与常见坑

- **`dyn Trait` 不是 `Sized`**：不能按值传递、不能做数组元素，必须放在 `&`、`Box`、`Rc` 等指针后面；
- **默认生命周期是 `'static`**：`Box<dyn Trait>` 实际是 `Box<dyn Trait + 'static>`，要借用局部数据需写 `Box<dyn Trait + 'a>`；
- **对象安全在「使用处」报错**：定义带泛型方法的 trait 不报错，写 `&dyn Bad` 才报 E0038。

## 相关页面

- [泛型与单态化](../language-core/generics-and-monomorphization)——静态分发的对照面。
- [trait 与实现](../language-core/traits)——trait 定义与默认方法。
- [impl Trait](./impl-trait)——另一种「不暴露具体类型」的抽象。
- [错误处理](../language-core/error-handling)——`Box<dyn Error>` 是 trait 对象的典型应用。

官方文档：<https://doc.rust-lang.org/reference/types/trait-object.html>
