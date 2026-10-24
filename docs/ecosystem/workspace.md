# Workspaces and Multi-Crate Projects

When a project grows past a single crate, use a workspace to organize them together: one shared `Cargo.lock`, one shared `target/` directory, and unified dependency versions. A workspace is not a macro and not a plugin — it is just a `[workspace]` table in the root `Cargo.toml`.

## The minimal workspace structure

The root `Cargo.toml` has only `[workspace]` and no `[package]`; each member crate has its own `Cargo.toml` and `src/`.

```toml
# 根 Cargo.toml
[workspace]
members = ["crates/app", "crates/util"]
resolver = "3"

[workspace.package]
version = "0.2.0"
edition = "2024"
license = "MIT"
```

```toml
# crates/app/Cargo.toml
[package]
name = "app"
version.workspace = true
edition.workspace = true
license.workspace = true

[dependencies]
util = { workspace = true }
```

Running `cargo build` at the root compiles both crates together; `cargo run -p app` runs the named member directly from the root. Actual run output:

```text
   Compiling util v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/util)
   Compiling app v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/app)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.00s
```

```text
app: hello, world (via util::greet)
serde json: {"x":3,"y":4}
```

## Inherited fields: `version.workspace = true`

Fields defined in `[workspace.package]` can be inherited by a member with `fieldname.workspace = true`, avoiding restating them in every crate. The inheritable fields listed by the official docs include `version`, `edition`, `license`, `description`, `repository`, `rust-version`, and so on.

Measured with rustc 1.99.0 / cargo 1.99.0 in this environment: inherited fields are fully usable. The feature requires cargo 1.64+ (the MSRV the official docs cite), and this environment is far above that threshold.

```bash
# 查看某个成员实际继承后的版本
cargo pkgid -p util
```

Actual run output:

```text
path+file:///tmp/ecosystem-examples/ws-demo/crates/util#0.2.0
```

## workspace.dependencies: unified dependency declarations

Declare dependencies in the root `[workspace.dependencies]` and have members reference them with `{ workspace = true }`. The win is that a version is written once and upgraded in one place:

```toml
# 根 Cargo.toml
[workspace.dependencies]
serde = "1.0"
util = { path = "crates/util" }
```

```toml
# crates/app/Cargo.toml
[dependencies]
serde = { workspace = true, features = ["derive"] }
util = { workspace = true }
```

Note: `cargo add serde -p app` writes the dependency into the member's own `[dependencies]` by default and will **not** automatically place it in `[workspace.dependencies]`. cargo 1.99 in this environment also has no `--workspace` flag on `cargo add` — measured: `cargo add serde --workspace` errors out:

```text
error: unexpected argument '--workspace' found
```

So using `workspace = true` inheritance requires manually moving the dependency entry from the member into the root `[workspace.dependencies]`.

## Path dependencies vs crates.io dependencies

Members inside a workspace depend on one another with `path = "..."` (path dependencies); external dependencies are pulled from crates.io. `cargo tree` distinguishes the two at a glance — path dependencies carry a `(file://...)` marker, while registry dependencies show a version number:

Actual run output:

```text
app v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/app)
├── serde v1.0.229
│   └── serde_core v1.0.229
├── serde_json v1.0.154
└── util v0.2.0 (/tmp/ecosystem-examples/ws-demo/crates/util)
```

Path dependencies automatically become workspace members (per the official docs), with no need to list them again in `members`. But **path dependencies cannot be published directly**: `cargo publish` requires every dependency to have a version number, otherwise it errors (see [Publishing a crate](./publish-crate)). Before publishing, add `version = "0.2.0"` alongside `path = "..."`.

## Engineering practices

- **Flatten the member layout**: the official recommendation is to keep all members under `crates/` and use the wildcard `members = ["crates/*"]`;
- **Share the lockfile and target/**: the workspace root maintains a single `Cargo.lock` and `target/`, avoiding duplicate compilation;
- **`resolver = "3"`**: the resolver paired with edition 2024, handling feature unification and `default-features` inheritance correctly;
- **Run cargo commands from a member directory**: cargo walks up to find the workspace root automatically, so `cargo run` inside `crates/app/` also works.

Actual run output (running `cargo run` in the `crates/app/` directory):

```text
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 18.29s
     Running `target/debug/app`
app: hello, world (via util::greet)
serde json: {"x":3,"y":4}
```

## References

- Official docs: *The Cargo Book* · Workspaces: <https://doc.rust-lang.org/cargo/reference/workspaces.html>

## Related pages

- [Publishing a crate to crates.io](./publish-crate) — path dependencies and the conflict with publishing.
- [Toolchain](../tooling/) — everyday use of cargo and rustup.
- [Language core](../language-core/) — crates and the module system.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
