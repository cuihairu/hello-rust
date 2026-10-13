# 错误处理

Rust 把错误分成两类：**可恢复错误**用 `Result<T, E>` 在类型里显式表达，**不可恢复错误**用 `panic!` 终止。没有异常、没有 `null`——错误处理是函数签名的一部分，调用方无法假装看不见。

## Option 与 Result

- `Option<T>`：表达「有值 / 无值」，用于「查不到」这类正常业务分支；
- `Result<T, E>`：表达「成功 / 失败」，`E` 是错误类型，用于「可能失败」的操作。

```rust
use std::error::Error;

fn parse_pair(s: &str) -> Result<(i32, i32), Box<dyn Error>> {
    let (a, b) = s.split_once(',').ok_or("missing comma")?;
    let x: i32 = a.trim().parse()?;
    let y: i32 = b.trim().parse()?;
    Ok((x, y))
}

fn main() {
    for input in ["3,4", "3,x", "3 4"] {
        match parse_pair(input) {
            Ok((x, y)) => println!("{input:?} => ok: {x} + {y} = {}", x + y),
            Err(e) => println!("{input:?} => err: {e}"),
        }
    }
}
```

真实运行输出：

```text
"3,4" => ok: 3 + 4 = 7
"3,x" => err: invalid digit found in string
"3 4" => err: missing comma
```

## ? 运算符：错误向上传播

`?` 是错误处理的灵魂：表达式成功则取出 `Ok` 内的值，失败则**立即 return**，把错误交给调用方。它要求函数返回 `Result` 或 `Option`：

```rust
fn f() -> Result<i32, String> {
    let x: Result<i32, String> = Ok(1)?;
    let y: Result<i32, String> = f()?;
    println!("{x} {y}");
}
```

在返回 `()` 的 `main` 里用 `?` 会编译失败（rustc 1.99.0 实测）：

```text
error[E0277]: the `?` operator can only be used in a function that returns `Result` or `Option`
```

`?` 还能自动做错误类型转换：若函数返回 `Box<dyn Error>`，`?` 可以把 `ParseIntError`、`String` 等不同错误类型统一装进 `Box<dyn Error>`——这就是上面 `parse_pair` 能混用 `ok_or("missing comma")`（`&str` 错误）和 `.parse()?`（`ParseIntError`）的原因。

## panic 的使用边界

`panic!` 用于**不可恢复**的错误：程序继续运行会违反不变量（如数组越界、除零）。默认行为是展开栈、终止当前线程。

```rust
fn main() {
    let v: Option<i32> = None;
    let x: i32 = v.expect("除数为零时本不该走这里");
    println!("{x}");
}
```

真实运行输出：

```text
thread 'main' (3949320) panicked at p8_panic.rs:3:20:
除数为零时本不该走这里
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

`expect` 与 `unwrap` 的区别仅在 panic 消息：`expect` 让你写明「为什么这里不该失败」，排查时信息量大得多。

## 工程实践：错误类型怎么选

- **库代码**：定义自己的错误类型（实现 `std::error::Error`），或直接用 `Box<dyn Error>` 起步；
- **应用代码**：`anyhow::Result` 是事实标准，`?` 直接传播任意错误；
- **不要 `panic!` 处理用户输入错误**：输入错误是可恢复的，走 `Result`；
- **`main` 可以返回 `Result`**：`fn main() -> Result<(), Box<dyn Error>>` 让 `?` 在顶层可用，失败时打印 `Debug` 并以非零码退出。

## 注意事项与常见坑

- **`?` 不是异常**：它不会跳过中间栈帧的清理，只是语法糖版的 `match + return`；
- **错误类型不匹配时 `?` 编译失败**：如 `Result<_, ParseIntError>` 里 `?` 一个 `String` 错误会报 E0277，需要 `map_err` 或统一成 `Box<dyn Error>`；
- **`unwrap` 在测试里可以，在生产里要克制**：测试失败需要明确 panic，生产代码优先 `match` / `unwrap_or` / `expect`。

## 相关页面

- [枚举与模式匹配](./enums-and-pattern-matching)——`Option` 与 `Result` 都是枚举。
- [trait 与实现](./traits)——`Error` trait 与 `From` 转换。
- [所有权与移动语义](./ownership-and-move)——错误值本身也遵循 move 规则。

官方文档：<https://doc.rust-lang.org/book/ch09-00-error-handling.html>
