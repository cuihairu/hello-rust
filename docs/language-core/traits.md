# trait 与实现

**trait** 定义一组方法签名，任何类型都可以 `impl` 实现它。它是 Rust 的抽象单位——用同一套接口处理不同类型的值，且（配合泛型）通常是**零成本**的。这一页讲 trait 的定义、默认实现、`impl Trait` 参数，以及常用标准库 trait。

## 定义与实现

```rust
trait Summary {
    fn summarize(&self) -> String;        // 必须实现
    fn topic(&self) -> String {           // 带默认实现：可不覆盖
        String::from("(默认主题)")
    }
}

struct Article {
    title: String,
    body: String,
}

impl Summary for Article {
    fn summarize(&self) -> String {
        format!("{}: {}", self.title, self.body)
    }
}

fn notify(item: &impl Summary) {
    println!("{} | {}", item.topic(), item.summarize());
}

fn main() {
    let a = Article {
        title: String::from("Rust 所有权"),
        body: String::from("每个值有唯一 owner"),
    };
    notify(&a);
}
```

真实运行输出：

```text
(默认主题) | Rust 所有权: 每个值有唯一 owner
```

三个要点：

- `trait` 里没写函数体的方法是**必须实现**的，写了函数体的方法可以用默认实现；
- `impl Summary for Article` 与 `impl Article`（固有方法）是两种不同的 impl 块；
- `fn notify(item: &impl Summary)` 是**语法糖**，等价于 `fn notify<S: Summary>(item: &S)`（见 [泛型与单态化](./generics-and-monomorphization)）。

## 常用标准库 trait

标准库的 trait 大多是「按位拷贝、默认构造、比较、打印」这类横切需求，很多可以直接 `derive`：

```rust
#[derive(Debug, Clone, Copy, Default, PartialEq)]
struct Point { x: i32, y: i32 }

fn main() {
    let p = Point { x: 1, y: 2 };
    let q = p;                 // Copy：p 仍可用
    let r = p.clone();         // Clone：显式深拷贝
    let d = Point::default();  // Default
    println!("{p:?} {q:?} {r:?} {d:?}");
    println!("p == q: {}", p == q);
}
```

真实运行输出：

```text
Point { x: 1, y: 2 } Point { x: 1, y: 2 } Point { x: 1, y: 2 } Point { x: 0, y: 0 }
p == q: true
```

常用的几个：

| trait | 用途 | derive 支持 |
|---|---|---|
| `Debug` | `{:?}` 打印 | 是 |
| `Clone` / `Copy` | 深拷贝 / 按位拷贝 | 是（`Copy` 需同时 `Clone`） |
| `Default` | `Default::default()` | 是 |
| `PartialEq` / `Eq` | `==` 比较 | 是 |
| `PartialOrd` / `Ord` | 排序 | 是（`Ord` 需同时 `PartialOrd`、`Eq`） |
| `Display` | `{}` 面向用户的打印 | 否，需手写 |
| `Drop` | 析构钩子 | 否，需手写 |

## 注意事项与常见坑

- **trait 方法接收者是 `&self`、`&mut self` 还是 `self`** 决定了它是借用还是消费——`Deref`、`Drop` 这类 trait 固定为 `&mut self`，这是有意设计。
- **`derive` 只处理「按字段逐一」的逻辑**：`#[derive(Eq)]` 对 `f64` 会编译失败（`f64` 不实现 `Eq`，因为 NaN），需要手写 `impl`。
- **孤儿规则限制跨类型实现**：不能为「外部 trait + 外部类型」实现 impl（如 `impl std::fmt::Display for Vec<foo::Bar>`），详见第 2 部分孤儿规则。

## 参考资料

- 官方文档：《The Rust Programming Language》第 10 章 · Defining Shared Behavior with Traits：<https://doc.rust-lang.org/book/ch10-02-traits.html>

## 相关页面

- [泛型与单态化](./generics-and-monomorphization)——`impl Trait` 的展开形式。
- [枚举与模式匹配](./enums-and-pattern-matching)——`derive` 为枚举生成 trait 实现。
- [错误处理](./error-handling)——`Error` trait 与 `Box<dyn Error>`。
