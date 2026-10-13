# todo

盘点口径：本仓是纯文档站（VitePress），「实现」= 内容页落盘 + 构建绿（含死链核查）+ Pages 线上 200。
规划底稿 = 根目录 [OUTLINE.md](./OUTLINE.md)（8 个部分知识地图，勾选状态即内容进度）。
期次分批：P1 大纲 + 语言核心 8 页；P2 类型系统 + 内存与并发 + 异步；P3 宏 + 工具链 + 生态工程 + 语言对照。

## 一、P1：站点骨架 + 语言核心 8 页（已完成，2026-10-13 首单）

验收口径（通用）：`npm run docs:build` 绿（含死链核查）+ 代码示例经 `rustc` 真跑 + 官方出处标注（doc.rust-lang.org / std docs / RFC / The Rustonomicon，查不到写「未找到出处」）。

- [x] 仓库骨架：README.md / README.zh.md 双语互链（logo 64×64）、LICENSE、.gitignore、package.json（脚本对齐 hello-*）。验收：新读者按 README 可 `npm ci` + `npm run docs:build` 一次通过。
- [x] 站点骨架：docs/index.md 首页、docs/knowledge.md 知识图谱、8 个分部导览 index.md、.vitepress/config.mts（base `/hello-rust/`、nav/侧栏、`ignoreDeadLinks: false`）、docs/public/logo.svg、favicon 用同一 logo。验收：构建产出 19 个 html（首页 + 知识图谱 + 8 导览 + 8 正文 + 404），dist 内含 `logo.svg`。
- [x] CI：.github/workflows/deploy-docs.yml（Pages 部署，node 22 + npm 缓存，actions checkout/setup-node v7、deploy-pages v5，构建含死链检查）。验收：与 hello-postgresql 现行写法一致。
- [x] GitHub About：英文一句 + Pages homepageUrl。验收：`gh repo view` 可见 description 与 homepage。
- [x] 第1部分 语言核心 8 页（所有权/借用/切片/生命周期/枚举与模式匹配/trait/泛型/错误处理）。验收：全部示例用 rustc 1.99.0 实测，输出粘贴自真实运行；E0382 / E0502 / E0515 / E0184 / E0277 等编译器错误原文均取自真实编译失败；单态化结论以 `nm` 符号表（`p7_mono::id::<i32>`、`id::<&str>`）实证。

## 二、P2：类型系统 + 内存与并发 + 异步

- [ ] 第2部分 类型系统与抽象（trait 对象/泛型约束/associated types/零成本抽象/孤儿规则/impl Trait/运算符重载/闭包）
- [ ] 第3部分 内存与并发（Drop/智能指针/分配器/Send·Sync/无畏并发/交叉编译）
- [ ] 第4部分 异步（async·await/Pin/Futures/tokio 生态/select 与取消）

## 三、P3：宏 + 工具链 + 生态工程 + 语言对照

- [ ] 第5部分 宏（macro_rules/过程宏）
- [ ] 第6部分 工具链（cargo/rustfmt/clippy/rust-analyzer/交叉编译/MSRV）
- [ ] 第7部分 生态与工程（workspace/发布 crates/FFI/嵌入式/wasm）
- [ ] 第8部分 与其他语言对照（C/C++/Go/Java 差异表）

## 四、待巡检

- [ ] 线上抽查：Pages 部署 run success + 首页与深页 curl 200
- [ ] part 目录 URL 是否 200（hello-postgresql 曾出现 `/basics/` 404、`/basics/README` 200 的同款问题；本站已用 `index.md` 落地，需线上确认）
