# Fearless Concurrency

"Fearless concurrency" does not mean concurrency cannot go wrong, it means **mistakes are caught by the compiler**: data races cannot be constructed in Safe Rust (see [Send and Sync](./send-and-sync)), and the remaining correctness concerns — thread lifetime, communication, synchronization — all have standard-library answers. The core takeaways: **`spawn`/join and channel-based ownership-style message passing**, and **the trade-offs among the three ways to share state** (`Mutex`/`RwLock`/atomics).

## `thread::spawn` and join

`spawn` takes a closure and immediately starts a thread; `JoinHandle::join` waits for it to end and **retrieves the return value**:

```rust
use std::thread;

fn main() {
    let h = thread::spawn(|| {
        let mut v: Vec<i32> = Vec::new();
        for i in 1..=5 {
            v.push(i);
        }
        println!("worker 累加完成, v = {v:?}");
        v.into_iter().sum::<i32>()
    });
    let sum = h.join().unwrap();
    println!("main 收到 join 返回值: {sum}");
    assert_eq!(sum, 15);
}
```

Actual run output (rustc 1.99.0):

```text
worker 累加完成, v = [1, 2, 3, 4, 5]
main 收到 join 返回值: 15
```

The `Vec` created in the closure is built inside the thread, summed, and the `i32` is handed back to main — data flows across threads by ownership, no sharing required. `join` returns a `Result`: if the thread panics you receive an `Err`, and threads that are never joined are killed outright when the process exits.

## mpsc channel: sharing memory through communication

"Don't communicate by sharing memory; share memory by communicating." `std::sync::mpsc` (multi-producer, single-consumer) is the official answer:

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    let mut handles = vec![];
    for i in 0..4 {
        let tx = tx.clone(); // 每个工作线程一个发送端克隆
        handles.push(thread::spawn(move || {
            tx.send(i * i).unwrap();
        }));
    }
    drop(tx); // 关闭最后一个发送端，否则 rx.iter() 会永远等待
    let mut results: Vec<i32> = rx.iter().collect();
    results.sort_unstable();
    println!("results = {results:?}");
    assert_eq!(results, vec![0, 1, 4, 9]);
    for h in handles {
        h.join().unwrap();
    }
}
```

Actual run output (arrival order depends on scheduling, so the assertion is on the sorted result):

```text
results = [0, 1, 4, 9]
```

`send(i * i)` **moves** the value to the receiver — once sent, the thread can no longer use it; the receiver owns the data exclusively, and without sharing there is no contention. `drop(tx)` is the key detail: `rx.iter()` only finishes iterating once **all** senders are closed.

## `Mutex` and `RwLock`: the shared-memory route

When multiple threads mutate the same data, use locks. `Mutex` is mutually exclusive (one write or one read), `RwLock` is a read-write lock (concurrent reads / exclusive write):

```rust
use std::sync::{Arc, Mutex, RwLock};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let c = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            let mut n = c.lock().unwrap();
            *n += 1;
        })); // 锁守卫 n 在此 drop，自动解锁
    }
    for h in handles {
        h.join().unwrap();
    }
    println!("mutex counter = {}", *counter.lock().unwrap());

    let data = Arc::new(RwLock::new(vec![1, 2, 3]));
    let d = Arc::clone(&data);
    let reader = thread::spawn(move || {
        let r = d.read().unwrap();
        println!("reader sees: len = {}", r.len());
    });
    reader.join().unwrap();
    let mut w = data.write().unwrap();
    w.push(4);
    println!("after write: {w:?}");
}
```

Actual run output:

```text
mutex counter = 4
reader sees: len = 3
after write: [1, 2, 3, 4]
```

Note there is no explicit unlock: the guard returned by `lock()` (RAII) unlocks automatically when it leaves scope (see [Drop and destructors](./drop-and-destructors)) — forgetting to unlock simply cannot happen in Rust.

## Atomic types: lock-free counting

When you don't need to protect complex data, just mutate one number, atomic operations are far cheaper than locks:

```rust
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

fn main() {
    let n = Arc::new(AtomicUsize::new(0));
    let mut handles = vec![];
    for _ in 0..4 {
        let r = Arc::clone(&n);
        handles.push(thread::spawn(move || {
            for _ in 0..1000 {
                r.fetch_add(1, Ordering::SeqCst);
            }
        }));
    }
    for h in handles {
        h.join().unwrap();
    }
    assert_eq!(n.load(Ordering::SeqCst), 4000);
    println!("n = {}", n.load(Ordering::SeqCst));
}
```

Actual run output:

```text
n = 4000
```

Four threads each adding 1000 times gives exactly 4000 — `fetch_add` is atomic, so updates are not lost even under interleaved execution. `Ordering` constrains the memory order; `SeqCst` (sequentially consistent) is the strictest and the easiest to reason about, which is all a beginner needs.

## Scoped threads: borrowing stack data

`spawn` requires `'static` (no borrowing from the stack); `thread::scope`, available since Rust 1.63, breaks through this wall: it **guarantees** joining all threads before the scope ends, so inner threads can safely borrow local variables:

```rust
use std::thread;

fn main() {
    let mut data = vec![1, 2, 3];
    thread::scope(|s| {
        for (i, x) in data.iter_mut().enumerate() {
            s.spawn(move || {
                *x += 10;
                println!("thread 更新了索引 {i}");
            });
        }
    }); // scope 返回前自动 join，之后 data 可再次使用
    println!("data = {data:?}");
    assert_eq!(data, vec![11, 12, 13]);
}
```

Actual run output (the order of the three update lines depends on scheduling):

```text
thread 更新了索引 2
thread 更新了索引 0
thread 更新了索引 1
data = [11, 12, 13]
```

Even `Arc`/`Mutex` are spared: `iter_mut` itself guarantees only one thread mutably borrows each element, and the borrow checker works as usual in a threaded context.

## Notes and common pitfalls

- **A lock guard held across `.await` is a deadlock waiting to happen**: in async code use `tokio::sync::Mutex` instead (see [the tokio ecosystem](../async/tokio-ecosystem)).
- **`Mutex` protects data, not code**: keep `Mutex<T>` colocated with the data it guards and the lock granularity comes out correct naturally.
- **Deadlocks are still possible**: Rust prevents data races, not acquiring two locks in opposite order — a channel architecture sidesteps the problem by design.

## References

- Official docs: "The Rust Programming Language" chapter 16 · Fearless Concurrency: <https://doc.rust-lang.org/book/ch16-00-concurrency.html>

## Related pages

- [Send and Sync](./send-and-sync) — the reasoning behind the `spawn` boundary `F: Send + 'static`.
- [Cross-compilation](./cross-compilation) — building these threaded programs for multiple platforms.
- [The async ecosystem](../async/) — the second concurrency route beyond threads.
- [Glossary](../glossary) — the site-wide Chinese-English dictionary of core terms with authoritative sources.
