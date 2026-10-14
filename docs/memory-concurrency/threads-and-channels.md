# 无畏并发

"无畏并发（fearless concurrency）"指的不是并发不会出错，而是**错误被编译器拦下**：数据竞争在 Safe Rust 里无法构造（见 [Send 与 Sync](./send-and-sync)），剩下的正确性问题——线程生命周期、通信、同步——都有标准库答案。核心知识点：**`spawn`/join 与 channel 的所有权式消息传递**，与**三种共享状态的取舍**（`Mutex`/`RwLock`/原子）。

## `thread::spawn` 与 join

`spawn` 接收闭包并立刻开线程，`JoinHandle::join` 等待结束并**取回返回值**：

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

真实运行输出（rustc 1.99.0）：

```text
worker 累加完成, v = [1, 2, 3, 4, 5]
main 收到 join 返回值: 15
```

闭包里创建的 `Vec` 在线程内生成、求和后把 `i32` 送回 main——数据靠所有权跨线程流动，无需共享。`join` 返回 `Result`：线程 panic 则收到 `Err`，不 join 的线程会在进程退出时被直接砍掉。

## mpsc channel：用通信共享内存

“不要通过共享内存来通信，要通过通信来共享内存。”`std::sync::mpsc`（multi-producer, single-consumer）是官方答案：

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

真实运行输出（收到的顺序取决于调度，故排序后断言）：

```text
results = [0, 1, 4, 9]
```

`send(i * i)` 把值**move** 给接收方——发完线程就不能再用，接收方独占数据，没有共享就没有竞争。`drop(tx)` 是关键细节：`rx.iter()` 迭代到**所有**发送端关闭才结束。

## `Mutex` 与 `RwLock`：共享内存路线

多线程改同一份数据用锁。`Mutex` 互斥（一写或一读），`RwLock` 读写锁（多读并发/写独占）：

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

真实运行输出：

```text
mutex counter = 4
reader sees: len = 3
after write: [1, 2, 3, 4]
```

注意没有显式 unlock：`lock()` 返回的守卫（RAII）离开作用域自动解锁（见 [Drop 与析构](./drop-and-destructors)），忘记解锁这件事在 Rust 里做不到。

## 原子类型：无锁计数

不需要保护复杂数据、只改一个数字时，原子操作比锁便宜得多：

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

真实运行输出：

```text
n = 4000
```

4 线程各加 1000 次结果精确等于 4000——`fetch_add` 是原子的，交错执行也不丢更新。`Ordering` 是内存序约束，`SeqCst`（顺序一致）最严格也最好懂，入门用它即可。

## scoped threads：借用栈上数据

`spawn` 要求 `'static`（不许借栈），Rust 1.63 起的 `thread::scope` 打破这堵墙：作用域结束前**保证** join 所有线程，因此内部线程可以安全借用局部变量：

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

真实运行输出（三行更新的先后取决于调度）：

```text
thread 更新了索引 2
thread 更新了索引 0
thread 更新了索引 1
data = [11, 12, 13]
```

连 `Arc`/`Mutex` 都省了：`iter_mut` 本身就保证每个元素只有一个线程可变借用，借用检查器在线程场景照常工作。

## 注意事项

- **锁守卫跨 `.await` 是死锁温床**：异步代码里改用 `tokio::sync::Mutex`（见 [tokio 生态](../async/tokio-ecosystem)）。
- **`Mutex` 保护数据而不是代码**：把 `Mutex<T>` 与被保护数据放一起，锁的粒度自然正确。
- **死锁依然可能**：Rust 防数据竞争，不防两个锁的获取顺序相反——channel 架构天然回避这个问题。

## 参考资料

- 官方文档：《The Rust Programming Language》第 16 章 · Fearless Concurrency：<https://doc.rust-lang.org/book/ch16-00-concurrency.html>

## 相关页面

- [Send 与 Sync](./send-and-sync)——`spawn` 边界 `F: Send + 'static` 的原理。
- [交叉编译](./cross-compilation)——多平台构建这些线程程序。
- [async 生态](../async/)——线程之外的第二条并发路线。
- [术语表](../glossary)——全站核心术语的中英对照与权威出处。
