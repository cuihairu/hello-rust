# Generic Bounds and where Clauses

**Generic bounds (trait bounds)** tell the compiler "what this type parameter must be able to do." Without bounds, the compiler cannot know what methods can be called on `T`; with bounds, generics can be safely instantiated at compile time. This page covers multiple bounds, `where` clauses, and how bounds let you write **conditional implementations**.

## Multiple bounds with `+`

Chain multiple traits with `+`; the type parameter must **simultaneously** satisfy all of them:

```rust
use std::fmt::Display;

// + 分隔多个约束：既要能打印、又要能比较
fn max_and_show<T: PartialOrd + Display>(a: T, b: T) {
    if a > b {
        println!("max = {a}");
    } else {
        println!("max = {b}");
    }
}

fn main() {
    max_and_show(3, 9);
    max_and_show("apple", "banana");
    max_and_show(2.5, 2.5);
}
```

Actual run output:

```text
max = 9
max = banana
max = 2.5
```

When a bound is missing, the compiler points directly at "this operation cannot be done on `T`" and suggests the bound to add.

## `where` clauses: moving bounds out of the parameter list

With many bounds, a signature written inside the angle brackets becomes unreadable. The `where` clause splits the **parameter list** and the **bounds** into two sections:

```rust
use std::fmt::Debug;

fn dump_pair<T, U>(t: T, u: U) -> String
where
    T: Clone + Debug + PartialEq,
    U: Into<String> + Ord,
{
    let again = t.clone();          // 需要 Clone
    let same = t == again;          // 需要 PartialEq
    let text: String = u.into();    // 需要 Into<String>
    format!("{t:?} cloned={same} {text}") // 需要 Debug
}

fn main() {
    println!("{}", dump_pair((1, 2), "hi"));
}
```

Actual run output:

```text
(1, 2) cloned=true hi
```

`where` is not just a formatting tool — it can also express bounds that cannot be written inside the angle brackets, such as a bound on a type's **associated type**:

```rust
use std::fmt::Display;

fn print_all<I>(iter: I)
where
    I: Iterator,
    I::Item: Display,
{
    for x in iter {
        print!("{x} ");
    }
    println!();
}

fn main() {
    print_all(vec![1, 2, 3].into_iter());
    print_all(["a", "b"].into_iter());
}
```

Actual run output:

```text
1 2 3 
a b 
```

`I::Item: Display` means "whatever this iterator yields, the yielded value must be printable." `where` can also bound `Self` itself — the standard library's `Iterator::collect` carries `where Self: Sized`, meaning "types that are not `Sized` do not have this method."

## Conditional implementations

Bounds can also be placed on an `impl`: **this implementation only exists when `T` satisfies the condition**. This is how `Option<T>` automatically acquires `Describe`:

```rust
trait Describe {
    fn describe(&self) -> String;
}

struct Point { x: i32, y: i32 }

impl Describe for Point {
    fn describe(&self) -> String { format!("Point({}, {})", self.x, self.y) }
}

// 条件实现：Option<T> 只在 T: Describe 时才有 describe 方法
impl<T: Describe> Describe for Option<T> {
    fn describe(&self) -> String {
        match self {
            Some(v) => format!("Some({})", v.describe()),
            None => String::from("None"),
        }
    }
}

fn main() {
    let some: Option<Point> = Some(Point { x: 1, y: 2 });
    let none: Option<Point> = None;
    println!("{}", some.describe());
    println!("{}", none.describe());
}
```

Actual run output:

```text
Some(Point(1, 2))
None
```

The standard library works exactly this way: `Vec<T>: Clone`, `Option<T>: Debug` are all conditional implementations, so as long as the elements are cloneable, the container is cloneable. This also explains why `#[derive(Eq)]` fails on structs containing `f64` fields — when the condition is not satisfied, the implementation simply does not exist (see [Traits and implementations](../language-core/traits)).

## The real error when a bound is missing

```rust
struct NotComparable {
    name: String,
}

fn max_of<T>(a: T, b: T) -> T {
    if a > b { a } else { b }
}

fn main() {
    let x = NotComparable { name: String::from("x") };
    let y = NotComparable { name: String::from("y") };
    println!("{}", max_of(x, y).name);
}
```

Actual run output:

```text
error[E0369]: binary operation `>` cannot be applied to type `T`
 --> missing_bound.rs:6:10
  |
6 |     if a > b { a } else { b }
  |        - ^ - T
  |        |
  |        T
  |
help: consider restricting type parameter `T` with trait `PartialOrd`
  |
5 | fn max_of<T: std::cmp::PartialOrd>(a: T, b: T) -> T {
  |            ++++++++++++++++++++++

error: aborting due to 1 previous error

For more information about this error, try `rustc --explain E0369`.
```

The error occurs at **compile time**: a missing bound is not a runtime crash but rather a failure to compile at all. This is precisely the point of generic bounds — writing "the conditions a type must satisfy" as a contract.

## References

- Official docs: "The Rust Programming Language" Chapter 10 · Defining Shared Behavior with Traits: <https://doc.rust-lang.org/book/ch10-02-traits.html>

## Related pages

- [Traits and implementations](../language-core/traits) — what the things connected by `+` in a bound are.
- [Generics and monomorphization](../language-core/generics-and-monomorphization) — how bounds drive monomorphization.
- [Associated types](./associated-types) — the full story of associated types in `where I::Item: Display`.
- [`impl Trait`](./impl-trait) — another syntax for writing bounds.
