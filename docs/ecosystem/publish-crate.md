# Publishing a Crate to crates.io

Publishing a crate to crates.io is the core delivery action of the Rust ecosystem. Publishing is irreversible — once a version is uploaded it cannot be overwritten or deleted — so `cargo publish --dry-run` is the single most important validation step before publishing.

## Metadata fields

The metadata fields in `[package]` determine how a crate appears on and is discoverable from crates.io. Key fields listed by the official docs:

| Field | Purpose |
|------|------|
| `description` | Crate description, shown on the crates.io listing page |
| `license` or `license-file` | License; crates.io classifies by this |
| `documentation` | Docs URL, defaults to docs.rs |
| `repository` | Source repository URL |
| `keywords` / `categories` | Search and classification tags |
| `readme` | README file, shown on the crate homepage |

A minimal publishable `Cargo.toml`:

```toml
[package]
name = "pub-demo"
version = "0.1.0"
edition = "2024"
rust-version = "1.85"
description = "演示 cargo publish 元数据校验的最小 crate"
license = "MIT"
documentation = "https://docs.rs/pub-demo"
repository = "https://example.com/pub-demo"
keywords = ["demo", "publish"]
categories = ["development-tools"]
```

## semver policy: breaking-change semantics of 0.x vs 1.x

The semver rules differ essentially between 0.x and 1.x:

- **1.x**: in `major.minor.patch`, a change in the minor position (1.0 → 1.1) is compatible; only a change in the major position (1.0 → 2.0) is a breaking change;
- **0.x**: a change in the minor position (0.1 → 0.2) is itself a breaking change; only a change in the patch position (0.1.0 → 0.1.5) is compatible.

This means a 0.x-stage crate can ship big API rewrites in 0.2, 0.3, and so on without violating its semver promise; but once 1.0 is published, compatibility rules must be followed strictly. The official recommendation: mark old APIs with `#[deprecated]` before a breaking change, giving downstream users a migration window.

### yanked vs deprecated

- **yanked**: the author or the registry removes a version from resolution. A new project's `cargo update` will not select a yanked version, but a project already pinned by `Cargo.lock` can still build — yanked is not deleted. In the registry index, `yanked` is a boolean field and the only mutable entry.
- **deprecated**: purely advisory metadata; it does not affect version resolution and the crate can still be depended on normally.

In short: yanked is a hard retraction (affects resolution), deprecated is a soft warning (does not affect resolution).

## cargo publish --dry-run measured

`cargo publish` runs five steps; `--dry-run` completes the first three:

1. Validation checks on the package;
2. Compress the source into a `.crate` file;
3. Extract into a temp directory and verify it compiles;
4. Upload to crates.io (skipped by dry-run);
5. Registry performs extra checks (skipped by dry-run).

Measured in this environment (rustc 1.99.0 / cargo 1.99.0, `git init` already run and committed):

Actual run output:

```text
   Packaging pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
    Packaged 6 files, 1.9KiB (1.2KiB compressed)
   Verifying pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
   Compiling pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo/target/package/pub-demo-0.1.0)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.10s
   Uploading pub-demo v0.1.0 (/tmp/ecosystem-examples/pub-demo)
warning: aborting upload due to dry run
```

`cargo package --list` shows the manifest of files that would be packaged:

Actual run output:

```text
.cargo_vcs_info.json
.gitignore
Cargo.lock
Cargo.toml
Cargo.toml.orig
src/lib.rs
```

Note that `Cargo.toml.orig` is a backup of the original manifest, while `Cargo.toml` is the version cargo normalized automatically (fields reordered, `path` dependencies expanded into registry dependencies).

## The checklist exposed by dry-run output

`--dry-run` surfaces the following issues during packaging and verification; confirm each one before publishing:

**1. Missing-metadata warnings** (non-blocking, but strongly recommended to fix):

Actual run output (a crate with no `description`/`license` and similar fields):

```text
warning: manifest has no description, license, license-file, documentation, homepage or repository
  |
  = note: see https://doc.rust-lang.org/cargo/reference/manifest.html#package-metadata for more info
```

**2. Uncommitted changes** (dry-run refuses to package a dirty working tree by default):

Actual run output:

```text
error: 2 files in the working directory contain changes that were not yet committed into git:

Cargo.toml
src/lib.rs

to proceed despite this and include the uncommitted changes, pass the `--allow-dirty` flag
```

**3. Path dependencies missing a version number** (publish-blocking error):

Actual run output (a dependency written as `foo = { path = "../foo" }` with no `version`):

```text
error: failed to verify manifest at `/tmp/ecosystem-examples/pub-path/Cargo.toml`

Caused by:
  all dependencies must have a version requirement specified when publishing.
```

Fix: add `version = "0.1.0"` to the path dependency; at publish time cargo replaces the `path` information with the registry version automatically.

**4. Compile verification**: dry-run extracts the packaged code into `target/package/` and recompiles it once, guaranteeing that the published artifact itself builds.

## Engineering practices

- **Run `cargo publish --dry-run` before publishing**: validate metadata, packaged contents, and that it compiles;
- **Check packaged contents with `cargo package --list`**: make sure no large or sensitive files were included accidentally, and control inclusion with `exclude` / `include`;
- **Follow semver for version numbers**: the minor position may break in 0.x, and 1.x must be strictly compatible;
- **Tag a git tag after publishing**: the official guidance is one tag per published version, automated with tools like `cargo-release`;
- **`.crate` files are capped at 10MB**: check the size before packaging.

## References

- Official docs: *The Cargo Book* · Publishing on crates.io: <https://doc.rust-lang.org/cargo/reference/publishing.html>

## Related pages

- [Workspaces and Multi-Crate Projects](./workspace) — path dependencies automatically become members inside a workspace.
- [Toolchain](../tooling/) — common cargo workflows.
- [Language core](../language-core/) — crates and the module system.
- [Glossary](../glossary) — core terms across the site, with Chinese-English cross-reference and authoritative sources.
