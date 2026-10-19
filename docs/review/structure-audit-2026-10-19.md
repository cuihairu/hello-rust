# hello-rust 目录与内容组织审计（2026-10-19）

审计范围：仓库当前工作树；只新增本报告，未修改现有文档或配置。统计口径：`docs/` 下递归 `.md` 文件（不计 `.vitepress/dist` 生成物）；行数按文件换行分行统计，末尾换行计入一行。路径均相对仓库根目录。

## 量化事实

### docs 下一级目录汇总

| docs 下一级目录 | Markdown 数 | 总行数 |
|---|---:|---:|
| async | 7 | 1,159 |
| comparison | 5 | 739 |
| ecosystem | 6 | 823 |
| language-core | 9 | 874 |
| macros | 3 | 421 |
| memory-concurrency | 8 | 1,342 |
| tooling | 7 | 1,057 |
| type-system | 9 | 1,364 |
| docs 根目录（index、knowledge、glossary） | 3 | 651 |
| **合计** | **57** | **8,430** |

### 组织轴盘点

按“读者如何找到内容”的实质结构计，当前有 **2 套并行的主组织轴**，另有页面类型惯例但未形成独立目录轴。

| 组织轴/位置 | 条目数 | 命名规律 | 有无编号 | 编号连续性 |
|---|---:|---|---|---|
| 主题目录：`docs/{language-core,type-system,memory-concurrency,async,macros,tooling,ecosystem,comparison}/` | 8 个主题组、46 篇组内 Markdown（含 8 篇 index） | kebab-case 英文 slug；主题各自目录；各目录有 `index.md` | 文件/目录名没有数字前缀 | 不适用；没有编号文件序列 |
| 部分序：`docs/.vitepress/sidebar.json` | 8 个编号部分，55 个链接（8 个组入口 + 46 个组内条目 + 术语表 1 项） | 中文“第N部分：主题”标签，目标指向主题目录；另有未编号术语表 | 有，编号只存在导航显示标签 | 第1—第8连续，无缺号、重号；证据：`docs/.vitepress/sidebar.json:3-106` |
| 页面角色惯例（非独立轴） | 8 篇主题 `index.md` + 根级首页/知识点整理/术语表 | `index.md` 为各主题导读；根级页面用语义名 | 无 | 不适用 |

本仓没有 `guides/`、`api/`、`history/` 等平行目录，也没有带数字序号的文档文件名。这里的“指南”表现为 8 篇主题 `index.md`，不是另一个散列体系。配置文件是 `docs/.vitepress/config.mts`（仓库中不存在题述的 `config.mjs`），它从 `sidebar.json` 导入侧栏（`config.mts:1-2,36`）。

### 编号检查

- 抽查全部文档文件名及目录名：没有数字前缀编号，故**不存在文件序列的断档、跳号或重复编号**。
- 唯一章节编号在侧边栏标签：第1、2、3、4、5、6、7、8部分；排序连续、无重复（`docs/.vitepress/sidebar.json:3-106`）。
- 不应把正文代码行、Rust 版本号、Rust Book 章节号误算成文档编号；它们不是目录序号。

### 侧边栏对账

对 `docs/.vitepress/sidebar.json` 解析 55 个链接，并以目录 `index.md`、`.md` 页面解析规则对照现存文档：

| 对账类别 | 数量 | 条目 |
|---|---:|---|
| 配置了但文件不存在 | 0 | 无 |
| 文件存在但未进入侧边栏 | 2 | `docs/index.md`（站点首页，通常由首页路由承载）；`docs/knowledge.md`（已在顶栏配置，见 `docs/.vitepress/config.mts:22-34`） |

首页与知识整理页不在侧栏并不自动构成遗漏；这是导航分工。其余主题页、各主题入口和术语表均能由侧栏链接到。检查证据：`docs/.vitepress/sidebar.json:1-108`、`docs/.vitepress/config.mts:22-36`，以及 57 篇文档清单。

### 问题清单（含严重度与证据）

| 严重度 | 发现与判断 | 证据路径 |
|---|---|---|
| 中 | **交叉编译主题分置于两个主题组**：一篇偏概念、一篇偏操作，拆分本身有理由，但读者可能不清楚边界；应补明确互链/边界说明，不必立即合并。 | `docs/memory-concurrency/cross-compilation.md`；`docs/tooling/cross-compilation-practice.md`；侧栏分别列于 `docs/.vitepress/sidebar.json:43,78` |
| 低 | **命名语种/大小写混用**：文件 slug 一律小写英文 kebab-case，但概念词保留 `tokio`、`async` 等英文；侧栏展示同时出现 “associated types”“impl Trait”“Drop”“Send”“Rust vs Go”“第N部分”等格式。它提高风格不齐感，未造成路径歧义。 | `docs/type-system/associated-types.md`；`docs/type-system/impl-trait.md`；`docs/memory-concurrency/drop-and-destructors.md`；`docs/.vitepress/sidebar.json:18-29,33-44,94-101` |
| 低 | **顶层分组语义不完全互斥**：`Send/Sync` 在并发主题详述，异步中的 `Send` 又在 async 专页讨论；二者分别解决通用线程安全与 future 跨 await 约束，属于合理交叉，但索引应帮助读者选入口。 | `docs/memory-concurrency/send-and-sync.md`；`docs/async/async-send-and-async-trait.md`；`docs/.vitepress/sidebar.json:41,56` |
| 低 | **顶层非主题 Markdown 不同处导航**：`knowledge.md` 不在侧栏，但在顶栏；首页也不在侧栏。对账有未入侧栏文件 2 项，当前均有合理导航方式，并非死页面。 | `docs/knowledge.md`；`docs/index.md`；`docs/.vitepress/config.mts:22-34` |
| 低 | **根目录有多份用途不同的 Markdown**：`README.md` 与 `README.zh.md` 是必要的双语入口；`OUTLINE.md` 是规划目录，`todo.md` 是执行/完成记录。它们不是 docs 内容副本，但四个入口用途容易混淆，README 的结构说明与 OUTLINE/todo 部分重叠。 | `README.md:1-20,24-46`；`README.zh.md:1-40`；`OUTLINE.md:1-4`；`todo.md:1-4` |

### 链接与根目录核查

- **死链：未核实（构建未能运行）**。执行 `npm run docs:build` 返回 `sh: 1: vitepress: not found`，本工作树未安装依赖。`docs/.vitepress/config.mts:12` 配置 `ignoreDeadLinks: false`，且 `README.md:18` 说明构建包含死链门禁；`todo.md:27` 记录过历史构建通过，但不能替代本次构建验证。
- **静态侧栏文件目标检查：已核实**，55 个 sidebar 链接均能映射到现存 Markdown，0 个配置失效；这不是对正文 Markdown 链接的完整替代检查。
- **正文相对链接：未核实**。当前未能执行 VitePress 链接校验；不可据此断言全站死链为零。
- **非 docs 的 Markdown 文件：4 个**，分别为 `README.md`、`README.zh.md`、`OUTLINE.md`、`todo.md`。根目录另有 `package.json`、`package-lock.json`、`LICENSE`、`logo.svg`，均为项目/站点所需文件，不属于临时杂物。
- **重复 README：**存在英文与中文两份 README，但二者互相链接（`README.md:9`、`README.zh.md:9`），是明确的双语版本，不是重复副本。
- 当前 `rg --files` 未发现命名为 tmp/temp/backup 的临时 Markdown；未将生成目录 `docs/.vitepress/dist/` 中 HTML 算入源文档统计。

## 判断与推荐

整体不是“文档目录失控”：实际内容只有 8 个主题组、57 篇文档，主题组都与侧栏第1—8部分一一对应，文件命名稳定，主题入口齐全，侧栏目标全部存在。造成“乱”的主要感受来自**章节序号（阅读顺序）与主题目录（知识分类）并行呈现**，再叠加少量跨主题内容与导航命名风格差异。

- 现有主轴：**2 套**（编号部分序、主题目录分类）。推荐收敛为**1 套主轴：主题分类**，主题目录作为唯一稳定 URL 和信息架构；侧栏保留 1—8 阅读顺序作为导航排序/可选标签，不把编号写入文件名或 URL。这样保留循序学习路线，同时章节重排不制造路径迁移与外链风险。
- 页面角色（首页、主题 index、知识地图、术语表）是必要导航类型，作为主题主轴的补充保留，不应硬并入主题目录。
- 交叉编译两篇先说明“概念/实践”分工、互链；只有内容确实大量重复时再合并。Send/Sync 与 async Send 是不同问题层次，保留两页并做双向导流。

### 其实不乱、不用动

1. 8 个主题目录与侧栏八部分一一对应，目录名采用一致 kebab-case；无需因“太乱”改名或合并目录。
2. 各主题均有 `index.md` 导读；这与平铺长列表相比更易分层。不要删除主题导览页。
3. 第1—8部分编号连续，当前没有文档文件编号断档/重号；不要为填补不存在的编号问题重排章节。
4. 侧栏目标全存在；`knowledge.md` 已在顶栏、首页由站点根路由承载，不必为了侧栏数字“清零”重复添加。
5. README 双语、OUTLINE 规划、todo 执行账用途不同；保留双语 README 与项目记录，最多厘清 README 对 OUTLINE/todo 的入口说明。

## 三期收口方案

| 阶段 | 动作清单 | 影响范围 | 风险（链接/搜索/外链） | 用户拍板 |
|---|---|---|---|---|
| 一期：机械整理，目标 1 小时内且不改链接 | 统一侧栏标签大小写/中英文格式（按术语约定）；在两篇交叉编译文章与 Send/Sync 两篇间补“适用范围/继续阅读”互链；README 明确 OUTLINE 与 todo 分别是什么；依赖安装后运行构建死链门禁并记录结果。 | `docs/.vitepress/sidebar.json`、4 篇关联文档、README；构建验证 | 标签和正文提示不改 URL，低风险；链接补充需通过构建；搜索可发现性略提升。 | **标签风格标准需用户拍板**；若仅采用不改变含义的大小写统一可由维护者决定。 |
| 二期：侧栏与重定向 | 评估并调整 sidebar 分组/排序；若决定把某篇跨主题内容迁移到新主题或新 slug，保留旧 slug 的重定向/兼容页；构建并验证旧链接。 | `sidebar.json`、可能新增兼容页/重定向配置，受影响主题页 | 仅重排侧栏不破链接；改 slug 会影响站内链接、搜索索引、书签与外链，须有重定向和构建验证。 | **必须拍板是否重分组、是否改 URL，以及兼容期长短。** |
| 三期：删/并章节的深度重构 | 对照页面正文与 OUTLINE，审查重复内容；仅在重复确证后合并交叉编译或其他章节，更新所有入链、知识地图、侧栏、规划记录，并保留迁移映射。 | 内容页、`knowledge.md`、主题 index、sidebar、OUTLINE/todo；可能影响对外 URL | 高影响：删页/换 slug 会损害搜索收录、历史书签与外链；需重定向、全站链接检查及发布后抽查。 | **每一项删页、并章、改 URL 均必须用户拍板。** |

## 结论：最该先做的三件事

1. **先装依赖并重跑 `npm run docs:build`**，取得当前死链/构建事实（审计不能用历史 `todo.md` 记录替代）。
2. **保持主题目录和 URL 不动**，为交叉编译“概念 vs 实战”及通用 Send/Sync vs async Send 补边界说明与双向链接。
3. **统一侧栏展示标签的大小写与中英术语风格**，保留第1—8阅读顺序，并让目录主题分类继续作为唯一内容归属轴。
