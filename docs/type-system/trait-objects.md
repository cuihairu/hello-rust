# Trait Objects and Dynamic Dispatch

**Trait objects** (`dyn Trait`) let values of "the same interface, different types" live in the same container and flow through the same code path. In contrast to generics' **static dispatch** (compile-time monomorphization), trait objects are **dynamic dispatch** — calls are resolved at runtime by looking up a vtable. This page covers the usage of `dyn Trait`, the object-safety conditions, the memory layout of the vtable, and the trade-offs against generics.

## Basic usage

`dyn Trait` is a **dynamically sized type** and cannot be used by value; it must go behind a pointer: `&dyn Trait`, `Box<dyn Trait>`, `Rc<dyn Trait>`, and so on.

```rust
trait Shape {
    fn area(&self) -> f64;
    fn name(&self) -> &str;
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r }
    fn name(&self) -> &str { "circle" }
}

impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }
    fn name(&self) -> &str { "square" }
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { r: 1.0 }),
        Box::new(Square { side: 2.0 }),
    ];
    for s in &shapes {
        println!("{} area = {:.4}", s.name(), s.area());
    }
}
```

Actual run output:

```text
circle area = 3.1416
square area = 4.0000
```

- `Vec<Box<dyn Shape>>` is a **heterogeneous container**: different types (`Circle`, `Square`) are boxed onto the heap via `Box`, and the `Vec` stores a group of trait-object pointers;
- When you call `s.area()`, the compiler does **not know** the concrete type of `s` and can only look it up at runtime — that is dynamic dispatch.

## Object safety: not every trait can become `dyn`

For a trait to be usable as a trait object it must be **object safe** (formerly called object safety; the Rust Reference now calls it dyn compatibility). The most common violation is a **method with generic parameters** — the vtable needs one entry for each concrete type, but a generic method has infinitely many instantiations, so no table can be built:

```rust
trait Bad {
    fn make<T>(&self, x: T) -> T { x }
}

fn use_it(_b: &dyn Bad) {}

fn main() {}
```

Actual compile output (rustc 1.99.0):

```text
error[E0038]: the trait `Bad` is not dyn compatible
 --> p1_unsafe.rs:5:16
  |
5 | fn use_it(_b: &dyn Bad) {}
  |                ^^^^^^^ `Bad` is not dyn compatible
  |
note: for a trait to be dyn compatible it needs to allow building a vtable
      for more information, visit <https://doc.rust-lang.org/reference/items/traits.html#dyn-compatibility>
 --> p1_unsafe.rs:2:8
  |
1 | trait Bad {
  |       --- this trait is not dyn compatible...
2 |     fn make<T>(&self, x: T) -> T { x }
  |        ^^^^ ...because method `make` has generic type parameters
  = help: consider moving `make` to another trait
```

Another class of violation is a **method that returns `Self`** — the concrete type is only known at runtime, so at compile time the compiler doesn't know how large the return value is:

```rust
trait Bad {
    fn clone_it(&self) -> Self;
}
```

Actual compile output (rustc 1.99.0, triggered when writing `&dyn Bad`):

```text
error[E0038]: the trait `Bad` is not dyn compatible
2 |     fn clone_it(&self) -> Self;
  |                           ^^^^ ...because method `clone_it` references the `Self` type in its return type
```

The complete rules (Rust Reference): a trait cannot require `Self: Sized` and cannot have associated constants; methods cannot have generic type parameters, cannot use `Self` in their return type, and cannot return opaque types (`async fn`, `-> impl Trait`). Methods marked `where Self: Sized` are explicitly excluded from the vtable and can only be called through a concrete type. Note: defining a trait with generic methods does **not** produce an error — E0038 is only reported once you write `&dyn Bad`.

## vtable: the implementation of dynamic dispatch

`&dyn Trait` is a **fat pointer**: a pointer to the data plus a pointer to the vtable. The vtable holds the method pointers for that concrete type, along with `size`, `align`, and `drop_in_place`. Verified with `size_of` (rustc 1.99.0):

```rust
use std::mem::size_of_val;

trait Shape {
    fn area(&self) -> f64;
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle { fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r } }
impl Shape for Square { fn area(&self) -> f64 { self.side * self.side } }

fn main() {
    let c = Circle { r: 1.0 };
    let sq = Square { side: 2.0 };
    let dc: &dyn Shape = &c;
    let ds: &dyn Shape = &sq;
    println!("size_of_val(&Circle)   = {}", size_of_val(&c));
    println!("size_of_val(dyn Shape) = {}", size_of_val(dc));
    println!("size_of(&dyn Shape)    = {}", size_of_val(&dc));
    println!("area circle = {}, square = {}", dc.area(), ds.area());
}
```

Actual run output:

```text
size_of_val(&Circle)   = 8
size_of_val(dyn Shape) = 8
size_of(&dyn Shape)    = 16
area circle = 3.141592653589793, square = 4
```

`&Circle` is an 8-byte thin pointer; `&dyn Shape` is a 16-byte fat pointer — the extra 8 bytes are the vtable pointer. Splitting the fat pointer apart (with `unsafe` `transmute` into two raw pointers) shows that the vtable pointers for the two concrete types really are different:

```rust
let (pc, vc): (*const (), *const ()) = unsafe { transmute(dc) };
let (ps, vs): (*const (), *const ()) = unsafe { transmute(ds) };
println!("data ptr  equal: {}", pc == ps);
println!("vtable ptr equal: {}", vc == vs);
println!("vtable ptr circle = {vc:p}, square = {vs:p}");
```

Actual run output:

```text
data ptr  equal: false
vtable ptr equal: false
vtable ptr circle = 0x5590f64f3808, square = 0x5590f64f3828
```

The two vtable pointers differ by 0x20 (32 bytes) — each vtable entry is an 8-byte pointer, and the two vtables are laid out adjacently in memory. When `dc.area()` is called, the CPU fetches the address of `Circle::area` from the vtable and jumps there — the entire cost of dynamic dispatch is that single indirection.

## The trade-off against generic static dispatch

Generics are **static dispatch**: the compiler generates a dedicated copy of the code for each concrete type, which is called directly at runtime with no table lookup. The cost is **code size** — one copy per instantiated type. Verified against the symbol table with `nm` (rustc 1.99.0, `-C opt-level=0`): after a single `fn show<T: Debug>(x: T)` is called with 7 types, 7 distinct symbols appear in the symbol table (3 shown):

```text
0000000000016080 t _RINvCseNfuMIpMiGP_10p1_generic4showcEB2_
0000000000016140 t _RINvCseNfuMIpMiGP_10p1_generic4showhEB2_
0000000000016010 t _RINvCseNfuMIpMiGP_10p1_generic4showReEB2_
```

Rewriting the same logic as `fn show_dyn(x: &dyn Debug)` leaves just one symbol in the table, and the binary is slightly smaller too:

```text
00000000000160a0 t _RNvCsbJWdSRWE0oY_9p1_dynver8show_dyn
-rwxr-xr-x 1 cui cui 4568424 ... p1_dynver0
-rwxr-xr-x 1 cui cui 4570120 ... p1_generic0
```

| Dimension | Generics (static dispatch) | `dyn Trait` (dynamic dispatch) |
|---|---|---|
| Performance | Direct call, inlinable | One indirect jump, usually not inlinable |
| Code size | One copy per type | One code copy + one vtable per type |
| Number of types | Known at compile time | Known only at runtime (plugins, UI component trees) |
| Typical use | Hot paths, a bounded set of types | Heterogeneous collections, type erasure, shorter compile times |

Rule of thumb: **default to generics**; switch to `dyn Trait` when the number of types is unbounded or compile time becomes the bottleneck. The two can be mixed — a generic function can use `dyn Trait` internally to keep the number of instantiations down.

## Notes and common pitfalls

- **`dyn Trait` is not `Sized`**: it cannot be passed by value or used as an array element; it must go behind a pointer such as `&`, `Box`, or `Rc`;
- **The default lifetime is `'static`**: `Box<dyn Trait>` is really `Box<dyn Trait + 'static>`; to borrow local data you have to write `Box<dyn Trait + 'a>`;
- **Object safety is reported at the use site**: defining a trait with generic methods does not error; E0038 only fires when you write `&dyn Bad`.

## References

- Official docs: "The Rust Reference" · Trait object types: <https://doc.rust-lang.org/reference/types/trait-object.html>

## Related pages

- [Generics and monomorphization](../language-core/generics-and-monomorphization) — the counterpart side of static dispatch.
- [Traits and implementations](../language-core/traits) — trait definitions and default methods.
- [impl Trait](./impl-trait) — another abstraction that "doesn't expose the concrete type."
- [Error handling](../language-core/error-handling) — `Box<dyn Error>` is a typical use of trait objects.
- [Glossary](../glossary) — the Chinese-English cross-reference and authoritative sources for the site's core terminology.
