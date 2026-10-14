# 切片与 &str

**切片（slice）**是对一段连续数据的视图：不持有所有权，只记录「起始指针 + 长度」。它让你安全地引用数组或 `String` 的一部分，而不必复制数据。

## 两种切片

- `&[T]`：任意元素类型 `T` 的切片；
- `&str`：字符串切片，是 `&[u8]` 的语义化包装（保证内容是合法 UTF-8）。

切片是**胖指针**（fat pointer）：两个字宽——数据指针与长度。因此切片可以安全地做边界检查，且能表示空切片。

## 字符串切片与 first_word 经典例子

```rust
fn first_word(s: &String) -> &str {
    let bytes = s.as_bytes();
    for (i, &item) in bytes.iter().enumerate() {
        if item == b' ' {
            return &s[..i];
        }
    }
    &s[..]
}

fn main() {
    let s = String::from("hello world");
    let w = first_word(&s);
    // s.clear(); // 错误：w 仍持有对 s 的不可变借用
    println!("first word = {w}");

    let arr = [1, 2, 3, 4, 5];
    let slice = &arr[1..4];
    println!("slice = {slice:?}"); // [2, 3, 4]
}
```

真实运行输出：

```text
first word = hello
slice = [2, 3, 4]
```

注意 `first_word` 的签名：参数是 `&String`，返回是 `&str`——返回类型与参数类型解耦，函数对「整个字符串」和「字符串切片」都能工作。`&s[..i]` 与 `&s[..]` 是切片语法：`[..i]` 左闭右开，`[..]` 全范围。

## deref coercion：&String 自动转 &str

把 `&String` 传给需要 `&str` 的函数时，Rust 自动做 **deref coercion**（解引用强制转换）：

```rust
fn main() {
    let s = String::from("hello");
    let r: &str = &s;        // deref coercion：&String → &str
    let r2: &str = &s[1..3]; // 切片也是 &str
    println!("{r}, {r2}");
}
```

真实运行输出：

```text
hello, el
```

deref coercion 的规则是链式的：`&String` → `&str` → `&[u8]`。它发生在函数传参、方法调用等位置，是 `&String` 与 `&str` 混用不别扭的原因。

## 切片与借用的联动

切片是引用，受 [借用规则](./borrowing-and-references) 约束：上面 `first_word` 返回的 `w` 持有对 `s` 的不可变借用，所以 `s.clear()`（需要可变借用）在 `w` 存活期间编译失败。这个「first_word 之后不能改字符串」的经典例子，正是所有权模型防止「迭代器失效」类 bug 的体现。

## 注意事项与常见坑

- **切片边界是运行时检查**：`&s[..i]` 中 `i` 越界会 panic（`byte index out of bounds`），编译期无法阻止；用 `get` 方法可返回 `Option`。
- **字符串切片必须落在 UTF-8 字符边界上**：对多字节字符（如中文）切到字符中间会 panic。
- **`&str` 不拥有数据**：它的生命周期不能超过被引用数据，跨函数返回局部 `String` 的切片会编译失败（见 [生命周期](./lifetimes)）。

## 参考资料

- 官方文档：《The Rust Programming Language》第 4 章 · The Slice Type：<https://doc.rust-lang.org/book/ch04-03-slices.html>

## 相关页面

- [所有权与移动语义](./ownership-and-move)——切片不转移所有权，只借用。
- [借用与引用](./borrowing-and-references)——切片受同样规则约束。
- [生命周期](./lifetimes)——切片作为返回值时的标注。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
