# Source Layer Analysis (2026-11-07)

English-only analysis of how this repository is layered. The Chinese edition is deferred to a separate task. Scope: all tracked source files; generated output (`docs/.vitepress/dist/`), installed dependencies (`node_modules/`), and lockfiles are excluded from the "source" definition. Layer = responsibility, not directory name.

## 1. What this repository is

`hello-rust` is a **static documentation site**, not an application or service.

- There are **zero `.rs` files** and no server, API, or database code anywhere in the tree (`git ls-files '*.rs'` returns nothing).
- The only runtime artifacts are the static pages emitted by VitePress and served by GitHub Pages.
- Content is authored in Markdown under `docs/`; site behavior is configured in `docs/.vitepress/`.
- State storage: **none in the service sense** — there is no Redis, no MySQL, no in-memory registry, and no persistent application store. The only state-like outputs are build products (`docs/.vitepress/dist/`, git-ignored at `.gitignore:2`) and installed dependencies (`node_modules/`, git-ignored at `.gitignore:1`).

### 1.1 File inventory (source, excluding generated/installed/lockfiles)

| Layer | Representative files | Count | Total lines |
|---|---|---|---|
| Content pages (EN, root) | 54 topic pages in `docs/{language-core,type-system,memory-concurrency,async,macros,tooling,ecosystem,comparison}/`, plus `docs/glossary.md`, `docs/knowledge.md` | 56 | 8,382 |
| Site home | `docs/index.md` | 1 | 40 |
| Content pages (ZH mirror) | `docs/zh/**/*.md` | 57 | 8,422 |
| Review archive | `docs/review/*.md` | 3 | 360 |
| Site config | `docs/.vitepress/config.mts`, `sidebar.en.json`, `sidebar.zh.json`, `theme/index.ts`, `theme/custom.css` | 5 | 512 |
| Project metadata | `package.json`, `README.md`, `README.zh.md`, `OUTLINE.md`, `todo.md`, `LICENSE`, `.gitignore` | 7 | 694 |
| CI / deploy | `.github/workflows/deploy-docs.yml` | 1 | 52 |
| Static asset | `logo.svg`, `docs/public/logo.svg` | 2 | 2 |

Line counts use `wc -l` on the working tree; EN content line total excludes the two review files and the home page to keep the topic-page subtotal comparable with `docs/review/structure-audit-2026-10-19.md:20-27`.

## 2. Glossary

| Term | English | Definition | file:line |
|---|---|---|---|
| 文档站 | static documentation site | A site whose deliverable is static HTML/Markdown, not a running service; this repo is one. | `package.json:2` |
| 内容层 | content layer | The Markdown pages that carry the actual knowledge; authored by hand, not generated. | `docs/language-core/ownership-and-move.md:1` |
| 主题组 | topic group | One of the eight content directories (language-core, type-system, memory-concurrency, async, macros, tooling, ecosystem, comparison); each has an `index.md` gate. | `docs/language-core/index.md:1` |
| 站点配置层 | site config layer | VitePress site metadata and behavior: title, base, locales, nav, sidebar, search, outline, dead-link gate. | `docs/.vitepress/config.mts:7` |
| 导航层 | navigation layer | Sidebar and top-nav entries that map labels to routes; the sidebar JSON is the single source of page URLs. | `docs/.vitepress/sidebar.en.json:3` |
| 构建层 | build layer | npm scripts that drive VitePress dev/build/preview; the build gate enforces no dead links. | `package.json:5` |
| 部署层 | deploy layer | GitHub Actions workflow that builds on push to `main` and deploys to GitHub Pages. | `.github/workflows/deploy-docs.yml:3` |
| 归档层 | archive layer | `docs/review/` holds raw pasted tool logs and audit records; excluded from the site route tree. | `docs/.vitepress/config.mts:8` |
| 双语镜像 | bilingual mirror | English lives at the doc root; the Chinese edition is a parallel tree under `docs/zh/`. | `docs/.vitepress/config.mts:19` |
| 前端配置 | frontmatter | YAML header on a page that sets layout/hero/title; only `index.md` and `glossary.md` use it. | `docs/glossary.md:1` |
| 死链门禁 | dead-link gate | `ignoreDeadLinks: false` makes the build fail on any unresolved internal link. | `docs/.vitepress/config.mts:17` |
| 本地搜索 | local search | Built-in VitePress local search provider, enabled per locale with Chinese labels for `/zh/`. | `docs/.vitepress/config.mts:64` |
| 术语表 | glossary | Cross-topic term index; 60 entries in 8 sections, each with a curl-verified official source. | `docs/glossary.md:18` |
| 知识索引 | notes index | Cross-cutting index of key points; lives outside the sidebar but is linked from the top nav. | `docs/knowledge.md:1` |
| 构建产物 | build artifact | Generated static site under `docs/.vitepress/dist/`, git-ignored, produced by `docs:build`. | `.gitignore:2` |
| 状态存储 | state store | No runtime state store exists; the only stateful outputs are the dist dir and installed deps. | `.gitignore:1` |

## 3. Architecture walkthrough (by layer)

### 3.1 Content layer (the knowledge itself)

- **Files**: 54 English pages in the eight topic directories (`docs/{language-core,type-system,memory-concurrency,async,macros,tooling,ecosystem,comparison}/`, 8 `index.md` + 46 topic pages), plus `docs/glossary.md`, `docs/knowledge.md`, and the site home `docs/index.md` (56 content pages + 1 home).
- **Implementation**: each topic page is a standalone Markdown file with a single `# H1`, `##`/`###` body, a `## Related pages` tail, and runnable `rustc`/`cargo` examples. See `docs/language-core/ownership-and-move.md:1` (H1), `:19` (first code block), `:46` (Related pages tail).
- **Config schema**: none per page beyond optional frontmatter; only `docs/index.md` (`layout: home` + `hero` + `features`) and `docs/glossary.md` (`title` + `layout: page`) carry it. See `docs/index.md:1` and `docs/glossary.md:1`.
- **Protocol files**: none — there is no service-to-service protocol; the only "contract" is the internal link graph between Markdown pages and the sidebar routes.
- **Copy (文案)**: the prose lives directly in the Markdown; the English copy is the source of truth at the root, and `docs/zh/` mirrors it 1:1 (57 EN vs 57 ZH files).

### 3.2 Site configuration layer (site behavior)

- **Files**: `docs/.vitepress/config.mts`, `docs/.vitepress/sidebar.en.json`, `docs/.vitepress/sidebar.zh.json`, `docs/.vitepress/theme/index.ts`, `docs/.vitepress/theme/custom.css`.
- **Implementation**: `config.mts` is the single VitePress config. It sets `base: '/hello-rust/'`, `cleanUrls: true`, `lastUpdated: true`, `ignoreDeadLinks: false` (dead-link gate), two locales (root EN, `/zh/` ZH), per-locale nav, sidebar, search, outline, footer. See `docs/.vitepress/config.mts:7-17` (base/locales/dead-link), `:45-76` (root theme), `:78-127` (zh theme).
- **Config schema**: the schema is the `defineConfig` object shape from VitePress, imported at `config.mts:1`; there is no custom JSON schema file for this repo.
- **Protocol files**: none; the sidebar JSON is data consumed by the config via `import enSidebar from './sidebar.en.json'` at `config.mts:3-4` and passed as `DefaultTheme.SidebarItem[]` at `config.mts:63,96`.
- **Copy (文案)**: nav labels, footer, search translations, and sidebar text are all defined in `config.mts` (nav `:50-61`, `:83-94`) and the two sidebar JSONs (`sidebar.en.json`, `sidebar.zh.json`).

### 3.3 Navigation layer (route truth)

- **Files**: `docs/.vitepress/sidebar.en.json`, `docs/.vitepress/sidebar.zh.json`.
- **Implementation**: each file is an ordered array of `{ text, link, items }` groups. EN has 8 topic groups + Glossary; ZH mirrors the shape. See `docs/.vitepress/sidebar.en.json:1-108` and `docs/.vitepress/sidebar.zh.json:1-246`.
- **Config schema**: the JSON shape is consumed as `DefaultTheme.SidebarItem[]`; no separate schema file.
- **Protocol files**: none. The sidebar is the single source of page URLs, as declared in `README.zh.md`/`OUTLINE.md`.
- **Copy (文案)**: all display labels live here; no prose.

### 3.4 Build layer

- **Files**: `package.json`, `docs/.vitepress/theme/index.ts`, `docs/.vitepress/theme/custom.css`.
- **Implementation**: `package.json:5-8` exposes `docs:dev`, `docs:build`, `docs:preview`; the theme entry re-exports the default theme and imports `custom.css` (`docs/.vitepress/theme/index.ts:1-3`); `docs/.vitepress/theme/custom.css` widens content and wraps long code lines (`docs/.vitepress/theme/custom.css:1-19`).
- **Config schema**: npm scripts + `vitepress@^1.6.4` devDependency and a `vite@6.4.4` override (`package.json:10-15`).
- **Protocol files**: none.
- **Copy (文案)**: none — build layer has no user-facing copy.

### 3.5 Deploy layer

- **Files**: `.github/workflows/deploy-docs.yml`.
- **Implementation**: triggers on push to `main` and `workflow_dispatch`; builds with Node 22 + npm cache, runs `npm run docs:build`, uploads `docs/.vitepress/dist` as a Pages artifact, and deploys to GitHub Pages. See `.github/workflows/deploy-docs.yml:3-6` (triggers), `:26-35` (Node setup + build), `:37-44` (upload), `:46-52` (deploy).
- **Config schema**: the GitHub Actions YAML itself; `vars.CI_RUNNER` selects the runner (`:19`).
- **Protocol files**: none.
- **Copy (文案)**: step names are tool-facing, not user-facing.

### 3.6 Archive layer

- **Files**: `docs/review/structure-audit-2026-10-19.md`, `docs/review/content-review-2026-10-19.md`.
- **Implementation**: raw pasted tool logs and audit records. Excluded from the site route tree by `srcExclude: ['review/**']` at `docs/.vitepress/config.mts:10`.
- **Config schema**: none (not rendered as pages).
- **Protocol files**: none.
- **Copy (文案)**: these are audit/provenance records, not site pages.

### 3.7 Project metadata layer

- **Files**: `README.md`, `README.zh.md`, `OUTLINE.md`, `todo.md`, `LICENSE`, `.gitignore`.
- **Implementation**: READMEs describe the repo and directory tree (`README.md:1-73`); `OUTLINE.md` is the historical writing plan and explicitly defers navigation truth to the sidebar (`OUTLINE.md:1-7`); `todo.md` is the inspection ledger; `.gitignore` excludes `node_modules/`, `docs/.vitepress/dist/`, and `docs/.vitepress/cache/` (`.gitignore:1-3`).
- **Config schema**: none beyond `.gitignore` patterns.
- **Protocol files**: none.
- **Copy (文案)**: README/OUTLINE carry project-facing copy in English and Chinese.

## 4. Why this layering exists (with evidence)

1. **Content is separated from site behavior so the writing and the tooling can evolve independently.** The 57 English pages carry all prose; `docs/.vitepress/config.mts` carries only site behavior. A content-only change never touches `config.mts`, and a theme change never rewrites prose. Evidence: content lives under `docs/*/` (e.g. `docs/language-core/ownership-and-move.md:1`), config lives at `docs/.vitepress/config.mts:7` — two disjoint paths with no overlap in the file list.

2. **The navigation truth is a data file, not a hard-coded page list, so the site can be re-ordered without editing content.** `sidebar.en.json` and `sidebar.zh.json` are imported by `config.mts:3-4` and cast to the sidebar type at `config.mts:63,96`. `OUTLINE.md:3-7` explicitly states the sidebar is the single source of page URLs and that `OUTLINE.md` must not carry a second list.

3. **English and Chinese are split by locale directory rather than by interleaving, so either language can be translated/reviewed without disturbing the other.** `config.mts:19` comments "English lives on the root, Chinese under /zh/"; the ZH tree `docs/zh/` mirrors the EN tree 1:1 (57 files each).

4. **Review/archive records are quarantined out of the published site.** `docs/review/` holds pasted tool logs and audit reports; `config.mts:8-10` sets `srcExclude: ['review/**']` because their relative links resolve outside the doc root.

5. **The build gate is deliberately strict, so a broken link fails the build instead of shipping a silent 404.** `config.mts:17` sets `ignoreDeadLinks: false`; the deploy workflow runs `npm run docs:build` at `.github/workflows/deploy-docs.yml:32` as a mandatory pre-deploy step.

6. **Deployment is declarative in CI rather than manual, because a static site has no long-running process to manage.** The workflow triggers on push to `main` and manual dispatch (`.github/workflows/deploy-docs.yml:3-6`) and uploads the VitePress `dist` as a Pages artifact (`:37-44`), which GitHub Pages then serves — no application server or database is involved.

## 5. Layer summary

| Layer | Responsibility | Representative files (file:line) |
|---|---|---|
| Content | Knowledge pages (English + Chinese mirror) | `docs/language-core/ownership-and-move.md:1`, `docs/glossary.md:18`, `docs/knowledge.md:1` |
| Site config | VitePress metadata, locales, nav, search, dead-link gate | `docs/.vitepress/config.mts:7,17,45` |
| Navigation | Sidebar route truth (both locales) | `docs/.vitepress/sidebar.en.json:3`, `docs/.vitepress/sidebar.zh.json:3` |
| Build | npm scripts, theme entry, readability CSS | `package.json:5`, `docs/.vitepress/theme/index.ts:1`, `docs/.vitepress/theme/custom.css:1` |
| Deploy | GitHub Actions build + Pages upload | `.github/workflows/deploy-docs.yml:3,32,37` |
| Archive | Audit / provenance records, excluded from site | `docs/review/structure-audit-2026-10-19.md:1`, `docs/.vitepress/config.mts:10` |
| Metadata | README, outline, ledger, license, gitignore | `README.md:1`, `OUTLINE.md:3`, `todo.md:1`, `.gitignore:1` |

### 5.1 State storage by layer

| Layer | State storage | Detail |
|---|---|---|
| Content | none | Pure Markdown; no runtime state. |
| Site config | none | Config is read at build time only. |
| Navigation | none | Sidebar JSON is static data, not mutable state. |
| Build | filesystem (ignored) | `docs/.vitepress/dist/` and `docs/.vitepress/cache/` are build products (`.gitignore:2-3`). |
| Deploy | external (GitHub) | GitHub Pages serves the artifact; repo has no database. |
| Archive | filesystem (tracked) | `docs/review/*.md` is committed as provenance. |
| Metadata | none | Files, no store. |

### 5.2 Call surface / who calls whom

- `package.json` scripts → `vitepress` CLI → `docs/.vitepress/config.mts` → sidebar JSON + theme.
- GitHub Actions workflow → `npm run docs:build` → VitePress build → `docs/.vitepress/dist` → Pages artifact.
- Pages → links between Markdown pages (internal relative links) — the only "calls" are hyperlinks, no RPC.
- No Redis / MySQL / in-memory registry / message queue exists anywhere in the tree.

### 5.3 Configuration inputs

- `package.json`: `name`, `private`, `type`, scripts, devDependencies, overrides (`package.json:2-15`).
- `docs/.vitepress/config.mts`: title, description, base, cleanUrls, lastUpdated, ignoreDeadLinks, locales, head, themeConfig, markdown (`config.mts:7-133`).
- `docs/.vitepress/sidebar.en.json` / `sidebar.zh.json`: navigation tree (data).
- `.github/workflows/deploy-docs.yml`: `vars.CI_RUNNER`, node-version, action versions (`deploy-docs.yml:19,27-30`).
- `.gitignore`: ignore patterns (`.gitignore:1-3`).

### 5.4 Lifecycle

1. Author/edit Markdown and sidebar/config.
2. `npm run docs:build` → VitePress renders all pages, enforces `ignoreDeadLinks: false`, emits `docs/.vitepress/dist/`.
3. Push to `main` → workflow builds and uploads `dist` as a Pages artifact → GitHub Pages publishes.
4. `docs/review/` records are written and committed separately, never published.
