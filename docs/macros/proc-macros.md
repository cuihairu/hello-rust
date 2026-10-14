# 过程宏

**过程宏**（procedural macro）是编译期运行的普通 Rust 函数：输入一段 `TokenStream`，输出另一段 `TokenStream`。与 `macro_rules!` 的「模式匹配 + 模板替换」不同，它拿到完整的词法 token 序列，可以调用任意 Rust 代码——代价是更高的编译期开销与更难调试。

## 三种形态

| 形态 | 属性 | 调用语法 | 函数签名 |
|---|---|---|---|
| 函数式 | `#[proc_macro]` | `my_vec!(...)` | `fn(TokenStream) -> TokenStream` |
| 派生 | `#[proc_macro_derive]` | `#[derive(Builder)]` | `fn(TokenStream) -> TokenStream` |
| 属性 | `#[proc_macro_attribute]` | `#[log_call]` | `fn(TokenStream, TokenStream) -> TokenStream` |

三者都必须定义在 `crate-type = "proc-macro"` 的 crate 根模块（不能与普通 crate 共用源文件），函数须 `pub`。属性宏的第一个 `TokenStream` 是属性参数，第二个是 item 本体，输出替换整个 item。

下面是真实可运行的例子。proc-macro crate（`pm-derive/src/lib.rs`）：

```rust
use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, Data, DeriveInput, Fields};

#[proc_macro_derive(Builder)]
pub fn derive_builder(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    let name = &input.ident;
    let builder_name = syn::Ident::new(&format!("{}Builder", name), name.span());
    let fields = match &input.data {
        Data::Struct(s) => match &s.fields {
            Fields::Named(named) => &named.named,
            _ => return syn::Error::new_spanned(&input.ident, "Builder 只支持命名字段结构体")
                .to_compile_error().into(),
        },
        _ => return syn::Error::new_spanned(&input.ident, "Builder 只支持结构体")
            .to_compile_error().into(),
    };
    let mut slots = Vec::new();
    let mut inits = Vec::new();
    let mut setters = Vec::new();
    let mut builds = Vec::new();
    for f in fields {
        let id = f.ident.as_ref().unwrap(); let ty = &f.ty;
        slots.push(quote! { #id: ::core::option::Option<#ty> });
        inits.push(quote! { #id: ::core::option::Option::None });
        setters.push(quote! { pub fn #id(&mut self, v: #ty) -> &mut Self {
            self.#id = ::core::option::Option::Some(v); self } });
        builds.push(quote! { #id: self.#id.take().unwrap_or_default() });
    }
    quote! {
        pub struct #builder_name { #(#slots,)* }
        impl #name {
            pub fn builder() -> #builder_name { #builder_name { #(#inits,)* } }
        }
        impl #builder_name {
            #(#setters)*
            pub fn build(&mut self) -> #name { #name { #(#builds,)* } }
        }
    }.into()
}

/// 函数式宏：my_vec![1, 2, 3] —— 直接过滤 TokenStream（丢弃逗号）。
#[proc_macro]
pub fn my_vec(input: TokenStream) -> TokenStream {
    let input2: proc_macro2::TokenStream = input.into();
    let elems: Vec<_> = input2
        .into_iter()
        .filter(|t| !matches!(t, proc_macro2::TokenTree::Punct(p) if p.as_char() == ','))
        .map(proc_macro2::TokenStream::from)
        .collect();
    quote! { ::std::vec![#(#elems),*] }.into()
}
```

`Cargo.toml` 关键配置：`[lib] proc-macro = true`（硬要求），依赖 `syn = { version = "3", features = ["full"] }`、`quote`、`proc-macro2`。使用方 crate（`pm-test/src/main.rs`）：

```rust
use pm_derive::{Builder, my_vec};

#[derive(Builder)]
struct Config { host: String, port: u16, timeout_ms: u64 }

fn main() {
    let mut b = Config::builder();
    b.host("127.0.0.1".to_string()).port(8080).timeout_ms(3000);
    let cfg = b.build();
    println!("cfg = {:?}, {:?}, {}", cfg.host, cfg.port, cfg.timeout_ms);

    let mut b2 = Config::builder();
    b2.host("example.com".to_string());
    let cfg2 = b2.build();
    println!("cfg2 = {:?}, {:?}, {}", cfg2.host, cfg2.port, cfg2.timeout_ms);

    let v = my_vec![10, 20, 30];
    println!("my_vec = {:?}", v);
}
```

真实运行输出（`cargo run`）：

```text
cfg = "127.0.0.1", 8080, 3000
cfg2 = "example.com", 0, 0
my_vec = [10, 20, 30]
```

`cfg2` 未设置的字段走 `Default`——`derive(Builder)` 为每个字段生成 `Option<T>` 槽位与 `build()` 里的 `unwrap_or_default()`。

## TokenStream、Span 与工具链

`TokenStream` 大致等价于 `Vec<TokenTree>`（`Ident`/`Punct`/`Literal`/`Group`），`my_vec!` 就是对 token 序列做过滤的直接示范；每个 token 关联一个 `Span`（源码位置），**主要用于错误报告**。配套工具链的分工：

| crate | 职责 |
|---|---|
| `proc_macro` / `proc-macro2` | 编译器内置的原始类型 / 其封装（可在普通 crate 与单元测试中使用） |
| `syn` | 把 `TokenStream` 解析成 Rust AST（`DeriveInput`、`ItemFn`、`Expr`…） |
| `quote` | 准引号：从 Rust 代码片段生成 `TokenStream` |

实测中踩到的真实限制：

- **`syn::ItemFn` 需要 `full` feature**：只写 `syn = "3"` 会报 `found an item that was configured out`；
- **`proc_macro::TokenTree` 与 `proc_macro2::TokenTree` 是两个类型**：混用报类型不匹配，在宏边界 `let input2: proc_macro2::TokenStream = input.into();` 后统一用 proc-macro2；
- **`quote!` 会消费传入的迭代器**：`map` 出来的惰性迭代器复用会报 `value used here after move`，先 `.collect::<Vec<_>>()`。

## 卫生性：call_site vs mixed_site

过程宏输出默认**不卫生**——生成 token 就像内联写在调用方代码里。`Span::call_site()` 让标识符在调用点解析、调用方可见；`Span::mixed_site()` 则在宏定义点解析（与 `macro_rules` 一致），调用方不可见：

```rust
/// 生成 `let <name> = 42;`，name 用 call_site span（调用方可见）。
#[proc_macro]
pub fn make_ident(input: TokenStream) -> TokenStream {
    let name = input.into_iter().next().unwrap().to_string();
    let ident = proc_macro2::Ident::new(&name, proc_macro2::Span::call_site());
    quote! { let #ident = 42; }.into()
}
// 把 call_site 换成 mixed_site，即得 make_ident_hygienic（同签名）。
```

使用方（`make_ident!` 生成的 `x` 可见，`make_ident_hygienic!` 生成的 `y` 不可见）：

```rust
fn main() {
    make_ident!(x);
    println!("x = {}", x);
    make_ident_hygienic!(y);
    println!("mixed_site 生成的 y 不可见（编译期被拒绝）");
}
```

真实运行输出：

```text
x = 42
mixed_site 生成的 y 不可见（编译期被拒绝）
```

把第二处 println 换成 `println!("y = {}", y)` 后的真实报错（节选）：

```text
error[E0425]: cannot find value `y` in this scope
 --> src/main.rs:7:24
  |
7 |     println!("y = {}", y);
  |                        ^
  |
help: an identifier with the same name is defined here, but is not accessible due to macro hygiene
```

编译器甚至能提示「有同名标识符但被宏卫生性挡住」。

## 编译期开销与错误诊断

**开销实测**（本机，500 个两字段结构体，`touch src/main.rs` 后增量 `cargo build`，各 3 次）：

```text
500 个 derive(Builder)  ：0.79 s / 0.74 s / 0.71 s
500 个手写 Builder impl ：0.78 s / 0.70 s / 0.73 s
```

在 500 个结构体规模下，过程宏的**执行**开销与手写代码相当；真正的成本在 proc-macro crate 自身变更后的重编（含宏编译与展开，实测约 4.5 s）以及依赖变更触发的连锁重编。

**错误诊断**：过程宏默认失败模式 `panic!` 只会指向 `#[derive(...)]` 那一行，几乎无法定位。正确做法是 `syn::Error::new_spanned` 把错误定位到具体 token，再 `to_compile_error()` 转成 `TokenStream` 返回——写法见上面 derive 实现的两个 `return` 分支。调试展开可用 `cargo rustc -- -Zunpretty=expanded`（需 nightly）。对 enum 应用 `#[derive(Builder)]` 的真实报错——错误精确指向 `Color` 标识符而非整个 derive 输入：

```text
error: Builder 只支持结构体
 --> src/main.rs:4:6
  |
4 | enum Color { Red, Green }
  |      ^^^^^
```

## derive 的适用边界

`derive` 的甜区是**对每个字段做同一件事**：`Clone`、`Debug`、`Eq`、`Hash`、本例的 `Builder` 都是逐字段生成代码。一旦逻辑涉及字段之间的关系（`f64` 的 `Eq` 因 NaN 无效、跨字段一致性校验），derive 的表达力就不够，手写 `impl` 更清晰。另一条边界是孤儿规则：derive 宏由 crate 提供、作用于本地类型，不受孤儿规则限制。

## 参考资料

- 官方文档：《The Rust Reference》· Procedural macros：<https://doc.rust-lang.org/reference/procedural-macros.html>

## 相关页面

- [声明式宏 `macro_rules!`](./declarative-macros)——匹配器与卫生性的对照面。
