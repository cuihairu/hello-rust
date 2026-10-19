# hello-rust 结构改动内容复核（2026-10-19）

## 复核范围

先执行 `git fetch origin && git pull --rebase origin main`，结果为 `Already up to date`，工作区初始干净。复核实际最近四个提交（`git log --oneline -4`）：

- `d019aba` Align docs with personal notes scope（C：个人笔记口径与目录/侧栏标签调整）
- `a4b9d84` Clarify cross-topic note perspectives（B：跨主题说明和互链）
- `b3a2b35` Clarify sidebar navigation source（A：OUTLINE 声明导航真源）
- `0fcf254` Add structure audit report（结构审计报告）

`git diff HEAD~4..HEAD --stat` 涉及 18 个文件，191 行新增、47 行删除。仓库没有 `SUMMARY.md`；该项不适用。复核中另发现上述结构审计报告自身的问题，已分别用后续独立提交修正：`ad47432`、`7e6a10d`，未改写被复核历史。

## 四项核查结论

### 1. 内容丢失：未发现正文内容丢失

**结论：**没有删除 Markdown 文件，也没有发现被删正文段落未迁移。删除内容是两条已过时的规划清单，所列主题都仍有对应正文和导航入口。

- 前：`docs/type-system/index.md`（`d019aba^`）列“规划中：trait 对象、泛型约束、associated types、零成本抽象、孤儿规则与 newtype、impl Trait、运算符重载、闭包与 Fn 家族”。后：现文件 [docs/type-system/index.md:1-8](../type-system/index.md) 改为主题概览和相关链接。上述页面均仍列于 `docs/.vitepress/sidebar.json:22-29`，例如孤儿规则、新类型和闭包条目仍在侧栏。
- 前：`docs/memory-concurrency/index.md`（`d019aba^`）列“规划中：Drop、Box/Rc/Arc/RefCell、分配器、Send·Sync、std::thread 与 channel、交叉编译”。后：现文件 [docs/memory-concurrency/index.md:1-9](../memory-concurrency/index.md) 改为概览和相关主题链接；对应内容仍由 `docs/.vitepress/sidebar.json:37-43` 的 Drop、智能指针、内部可变性、分配器、Send/Sync、线程与 channel、交叉编译条目承载。
- `git diff --diff-filter=D HEAD~4..HEAD --name-only` 为空；上述两处被删除文本是过时的待写清单，不是正文内容。

SUMMARY 精简检查不适用：仓库没有 `SUMMARY.md`，且没有发生同类摘要文件大幅精简。

### 2. 表述与数字：发现两处审计报告错误，均已修

**结论：**README 的目录枚举与实际目录一致；“个人笔记/游戏开发者视角”改写没有改变 Rust 技术含义。结构审计报告有两处可证实的问题，已修复并推送。

- README 前后对比：`README.zh.md` 原第 5 行称“Rust 知识手册”，现为 [README.zh.md:5](../../README.zh.md:5)“个人 Rust 学习笔记、实验与心得，从游戏开发者视角记录……”。英文对应为 [README.md:5](../../README.md:5)。变化是内容定位，不涉及某项 Rust 特性的支持/限制；逐条检查本批改写句，未发现技术含义反转。
- 目录数字核对：两份 README 的目录树见 [README.zh.md:26-45](../../README.zh.md) 与 [README.md:26-45](../../README.md)。实际有 8 个主题目录，另有 `review/`、`.vitepress/`、`public/`；内容 Markdown 为 54 篇主题组文件（8 个 index + 46 篇正文）及根目录 3 篇，共 57 篇。审计记录目录中另有结构审计和本复核两篇，因此目前 `docs/` 下总数为 59 篇。README 没有声称文档篇数或总目录数，目录列项均存在。
- **问题 1（中）：**结构审计报告旧版 `docs/review/structure-audit-2026-10-19.md` 第 28 行把“46 篇正文”误写成“46 篇组内 Markdown（含 8 篇 index）”，且第 3、20、49 行的统计口径未排除 review 报告，存在漏计/口径不一致。现 [结构审计报告:3,20,28,49](./structure-audit-2026-10-19.md) 明确不计 `docs/review/`，修正为 54 篇主题文件、57 篇内容文档、8,377 行。**已修：`ad47432` Correct structure audit counts。**
- **问题 2（中）：**该审计报告旧第 63、65 行称构建失败且正文链接未核实，旧第 131 行却称 `pnpm docs:build` 通过、死链为 0，结论冲突。现 [结构审计报告:63-65,131](./structure-audit-2026-10-19.md) 说明先 npm 失败、后 pnpm 成功，并统一标为构建门禁已核实。**已修：`7e6a10d` Resolve audit verification status conflict。**

### 3. 链接与导航：检查项通过，完整正文链接本轮未独立复跑

**结论：**侧栏目标均存在且无重复；本批新增的四条跨主题链接都指向主题匹配的页面。VitePress 完整链接校验在仓库既有记录中显示通过，但本轮没有重新执行构建。

- 侧栏前后对比：`docs/.vitepress/sidebar.json` 仅将八个组名从“第 N 部分：主题”改为主题名，`link` 和 `items` 未变（见 [docs/.vitepress/sidebar.json:1-108](../.vitepress/sidebar.json)）。本轮递归解析 55 个链接：55 个目标存在、55 个唯一目标、0 个失效。
- 新增链接逐一人工核对：
  - [docs/memory-concurrency/cross-compilation.md:5](../memory-concurrency/cross-compilation.md) → `../tooling/cross-compilation-practice`：目标是本机命令与产物实测页，主题相符。
  - [docs/tooling/cross-compilation-practice.md:5](../tooling/cross-compilation-practice.md) → `../memory-concurrency/cross-compilation`：目标讨论 target triple 和构建原理，主题相符。
  - [docs/memory-concurrency/send-and-sync.md:5](../memory-concurrency/send-and-sync.md) → `../async/async-send-and-async-trait`：目标是 Future 跨 `.await` 的 Send 约束，主题相符。
  - [docs/async/async-send-and-async-trait.md:5](../async/async-send-and-async-trait.md) → `../memory-concurrency/send-and-sync`：目标是一般类型的 Send/Sync 推导和安全承诺，主题相符。
- 原 `link` 未改，只变更侧栏标签；八个主题 H1 同步移除编号。README 声明的 `glossary.md`、`review/` 和八个主题目录均存在。
- **未独立核实：**本轮未重跑 `pnpm docs:build`，因此全站 Markdown 链接的构建检查仅引用结构审计报告已有的通过记录（`structure-audit-2026-10-19.md:131`），不是本轮新产生的构建证据。

### 4. 不适用项与待拍板事项

**结论：**本批没有删并页面、改 slug 或移除侧栏目标；未发现需要用户决定的内容取舍，因此暂无须用户拍板事项。跨主题页面各自保留，新增范围说明和互链，没有合并或删页。

## 问题清单

| 严重度 | 问题 | 处理状态 | 修复提交 |
|---|---|---|---|
| 中 | 结构审计报告把正文数量写错并漏计 review 范围 | 已修复并 push | `ad47432` |
| 中 | 结构审计报告中的构建/链接核验结论相互矛盾 | 已修复并 push | `7e6a10d` |

## 验收结论

复核对象本身未发现正文内容丢失、技术含义改反、侧栏失效目标或新增链接主题错配。结构审计报告中的两处事实/口径错误已经独立修复并推送。README 和主题组织调整可视为已验收；若要求本轮重新取得全站链接构建证据，则仍未核实这一项，现有报告中的成功记录不是本轮重跑结果。
