# hello-rust

<img src="logo.svg" width="64" height="64">

这里记录我在游戏开发中用 Rust 的笔记、实验和踩坑经验，涉及所有权、借用、生命周期、trait、异步、宏与工具链。

**在线阅读**：<https://cuihairu.github.io/hello-rust/>

English document: [README.md](README.md)。

## 本地运行

要求 Node.js 18+（建议 20+）。

```bash
npm ci                # 安装依赖
npm run docs:dev      # 开发模式，热更新
npm run docs:build    # 产出静态站到 docs/.vitepress/dist/（含死链核查，死链即失败）
npm run docs:preview  # 本地预览构建产物
```

> 若 npm 配置了禁用 install scripts（安装时出现 `npm warn install-scripts`），构建如报 esbuild 二进制缺失，执行 `npm rebuild esbuild` 后重试。

## 目录结构

```
docs/
├── index.md            # 首页
├── knowledge.md        # 知识地图
├── glossary.md         # 术语表
├── review/             # 结构与内容审计记录
├── language-core/      # 语言核心（所有权/借用/生命周期/trait/泛型/枚举与模式匹配/错误处理）
├── type-system/        # 类型系统与抽象
├── memory-concurrency/ # 内存与并发
├── async/              # 异步
├── macros/             # 宏
├── tooling/            # 工具链
├── ecosystem/          # 生态与工程
├── comparison/         # 与其他语言对照
├── .vitepress/
│   ├── config.mts      # 站点配置（base / 导航 / 搜索 / 死链门禁）
│   └── sidebar.json    # 侧边栏（全站页面的唯一 slug 清单）
└── public/             # favicon / logo（与根目录同一 logo.svg）
OUTLINE.md              # 历史写作规划；站点导航以 sidebar.json 为准
todo.md                 # 巡检台账：未完成项 / 已完成项与 commit 证据
```

每个主题的入口是该目录下的 `index.md`（主题概览）。侧栏链接与顺序只维护在 `docs/.vitepress/sidebar.json`；修改导航时不要在 OUTLINE.md 另维护一份清单。

## 内容记录方式

- 每页聚焦 **1–2 个核心知识点**，80–200 行，中文正文；内容来自实际使用、实验和资料核对。
- 代码示例**可复现**：片段按所示方式 `rustc`/`cargo` 真跑可过，注释里的输出为真实运行结果。
- 标题层级：每页单一 H1，内文 `##` / `###`，与 hello-postgresql 姊妹站同构。
- 页尾固定两段：`## 相关页面`（站内相对链接，不带 `.md` 后缀，slug 以 `sidebar.json` 为准）+ 官方文档链接一行。
- 事实核验：拿不准的语法/语义对照 [Rust Book](https://doc.rust-lang.org/book/)、[Reference](https://doc.rust-lang.org/reference/)、[std 文档](https://doc.rust-lang.org/std/)、[RFC](https://rust-lang.github.io/rfcs/) 与 [The Rustonomicon](https://doc.rust-lang.org/nomicon/) 核实后落笔；查不到的显式标注「未找到出处」。

## 部署

push 到 `main` 自动触发 GitHub Actions（`.github/workflows/deploy-docs.yml`）构建并发布到 GitHub Pages；也可在 Actions 页手动 `workflow_dispatch`。本仓不发布版本号 release。

## License

[CC BY 4.0](./LICENSE)
