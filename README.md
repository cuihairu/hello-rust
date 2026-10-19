# hello-rust

<img src="logo.svg" width="64" height="64">

Rust notes and experiments drawn from game development: ownership, borrowing, lifetimes, traits, async, macros and tooling, with the bugs and tradeoffs I ran into along the way.

**Read online**: <https://cuihairu.github.io/hello-rust/>

中文文档见 [README.zh.md](README.zh.md)。

## Run locally

Requires Node.js 18+ (20+ recommended).

```bash
npm ci                # install deps
npm run docs:dev      # dev server with hot reload
npm run docs:build    # build static site to docs/.vitepress/dist/ (dead-link check fails the build)
npm run docs:preview  # preview the built site
```

> If npm is configured with install scripts disabled (`npm warn install-scripts`) and the build fails on a missing esbuild binary, run `npm rebuild esbuild` and retry.

## Layout

```
docs/
├── index.md            # home
├── knowledge.md        # knowledge map
├── glossary.md         # terminology reference
├── review/             # structure and content review notes
├── language-core/      # Language core (ownership, borrowing, lifetimes, traits, generics, enums, errors)
├── type-system/        # Type system & abstraction
├── memory-concurrency/ # Memory & concurrency
├── async/              # Async
├── macros/             # Macros
├── tooling/            # Tooling
├── ecosystem/          # Ecosystem & engineering
├── comparison/         # Rust vs C/C++/Go/Java
├── .vitepress/
│   ├── config.mts      # site config (base / nav / search / dead-link gate)
│   └── sidebar.json    # sidebar — the single slug list for all pages
└── public/             # favicon / logo (same logo.svg)
OUTLINE.md              # historical writing plan; navigation source is sidebar.json
todo.md                 # audit ledger: open items / done items with commit evidence
```

Each topic starts with its own `index.md` (topic overview). Sidebar order and links are maintained only in `docs/.vitepress/sidebar.json`.

## Writing rules

- One or two core ideas per page, 80–200 lines, body text in Chinese.
- Code examples are reproducible: snippets compile and run with `rustc`/`cargo` as shown; outputs in code comments are copied from real runs.
- Heading structure: a single H1 per page, `##` / `###` inside; same shape as the sister site hello-postgresql.
- Every page ends with two blocks: `## 相关页面` (in-site relative links without the `.md` suffix, slugs from `sidebar.json`) and one official-docs link line.
- Fact checking: syntax and semantics are verified against the [Rust book](https://doc.rust-lang.org/book/), [the Rust reference](https://doc.rust-lang.org/reference/), [the std docs](https://doc.rust-lang.org/std/), [RFCs](https://rust-lang.github.io/rfcs/) and [The Rustonomicon](https://doc.rust-lang.org/nomicon/) before writing them down; if a fact cannot be verified, the page says so explicitly ("未找到出处").

## Deploy

Pushing to `main` triggers GitHub Actions (`.github/workflows/deploy-docs.yml`) to build and publish to GitHub Pages; you can also run it manually via `workflow_dispatch`. This repo does not publish versioned releases.

## License

[CC BY 4.0](./LICENSE)
