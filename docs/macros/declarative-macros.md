# 声明式宏 `macro_rules!`

**声明式宏**（declarative macro）用 `macro_rules!` 定义，本质是「模式匹配 + 模板替换」：编译器把宏调用处的 token 序列逐条与规则匹配，命中后按模板生成代码。它不操作 AST，只操作 token，因此能表达任意「语法形状」的代码生成。

## 匹配器语法：`$name:fragment`

匹配器由字面 token、元变量 `$name:fragment` 和重复 `$(...)` 组成。`fragment` 指定元变量匹配哪一类 Rust 语法片段，常见的有：

| fragment | 含义 |
|---|---|
| `ident` | 标识符或关键字 |
| `expr` | 表达式 |
| `ty` | 类型 |
| `pat` | 模式（2021 起含顶层 or 模式） |
| `stmt` | 语句（**不含**末尾分号，写成 `let y = 3;` 会报 `no rules expected ';'`） |
| `block` | 块表达式 |
| `literal` | 字面量 |
| `meta` | 属性内容 |
| `tt` | 单个 TokenTree |

用一组单臂宏实证每种 fragment 的匹配行为（rustc 1.99.0，`--edition 2021`）：

```rust
macro_rules! f_ident { ($i:ident) => { println!("ident = {}", stringify!($i)); }; }
macro_rules! f_ty    { ($t:ty)    => { println!("ty    = {}", stringify!($t)); }; }
macro_rules! f_pat   { ($p:pat)   => { println!("pat   = {}", stringify!($p)); }; }
macro_rules! f_stmt  { ($s:stmt)  => { println!("stmt  = {}", stringify!($s)); }; }
macro_rules! f_block { ($b:block) => { println!("block = {}", stringify!($b)); }; }
fn main() {
    f_ident!(x);
    f_ty!(i32);
    f_pat!(Some(1));
    f_stmt!(let y = 3);
    f_block!({ let a = 1; a + 1 });
}
```

真实运行输出：

```text
ident = x
ty    = i32
pat   = Some(1)
stmt  = let y = 3
block = { let a = 1; a + 1 }
```

### 臂顺序与「硬解析错误」

多臂宏按顺序尝试，**第一个成功匹配的臂胜出**。但关键细节是：如果某个臂在解析元变量时遇到**语法错误**（而非「不匹配」），编译器会直接中止整个宏调用，不再尝试后续臂。例如把 `ty` 臂放在 `pat` 臂之前，调用 `demo!(Some(1))` 会得到：

```text
error: expected type, found `1`
 --> demo_order.rs:5:24
  |
2 |     ($t:ty)  => { println!("ty  = {}", stringify!($t)); };
  |      ----- while parsing argument for this `ty` macro fragment
...
5 | fn main() { demo!(Some(1)); }
  |                        ^ expected type
```

`Some(1)` 不是合法类型，`ty` 臂解析失败产生硬错误，`pat` 臂根本没机会尝试。**结论：把容易解析失败的 fragment 放在后面，或干脆用单臂宏。** 另外 `expr` 是最宽松的 fragment，几乎能吞掉任何表达式 token——多臂宏里若 `expr` 臂在前，后面的 `ty`/`meta`/`block` 臂永远轮不到，实测 `demo!(i32)`、`demo!(42)`、`demo!(derive(Debug))` 全部被 `expr` 臂截获。

## 重复：`$(...)`、分隔符与 `*` `+` `?`

`$(...)` 把一段匹配器标记为可重复，后面跟一个重复标记：`*`（任意次，含零次）、`+`（至少一次）、`?`（零次或一次，**不能带分隔符**）。分隔符可以是除定界符和 `*`/`+`/`?` 外的任意 token，最常用 `,` 和 `;`；嵌套重复是允许的。

```rust
macro_rules! vec3 {
    ($($x:expr),+) => {{
        let v: Vec<i32> = vec![$($x),+];
        println!("$(...),+ => {:?} (len={})", v, v.len());
        v
    }};
    ($($x:expr),* $(,)?) => {{
        let items: Vec<i32> = vec![$($x),*];
        println!("$(...)*  => {:?} (len={})", items, items.len());
        items
    }};
}
fn main() {
    let a = vec3!(1, 2, 3);
    let b = vec3!(42);
    let _ = (a, b);
    let c = vec3!(7, 8, 9,);
    let d = vec3!();
    let _ = (c, d);
}
```

真实运行输出：

```text
$(...),+ => [1, 2, 3] (len=3)
$(...),+ => [42] (len=1)
$(...)*  => [7, 8, 9] (len=3)
$(...)*  => [] (len=0)
```

几个真实踩到的限制：**裸 `,?` 非法**——`?` 只能修饰 `$(...)` 重复组，「可选逗号」要写 `$(,)?`；**`expr` 后只能跟 `=>`、`,` 或 `;`**——`($x:expr $(,)? $y:expr)` 会报 `` `$x:expr` may be followed by `$y:expr`, which is not allowed for `expr` fragments ``；**转写器里的重复必须与匹配器一致**——元变量在转写器中出现的次数、种类、嵌套顺序必须与匹配器相同，否则编译错误。

## 卫生性与 `$crate`

`macro_rules!` 采用**混合站点卫生（mixed-site hygiene）**：宏展开中引入的**局部变量**和**标签**在宏定义点解析，其他符号（函数名、类型名等）在调用点解析。这意味着宏内部引入的 `tmp` 等名字不会与调用方的同名变量冲突。

```rust
macro_rules! swap {
    ($a:ident, $b:ident) => {{
        let tmp = $a;   // 这个 tmp 有独立的语法上下文
        $a = $b;
        $b = tmp;
    }};
}
macro_rules! use_helper {
    ($x:expr) => { $crate::helper::double($x) };
}
mod helper {
    pub fn double(x: i32) -> i32 { x * 2 }
}
fn main() {
    let mut a = 1; let mut b = 2; let tmp = 100;
    swap!(a, b);
    println!("a={} b={} tmp={}", a, b, tmp);
    println!("use_helper!(5) = {}", use_helper!(5));
}
```

真实运行输出：

```text
a=2 b=1 tmp=100
use_helper!(5) = 10
```

`swap!` 内部的 `tmp` 与调用方的 `tmp = 100` 同名但互不影响——这就是卫生性的直接体现。`$crate` 是特殊元变量，始终指向**定义宏的那个 crate**，用于在展开代码中引用定义 crate 内部的项。注意 `$crate` 只影响名字解析，**不影响可见性**——被引用的项仍须从调用点可见。

## 实战：`query!` DSL 宏

把类 SQL 的 DSL 编译成 `Query` 结构体，是声明式宏的典型用法。这个宏综合运用了 `ident` 片段（列名、表名）、`$(...),+` 重复（多列、多条件）、`stringify!` 把标识符转成字符串字面量、以及两个臂的顺序匹配（无 WHERE 的臂在前）：

```rust
#![allow(dead_code)]
#[derive(Debug)]
struct Query { table: &'static str, columns: Vec<&'static str>, filters: Vec<String> }
macro_rules! query {
    (SELECT $($col:ident),+ FROM $table:ident) => {{
        let mut q = Query { table: stringify!($table), columns: vec![], filters: vec![] };
        q.columns = vec![$(stringify!($col)),+];
        q
    }};
    (SELECT $($col:ident),+ FROM $table:ident WHERE $($field:ident = $val:expr),+) => {{
        let mut q = Query { table: stringify!($table), columns: vec![], filters: vec![] };
        q.columns = vec![$(stringify!($col)),+];
        q.filters = vec![$(format!("{} = {}", stringify!($field), $val)),+];
        q
    }};
}
fn main() {
    let q1 = query!(SELECT id, name FROM users);
    println!("q1 = {:?}", q1);
    let q2 = query!(SELECT id, name, age FROM users WHERE age = 18);
    println!("q2 = {:?}", q2);
    let q3 = query!(SELECT id FROM orders WHERE user_id = 42, status = "paid");
    println!("q3 = {:?}", q3);
}
```

真实运行输出：

```text
q1 = Query { table: "users", columns: ["id", "name"], filters: [] }
q2 = Query { table: "users", columns: ["id", "name", "age"], filters: ["age = 18"] }
q3 = Query { table: "orders", columns: ["id"], filters: ["user_id = 42", "status = paid"] }
```

## 宏展开效果

用 nightly 的 `rustc -Zunpretty=expanded` 可以看到真实展开（`cargo expand` 是等价工具，需 `cargo install cargo-expand`）。注意 `expr` 片段在展开时会被**加上括号**——`$x * $x` 中的 `$x` 替换为 `3 + 4` 时变成 `(3 + 4) * (3 + 4)`，避免运算符优先级错误：

```rust
macro_rules! sq { ($x:expr) => { $x * $x }; }
fn main() { let n = sq!(3 + 4); }
```

真实运行输出（`rustc +nightly --edition 2021 -Zunpretty=expanded`）：

```text
fn main() {
    let n = (3 + 4) * (3 + 4);
    { ::std::io::_print(format_args!("{0}\n", n)); };
}
```

## 参考资料

- 官方文档：《The Rust Reference》· Macros by example：<https://doc.rust-lang.org/reference/macros-by-example.html>

## 相关页面

- [trait 与实现](../language-core/traits)——`derive` 是宏生成 `impl` 的特例。
- [知识点整理](../knowledge)——全站复习主线。
