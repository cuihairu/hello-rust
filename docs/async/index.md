# Async

async/await and Future, Pin and self-reference, the tokio ecosystem, select and cancellation — the execution model and runtimes of Rust async programming.

- [async/await and Future](async-await-and-future.md) — the `Future` trait and `poll`, `Poll::Ready`/`Pending`, async blocks compiled into state machines, lazy evaluation; a zero-dependency hand-written executor drives it.
- [Executors and Runtimes](executors-and-runtime.md) — a hand-written single-threaded executor (task queue + the `Wake` trait), what `block_on` really is; compared with tokio's multi-threaded runtime, its shards and work stealing.
- [Pin and Self-Reference](pin-and-self-reference.md) — `Unpin`, `Pin<&mut T>`, uses for `pin!` and `pin_project`; why async blocks must be pinned; the constraint that a `Future` return type must be `Unpin`.
- [The tokio Ecosystem](tokio-ecosystem.md) — runtime flavours, `#[tokio::main]`, `spawn`, `spawn_blocking`, the `Send` requirement on tasks, `JoinHandle`.
- [select, Timeouts and Cancellation](select-and-cancellation.md) — `tokio::select!`, `tokio::time::timeout`, `CancellationToken`, cooperative task cancellation; the semantics of select dropping the losing branch.
- [Send in Async and async trait](async-send-and-async-trait.md) — the real error from holding a lock across an `await` and ending up `!Send`, where the `Send` bound comes from, the `async_trait` macro versus stable `async_fn_in_trait` (RFC 3185).

---

- [Memory & Concurrency](../memory-concurrency/) — the ground for synchronous concurrency: Send and Sync, channels and locks.
- [Language Core](../language-core/) — traits, lifetimes and ownership, the language foundation async code leans on.
- [Glossary](../glossary) — Chinese–English pairs and authoritative sources for every core term on the site.
