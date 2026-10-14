---
layout: home

hero:
  name: Hello Rust
  text: Rust 知识手册
  tagline: 从所有权、借用与生命周期，到 trait、泛型、错误处理，再到内存与并发、异步、宏、工具链与生态工程，系统掌握 Rust。
  image:
    src: /logo.svg
    alt: hello-rust logo
  actions:
    - theme: brand
      text: 开始阅读
      link: /language-core/
    - theme: alt
      text: 知识点整理
      link: /knowledge
    - theme: alt
      text: 术语表
      link: /glossary
    - theme: alt
      text: GitHub
      link: https://github.com/cuihairu/hello-rust

features:
  - title: 语言核心
    details: 所有权与移动语义、借用与引用、切片、生命周期、枚举与模式匹配、trait、泛型与单态化、错误处理。
  - title: 类型系统与抽象
    details: trait 对象与动态分发、泛型约束、associated types、零成本抽象、孤儿规则、impl Trait、闭包与 Fn 家族。
  - title: 内存与并发
    details: Drop 与析构、智能指针、内部可变性、自定义分配器、Send 与 Sync、无畏并发、交叉编译。
  - title: 异步与宏
    details: async/await 与 Future、Pin、tokio 生态、select 与取消；声明式宏与过程宏。
  - title: 工具链与生态
    details: cargo、rustfmt、clippy、rust-analyzer、MSRV 策略；workspace、发布 crates、FFI、嵌入式、wasm。
  - title: 跨语言对照
    details: 与 C/C++、Go、Java 在内存安全、错误处理、并发模型、构建系统上的逐项差异表。
  - title: 术语表
    details: 六十条核心术语的中英对照、一句话定义与实测可点的官方出处，按八个部分分组。
---
