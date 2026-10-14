# 闭包与 `Fn` 家族

闭包是「匿名函数 + 捕获的环境」：它不是函数指针，而是编译器生成的匿名类型，按捕获内容实现 `Fn`、`FnMut`、`FnOnce` 中的一个或多个。三个 trait 的区别只在方法接收者——`FnOnce::call_once(self)`、`FnMut::call_mut(&mut self)`、`Fn::call(&self)`——也就是**调用一次要消耗多少权限**。这一页讲捕获推断、`move`，以及 `FnOnce` 在标准库里的典型用法。

## 捕获方式由使用决定

闭包怎么捕获环境，由**闭包体里怎么用**决定：只读就借引用，要改就借可变引用，要移走就按值拿。反过来，闭包体决定了它能实现哪些 trait：

```rust
// 三个 trait 的接收者不同：&self / &mut self / self
fn apply_fn<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 { f(x) }
fn apply_fnmut<F: FnMut(i32) -> i32>(mut f: F, x: i32) -> i32 { f(x) }
fn apply_fnonce<F: FnOnce(i32) -> i32>(f: F, x: i32) -> i32 { f(x) }

fn main() {
    // 只读捕获：同时实现 Fn、FnMut、FnOnce
    let n = 10;
    let add_n = |x| x + n;
    println!("Fn:      {}", apply_fn(add_n, 5));
    println!("FnMut:   {}", apply_fnmut(add_n, 5));
    println!("FnOnce:  {}", apply_fnonce(add_n, 5));

    // 可变捕获：只实现 FnMut 和 FnOnce
    let mut count = 0;
    let mut bump = |x| { count += 1; x + count };
    println!("FnMut:   {}", apply_fnmut(&mut bump, 5));
    println!("FnOnce:  {}", apply_fnonce(&mut bump, 5));

    // 移动捕获（消耗环境变量）：只实现 FnOnce
    let s = String::from("moved");
    let consume = move |_| s.len() as i32;
    println!("FnOnce:  {}", apply_fnonce(consume, 0));
}
```

真实运行输出：

```text
Fn:      15
FnMut:   15
FnOnce:  15
FnMut:   6
FnOnce:  7
FnOnce:  5
```

能力是层层包含的：`Fn` 的闭包必然也能当 `FnMut`、`FnOnce` 用；捕获了可变环境就掉出 `Fn`；按值消耗环境就只剩 `FnOnce`。所以**接收闭包的 API 尽量放宽到 `FnOnce`**，对调用方最友好。

### 调用 `FnMut` 需要可变绑定

`FnMut` 调用走 `&mut self`，所以闭包绑定本身必须可 `mut`——`move` 转手之后也不例外：

```rust
// FnMut 需要可变接收者：普通调用也得保证 mut
fn main() {
    let mut count = 0;
    let mut bump = |x| { count += 1; x + count };
    let f = bump;          // move：bump 变成不可变绑定
    f(1);
    f(2);                  // f 是不可变绑定，调用 FnMut 会失败
}
```

真实运行输出（节选，warning 部分略）：

```text
error[E0596]: cannot borrow `f` as mutable, as it is not declared as mutable
 --> fnmut_binding.rs:5:9
  |
4 |     let mut bump = |x| { count += 1; x + count };
  |                          ----- calling `f` requires mutable borrow of `count`
5 |     let f = bump;          // move：bump 变成不可变绑定
  |         ^ not mutable
6 |     f(1);
  |     - cannot borrow as mutable
7 |     f(2);                  // f 是不可变绑定，调用 FnMut 会失败
  |     - cannot borrow as mutable
```

## `move` 闭包：拿走所有权

`move` 强制闭包按值捕获所有用到的变量，不再借用环境：

```rust
fn main() {
    let s = String::from("data");
    let own = move || println!("owned: {s}");   // move：按值拿走 s
    own();
}
```

真实运行输出：

```text
owned: data
```

最典型的场景是**闭包活得比环境久**：返回闭包、把闭包扔进线程。返回闭包不加 `move` 会直接编译失败（E0373，见 [`impl Trait`](./impl-trait) 一页）；`std::thread::spawn` 的参数约束是 `FnOnce() + Send + 'static`，`move` 更是标配。

## 闭包作为参数与返回值

参数位置用 `impl Fn(i32) -> i32`（等价于泛型 + 约束，见[零成本抽象](./zero-cost-abstraction)），返回位置 `impl Fn` 是标准写法——两者都走静态分发。需要「同一签名的一组闭包装进同一集合」时才换 `Box<dyn Fn>`，为灵活性付出动态分发的代价（对比见 [trait 对象](./trait-objects)）。

## `OnceCell::get_or_init`：`FnOnce` 的典型场景

`OnceCell::get_or_init` 的签名是 `get_or_init<F>(&self, f: F) -> &T where F: FnOnce() -> T`——初始化闭包**最多被调用一次**，所以约束到最宽松的 `FnOnce` 就够：

```rust
use std::cell::OnceCell;

fn main() {
    let cell = OnceCell::new();

    let v1 = cell.get_or_init(|| {
        println!("initializing... (expensive)");
        42
    });
    println!("first call -> {v1}");

    let v2 = cell.get_or_init(|| {
        println!("initializing... (should not happen)");
        99
    });
    println!("second call -> {v2}");
    assert_eq!(v1, v2);
}
```

真实运行输出：

```text
initializing... (expensive)
first call -> 42
second call -> 42
```

第二个闭包根本没被执行——`should not happen` 没有出现。这类「可能只调一次」的 API（`unwrap_or_else`、`map_or_else` 等）都把约束放宽到 `FnOnce`，正是三个 trait 层级关系的直接应用。

## 参考资料

- 官方文档：《The Rust Programming Language》第 13 章 · Closures：<https://doc.rust-lang.org/book/ch13-01-closures.html>

## 相关页面

- [`impl Trait`](./impl-trait)——闭包作为参数与返回值的签名写法。
- [关联类型](./associated-types)——`FnOnce::Output` 描述返回值类型。
- [所有权与 move](../language-core/ownership-and-move)——捕获与 `move` 的语义根基。
- [trait 与实现](../language-core/traits)——`Fn` 家族就是三个普通 trait。
