# 生命周期

**生命周期（lifetime）**是引用的有效期。编译器要求每个引用都带生命周期标注，用来保证「引用不会比被引用数据活得更久」——即杜绝悬垂引用。这一页讲为什么需要标注、`'a` 怎么写、什么时候可以省略。

## 为什么需要标注

看一个编译器无法自动判断的场景：

```rust
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}
```

返回的引用可能来自 `x`，也可能来自 `y`，编译器无法确定返回值的有效期该跟谁走，于是要求显式标注。

## 'a 标注：描述约束，而非延寿

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let result;
    {
        let s2 = String::from("xyz");
        result = longest(s1.as_str(), s2.as_str());
        println!("longest = {result}"); // s2 还活着时合法
    } // s2 在此 drop；若在此之后再用 result 将编译失败
    // println!("{result}"); // 取消注释即编译错误
}
```

真实运行输出：

```text
longest = long string
```

`'a` 的含义是：**存在某个生命周期 `'a`，使得 `x`、`y` 和返回值都至少活那么久**。它描述的是三者之间的约束关系，不会让任何值活得更久——把最后一行 `println!("{result}")` 取消注释，编译器会指出 `result` 的有效期不能超过 `s2`。

## 省略规则：常见签名不用写

大多数函数签名满足**省略规则（elision rules）**，编译器自动推断，无需手写标注：

1. 每个引用参数各得一个生命周期；
2. 若只有一个输入生命周期，它赋给所有输出生命周期；
3. 若有多个输入生命周期，但其中一个是 `&self` / `&mut self`，则 `self` 的生命周期赋给所有输出生命周期。

```rust
fn first_word(s: &str) -> &str {
    match s.find(' ') {
        Some(i) => &s[..i],
        None => s,
    }
}

fn main() {
    let s = String::from("hello world");
    println!("first word = {}", first_word(&s)); // 省略标注也能编译
}
```

真实运行输出：

```text
first word = hello
```

规则 2 生效：唯一输入生命周期赋给返回值。方法签名（规则 3）是最常见的省略场景，所以 `fn get(&self) -> &T` 这类写法随处可见。

## 'static：整个程序有效期

`'static` 是特殊的生命周期：数据在整个程序运行期间都有效，主要是字符串字面量（编译进二进制）和 `static` 常量：

```rust
fn main() {
    let s: &'static str = "程序整个生命周期都在的字符串";
    println!("{s}");
}
```

真实运行输出：

```text
程序整个生命周期都在的字符串
```

注意：`'static` 作为**约束**（如 `T: 'static`）表示「不包含非 'static 引用」，与「值真的活一辈子」是两回事，不要混用。

## 注意事项与常见坑

- **标注不改变任何值的存活时间**：`'a` 只是给编译器的约束声明，写错只会编译失败，不会导致运行时问题。
- **结构体持有引用必须标注**：`struct Parser<'a> { input: &'a str }`——结构体的生命周期参数是必填项。
- **生命周期参数与泛型参数并列**：`fn f<'a, T: 'a>(x: &'a T)`，泛型约束里可以要求 `T: 'a`。

## 相关页面

- [借用与引用](./borrowing-and-references)——生命周期是借用规则的静态化。
- [切片与 &str](./slices-and-str)——切片作为返回值时的经典标注场景。
- [trait 与实现](./traits)——trait 对象与生命周期的关系见第 2 部分类型系统。

官方文档：<https://doc.rust-lang.org/book/ch10-03-lifetime-syntax.html>
