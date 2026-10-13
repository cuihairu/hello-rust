# 所有权与移动语义

Rust 不用垃圾回收器管理内存，而是用**所有权（ownership）**规则在编译期保证内存安全：每个值有且只有一个 owner，owner 离开作用域时值被 drop（释放）。这一页讲三规则与 move 语义，它是后面借用、生命周期、智能指针一切内容的地基。

## 三条规则

1. 每个值有且只有一个 owner（变量）；
2. 值在同一时刻只能有一个 owner；
3. owner 离开作用域时，值被 drop。

## move：赋值即转移所有权

`String` 这类堆类型在赋值时发生 **move**：原变量交出所有权，之后不可再用。

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 的所有权 move 给 s2
    // println!("{s1}"); // 取消注释即编译错误
    println!("s2 = {s2}");
}
```

真实运行输出：

```text
s2 = hello
```

把 `println!("{s1}")` 取消注释后，编译器直接拒绝编译（rustc 1.99.0 实测）：

```text
error[E0382]: borrow of moved value: `s1`
 --> p1_move_err.rs:4:16
  |
2 |     let s1 = String::from("hello");
  |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
3 |     let s2 = s1;
  |              -- value moved here
4 |     println!("{s1}");
  |                ^^ value borrowed here after move
```

错误信息同时点出了关键：`String` 没有实现 `Copy` trait，所以走 move 而不是复制。

## Copy 类型：赋值即复制

实现了 `Copy` trait 的类型（整数、浮点、bool、char，以及只含 Copy 类型的元组/数组）在赋值时按位复制，原变量继续可用：

```rust
fn main() {
    let x = 5;
    let y = x; // i32 是 Copy 类型：复制而非 move
    println!("x = {x}, y = {y}"); // 两个变量都还能用
}
```

真实运行输出：

```text
x = 5, y = 5
```

`Copy` 与 `Clone` 的分工：`Copy` 是隐式的按位复制（旧变量仍可用），`Clone` 是显式调用 `.clone()` 的深拷贝（旧变量仍可用，但可能分配新内存）。

## drop：作用域结束即释放

owner 离开作用域时，Rust 自动调用 `Drop`（对 `String` 即释放堆内存）：

```rust
fn main() {
    {
        let s = String::from("离开作用域即 drop");
        println!("{s}");
    } // s 在这里被 drop，堆内存释放
    println!("作用域已结束");
}
```

真实运行输出：

```text
离开作用域即 drop
作用域已结束
```

drop 顺序是确定的：变量按声明**逆序** drop，嵌套作用域先 drop 内层。这个确定性是 RAII 模式的基础——文件句柄、锁、连接都靠离开作用域自动释放。

## 函数传参与返回值同样 move

所有权规则不只作用于 `let` 赋值：把 `String` 传进函数、或从函数返回，都发生 move。

```rust
fn take_ownership(s: String) {
    println!("got: {s}");
} // s 在这里 drop

fn main() {
    let s = String::from("hello");
    take_ownership(s); // s move 进函数
    // println!("{s}"); // 编译错误：s 已 move
}
```

## 注意事项与常见坑

- **move 不是 bug，是防线**：`use of moved value` 编译错误意味着你正在使用已交出所有权的值；要么改设计，要么显式 `.clone()`。
- **clone 不是银弹**：深拷贝有运行时开销，频繁 clone 大对象前先想清楚所有权能不能直接转移。
- **Copy 类型没有 drop 语义**：整数离开作用域什么都不发生，所以 `Copy` 与 `Drop` 互斥（实现了 `Drop` 的类型不能实现 `Copy`）。

## 相关页面

- [借用与引用](./borrowing-and-references)——不转移所有权地使用值。
- [切片与 &str](./slices-and-str)——对堆数据的视图。
- [生命周期](./lifetimes)——引用有效期的标注。
- [知识点整理](../knowledge)——全站复习主线。

官方文档：<https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html>
