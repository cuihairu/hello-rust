# Interior Mutability

The borrowing rules require "one mutable reference XOR many immutable references," and the compiler checks this statically. **Interior mutability** moves that check to runtime: a type appears immutable to the outside world (it can mutate through `&self`), while an internal `Cell`/`RefCell` enforces the rule on its own. The core takeaways: **borrowing rules shifted to runtime** and their panic semantics, plus **where this shows up in real code**.

## `Cell<T>`: whole-value swap for Copy types

`Cell` hands out no references — only `get`/`set` for whole-value read/write — which is why it fits `Copy` types. See how it lets an `&self` method mutate the count:

```rust
use std::cell::Cell;

struct Counter {
    count: Cell<u32>,
}

impl Counter {
    fn new() -> Self {
        Counter { count: Cell::new(0) }
    }
    // 注意是 &self 而不是 &mut self
    fn inc(&self) {
        self.count.set(self.count.get() + 1);
    }
    fn get(&self) -> u32 {
        self.count.get()
    }
}

fn main() {
    let c = Counter::new();
    c.inc();
    c.inc();
    c.inc();
    println!("count = {}", c.get());
}
```

Actual run output (rustc 1.99.0):

```text
count = 3
```

`c` is never declared `mut`, yet `inc(&self)` mutates the inner value — the borrowing conflict is neutralized by `Cell`'s internal "no references, only whole-value swap" design.

## `RefCell<T>`: the borrow check moves to runtime

`RefCell` lets you borrow out real references; the rules are unchanged (many `borrow` or one `borrow_mut`), but the check happens at **runtime** — a violation panics:

```rust
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(String::from("hello"));
    let r1 = cell.borrow();
    println!("r1 = {r1}");
    let r2 = cell.borrow_mut(); // 运行时 panic：r1 仍活跃
    println!("r2 = {r2}");
}
```

Actual run output (the process exits with code 101):

```text
r1 = hello

thread 'main' (666320) panicked at p3_refcell_panic.rs:7:19:
RefCell already borrowed
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace
```

The very same code is perfectly legal at compile time — the `borrow_mut` signature is fine, and the conflict only explodes when it actually happens. That is the flexibility you buy with the cost of "safe but may panic."

## `try_borrow` and `Ref::map`

If you don't want a panic, use `try_borrow`/`try_borrow_mut` to get a `Result`:

```rust
use std::cell::RefCell;

fn main() {
    let cell = RefCell::new(String::from("hello"));
    let r1 = cell.borrow();
    println!("r1 = {r1}");
    let result = cell.try_borrow_mut();
    match result {
        Ok(_) => println!("try_borrow_mut 成功"),
        Err(e) => println!("try_borrow_mut 失败: {e}"),
    }
    drop(r1);
    let result = cell.try_borrow_mut();
    match result {
        Ok(mut m) => {
            m.push_str(", world");
            println!("drop(r1) 后 try_borrow_mut 成功: {m}");
        }
        Err(e) => println!("try_borrow_mut 失败: {e}"),
    }
}
```

Actual run output:

```text
r1 = hello
try_borrow_mut 失败: RefCell already borrowed
drop(r1) 后 try_borrow_mut 成功: hello, world
```

Another practical tool is `Ref::map`: it projects a `Ref<User>` down to a `Ref<String>` (pointing at one field), locking only the field region you actually touch, so multiple immutable projections can coexist:

```rust
use std::cell::{Ref, RefCell};

struct User {
    name: String,
    age: u32,
}

fn main() {
    let user = RefCell::new(User { name: String::from("alice"), age: 30 });
    let name: Ref<'_, String> = Ref::map(user.borrow(), |u| &u.name);
    println!("name = {name}");
    let age: Ref<'_, u32> = Ref::map(user.borrow(), |u| &u.age);
    println!("age = {age}");
    drop((name, age));
    let mut u = user.borrow_mut();
    u.age += 1;
    println!("age after +1 = {}", u.age);
}
```

Actual run output:

```text
name = alice
age = 30
age after +1 = 31
```

## Real use: cache invalidation flags

`RefCell` is not a toy — the standard library relies on it inside `Mutex`, `OnceCell`, and the `lazy` pattern. A typical case: a read-only API hiding a mutable invalidation flag behind it:

```rust
use std::cell::RefCell;

struct Cache {
    data: String,
    dirty: RefCell<bool>, // 通过 &self 就能修改
}

impl Cache {
    fn new(data: &str) -> Self {
        Cache { data: data.to_string(), dirty: RefCell::new(false) }
    }
    fn mark_dirty(&self) {
        *self.dirty.borrow_mut() = true;
    }
    fn reload(&self) {
        if *self.dirty.borrow() {
            println!("缓存失效，重新加载 {}", self.data);
            *self.dirty.borrow_mut() = false;
        } else {
            println!("缓存命中: {}", self.data);
        }
    }
}

fn main() {
    let cache = Cache::new("config.json");
    cache.reload();
    cache.mark_dirty();
    cache.reload();
    cache.reload();
}
```

Actual run output:

```text
缓存命中: config.json
缓存失效，重新加载 config.json
缓存命中: config.json
```

Both `reload(&self)` and `mark_dirty(&self)` take immutable receivers, so the cache object can be shared behind `Rc`/`Arc` — without interior mutability this API simply could not be designed.

## Notes and common pitfalls

- **Neither `Cell` nor `RefCell` is `Sync`**: the cross-thread equivalents are `Mutex`/`RwLock`/atomic types.
- **Panic is not exception handling**: a `borrow` conflict panicking means the logic is wrong; production code probes with `try_borrow`.

## References

- Official docs: "The Rust Programming Language" chapter 15 · RefCell&lt;T&gt; and the Interior Mutability Pattern: <https://doc.rust-lang.org/book/ch15-05-interior-mutability.html>

## Related pages

- [Smart pointers](./smart-pointers) — the classic combination of `Rc<RefCell<T>>` for shared mutable data.
- [Borrowing and references](../language-core/borrowing-and-references) — the static rule that has been runtime-ized.
- [Fearless concurrency](./threads-and-channels) — `Mutex`/`RwLock` are the cross-thread versions of "RefCell."
- [Glossary](../glossary) — the site-wide bilingual glossary of core terms with authoritative sources.
