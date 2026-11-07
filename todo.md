# todo

盘点口径：本仓是纯文档站（VitePress），「实现」= 内容页落盘 + `npm run docs:build` 绿（含死链核查）+ Pages 线上 200。
规划底稿 = [OUTLINE.md](./OUTLINE.md)（8 板块知识地图，勾选即内容进度）。示例一律 `rustc`/`cargo` 真跑，官方出处以 doc.rust-lang.org / std docs / RFC / The Rustonomicon 为准，查不到写「未找到出处」。

## P1 站点骨架 + 语言核心（已完成）

- [x] 仓库骨架：README 双语 / LICENSE / .gitignore / package.json —— `0d2dccd`，构建绿
- [x] 站点骨架：首页 + 知识图谱 + 8 导览 + config（base `/hello-rust/`、死链门禁、favicon 用同一 logo）—— `0d2dccd`，产出 19 html
- [x] CI deploy-docs.yml（node 22 + npm 缓存 + 死链检查）—— `0d2dccd`，run success
- [x] GitHub About 英文一句 + Pages homepageUrl —— `0d2dccd`，gh 实测生效
- [x] 第1部分 语言核心 8 页 —— `0d2dccd`，8 页示例全部 rustc 1.99.0 实测
- [x] 线上抽查 + part 目录 200 —— `128bb40`，run 38411752099 success，首页 / 8 导览 / 8 正文 / logo 全 200

## P2 类型系统 + 内存与并发 + 异步（已完成）

- [x] 第2部分 类型系统与抽象 8 页 —— 本批 commit；28 代码块逐块重编译（21 过 + 7 预期报错，错误码一致）
- [x] 第3部分 内存与并发 7 页 —— 本批 commit；41 示例 rustc/cargo 实测 + musl/aarch64(qemu)/windows-gnu/wasm 交叉编译真跑
- [x] 第4部分 异步 6 页 —— 本批 commit；tokio 1.53.2 真跑，RFC 3185 编号核对

## P3 宏 + 工具链 + 生态工程 + 语言对照（已完成）

- [x] 第5部分 宏 2 页 —— 本批 commit；proc-macro 工程重建重跑，输出与报错逐字比对
- [x] 第6部分 工具链 6 页 —— 本批 commit；cargo/rustfmt/clippy/rustup 命令实测
- [x] 第7部分 生态与工程 5 页 —— 本批 commit；workspace/FFI(bindgen)/no_std/wasm 目标实测
- [x] 第8部分 与其他语言对照 4 页 —— 本批 commit；差异表逐项与官方文档核对
- [x] 全站构建门禁 —— 本批 commit；npm run docs:build 绿，57 html，死链门禁过

## 已记录的坑

- 新仓库首次 deploy-pages 报 `HttpError: Not Found`：仓库无 Pages 站点记录，需 `gh api repos/cuihairu/hello-rust/pages --method POST --field build_type=workflow --field source.branch=main --field source.path=/` 创建后重跑；`PUT` 仅用于更新，`source.path` 只能 `/` 或 `/docs`，dist 路径由 upload-pages-artifact 决定。
- VitePress 标题/内联文本里的裸尖括号（如 `## Option<T>`）会被 Vue 当 HTML 标签，构建报 "Element is missing end tag"；须包反引号。`<https://...>` autolink 与代码块内无碍。

## 源码分层分析 2026-11-07

- [x] 英文分层文档已落 `docs/review/source-layer-analysis-2026-11-07.md`（中文版留待下一轮独立任务）

### a) 抽象层清单（每层一行：职责 + 代表模块 file:line）

- 内容层：知识页面（英文 57 篇 + 中文镜像 57 篇）—— `docs/language-core/ownership-and-move.md:1`
- 站点配置层：VitePress 元数据 / locale / 导航 / 搜索 / 死链门禁 —— `docs/.vitepress/config.mts:7,17,45`
- 导航层：侧栏路由真源（双语言）—— `docs/.vitepress/sidebar.en.json:3`、`docs/.vitepress/sidebar.zh.json:3`
- 构建层：npm 脚本 / 主题入口 / 可读性 CSS —— `package.json:5`、`docs/.vitepress/theme/index.ts:1`、`docs/.vitepress/theme/custom.css:1`
- 部署层：GitHub Actions 构建 + Pages 上传 —— `.github/workflows/deploy-docs.yml:3,32,37`
- 归档层：审计/溯源记录，站点路由排除 —— `docs/review/structure-audit-2026-10-19.md:1`、`docs/.vitepress/config.mts:10`
- 元数据层：README / OUTLINE / 台账 / LICENSE / .gitignore —— `README.md:1`、`OUTLINE.md:3`、`todo.md:1`、`.gitignore:1`

### b) 超大文件候选（>1000 行）

无 >1000 行文件（源码最大为 `docs/zh/glossary.md` 与 `docs/glossary.md`，各 508 行）。

### c) 目录/分类不合理处（逐条带 file:line）

未见分类问题。
