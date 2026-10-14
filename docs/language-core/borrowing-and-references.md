# 借用与引用

如果每次使用值都要先交出所有权，代码将寸步难行。**借用（borrowing）**允许你通过引用（`&T` / `&mut T`）临时使用值而不获取所有权——引用在作用域结束时自动失效，值本身不受影响。

## 两种引用

- `&T`：共享引用，只读，同一时刻可以有任意多个；
- `&mut T`：可变引用，可读写，同一时刻只能有一个。

```rust
fn main() {
    let mut s = String::from("hello");

    let r1 = &s; // 共享引用
    let r2 = &s; // 同时多个共享引用：允许
    println!("r1 = {r1}, r2 = {r2}");

    let r3 = &mut s; // 可变引用
    r3.push_str(", world");
    println!("r3 = {r3}");
}
```

真实运行输出：

```text
r1 = hello, r2 = hello
r3 = hello, world
```

## 借用规则：编译期的数据竞争防线

同一时刻，对同一份数据，要么只有共享引用，要么只有一个可变引用，二者不可并存：

```rust
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    let r2 = &mut s; // 错误：r1 仍活跃时不能创建 &mut s
    println!("{r1} {r2}");
}
```

编译器拒绝编译（rustc 1.99.0 实测）：

```text
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
 --> p2_err.rs:4:14
  |
3 |     let r1 = &s;
  |              -- immutable borrow occurs here
4 |     let r2 = &mut s;
  |              ^^^^^^ mutable borrow occurs here
5 |     println!("{r1} {r2}");
  |                -- immutable borrow later used here
```

这条规则与「引用不能比被引用数据活得更久」一起，让 Rust 在编译期就排除了数据竞争——不需要运行时锁来发现竞争，竞争根本写不出来。

## NLL：非词法作用域生命周期

早期 Rust 要求引用的生命周期覆盖整个词法作用域，即使最后一次使用早已结束。现代 Rust 使用 **NLL（Non-Lexical Lifetimes）**：引用的生命周期在**最后一次使用**处结束：

```rust
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    println!("{r1}"); // r1 最后一次使用
    let r2 = &mut s; // NLL：r1 已不再活跃，可以创建可变引用
    r2.push_str("!");
    println!("{r2}");
}
```

真实运行输出：

```text
hello
hello!
```

NLL 让「先只读检查、后可变修改」这类自然写法可以直接通过编译，而不必把读操作包进额外作用域。

## 悬垂引用：编译期拦截

引用不能指向已释放的内存。若函数返回对局部变量的引用，编译器直接拒绝：

```rust
fn dangle<'a>() -> &'a String {
    let s = String::from("hello");
    &s // 错误：s 在函数返回时被 drop，返回的引用将悬垂
}
```

编译器拒绝编译（rustc 1.99.0 实测）：

```text
error[E0515]: cannot return reference to local variable `s`
 --> p2_dangle2.rs:3:5
  |
3 |     &s
  |     ^^ returns a reference to data owned by the current function
```

（若省略生命周期标注，会先报 E0515 的前置错误 E0106 `missing lifetime specifier`。）正确做法是把所有权 move 出去，或用调用方传入的引用（见 [生命周期](./lifetimes)）。

## 注意事项与常见坑

- **可变引用独占期间不能有任何共享引用**：包括 `println!` 里对原变量的读取，编译器会精确到「最后一次使用」来判定。
- **NLL 不是万能的**：跨分支、跨函数的复杂借用仍可能报错，报错时先画一下各引用的「最后使用点」。
- **借用检查只认编译期**：运行时的动态借用（如 `RefCell`）是另一套机制，见第 3 部分内存与并发。

## 参考资料

- 官方文档：《The Rust Programming Language》第 4 章 · References and Borrowing：<https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html>

## 相关页面

- [所有权与移动语义](./ownership-and-move)——借用是 move 的替代方案。
- [生命周期](./lifetimes)——跨函数传递引用时的标注。
- [trait 与实现](./traits)——`&self` / `&mut self` 是 trait 方法的常见接收者。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
