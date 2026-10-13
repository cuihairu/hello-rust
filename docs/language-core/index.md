# 第1部分：语言核心

所有权、借用、生命周期、trait、泛型、枚举与模式匹配、错误处理——Rust 区别于其他语言的核心机制，也是读懂一切 Rust 代码的地基。

- [所有权与移动语义](ownership-and-move.md) —— 三规则、栈/堆与 move、Copy 类型。
- [借用与引用](borrowing-and-references.md) —— 共享/可变引用、借用规则、NLL。
- [切片与 &str](slices-and-str.md) —— `&[T]`、字符串切片、deref coercion。
- [生命周期](lifetimes.md) —— `'a` 标注、省略规则、`'static`。
- [枚举与模式匹配](enums-and-pattern-matching.md) —— enum 携带数据、Option、match 穷尽性。
- [trait 与实现](traits.md) —— trait 定义、默认方法、trait bound 入门。
- [泛型与单态化](generics-and-monomorphization.md) —— 泛型函数/结构体、单态化。
- [错误处理](error-handling.md) —— Option 与 Result、`?` 运算符、panic 边界。

---

- [类型系统](../type-system/) —— trait 对象、associated types、零成本抽象。
- [知识点整理](../knowledge) —— 全站复习主线。
