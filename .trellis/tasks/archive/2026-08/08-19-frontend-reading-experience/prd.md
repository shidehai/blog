# Product Requirements Document (PRD)

## 1. Background and Objectives

"海边的小卖部" 是一份面向高密度工程与系统思考的个人中文技术期刊。为了让读者的阅读、查阅、引用体验达到专业出版级质感，本任务集中增强 5 项高价值的前端阅读体验与视觉交互能力：

1. **文章上下文与时序连贯性（Prev / Next Navigation）**：提供基于时间序的上一篇/下一篇导航与所属主题序列线索。
2. **文章分享与 Markdown 引用（Share & Citation）**：提供一键复制文章链接与标准 Markdown 引用文本。
3. **代码块体验打磨（Code Block Ergonomics）**：语言常驻徽标、重点行高亮、超长代码块半折叠与展开。
4. **Mermaid 架构流程图构建期静态渲染**：支持在 Markdown 中直接编写 Mermaid 流程图并编译为内联 SVG，保持 0 客户端 JS 运行时。
5. **交互微细节与视觉质感（View Transitions & Headings）**：主题切换时的扩散波纹动画、正文标题悬停 `#` 锚点链接与目录平滑滚动。

---

## 2. User Stories & Acceptance Criteria

### US-1: 文章上下文与前后篇导航
- **As a** 读者
- **I want to** 在读完一篇文章后直接点击“上一篇”或“下一篇”
- **So that** 我可以连续沉浸式阅读，而无需退回列表页。
- **Acceptance Criteria**:
  - `PostPage.astro` 底部渲染“上一篇 / 下一篇”卡片（若存在）。
  - 时序严格符合文章发布时间序（上一篇为更早发布，下一篇为更新发布）。
  - 支持键盘导航聚焦与语义化无障碍标签。

### US-2: 文章分享与 Markdown 引用
- **As a** 读者 / 开发者
- **I want to** 一键复制当前文章的链接或 Markdown 引用格式
- **So that** 我可以方便地在笔记软件（Obsidian/Notion）或即时通讯工具中分享。
- **Acceptance Criteria**:
  - 提供“复制链接”与“复制引用”按钮。
  - 引用格式为：`[文章标题](URL) - 关山 / 海边的小卖部`。
  - 复制成功后提供 2 秒的视觉反馈（“已复制”）与 `aria-live` 读屏通知。

### US-3: 代码块细节打磨
- **As a** 开发者读者
- **I want to** 清晰看到代码语言标识、重点高亮行，且超长代码块不阻塞页面阅读
- **So that** 阅读代码时结构更清晰。
- **Acceptance Criteria**:
  - 代码块右上角显示大写语言徽标（如 `TYPESCRIPT`、`BASH`、`PYTHON` 等）。
  - 超长代码块（> 35 行）默认半折叠并带有底部半透明渐变蒙层，提供“展开全部 (N 行)”交互，展开后支持“收起”。
  - 复制按钮与语言标签和谐布局。

### US-4: Mermaid 架构图构建期静态渲染
- **As a** 作者与读者
- **I want to** 在 Markdown 中使用 ````mermaid` 绘制时序图/流程图并在页面上直接展示
- **So that** 复杂系统架构一目了然，且站点依然保持零运行时开销。
- **Acceptance Criteria**:
  - 在构建阶段将 Mermaid 代码块静态转换为 SVG 并内联渲染。
  - 支持暗黑模式与浅色模式下的配色适配。
  - 客户端无需引入任何庞大的 mermaid.js 运行时。

### US-5: 交互微细节与视觉质感
- **As a** 读者
- **I want to** 在切换深浅色模式时体验平滑过渡，并在标题处方便地获取小节链接
- **So that** 整体视觉体验精致且现代。
- **Acceptance Criteria**:
  - 主题切换按钮点击时，若浏览器支持 `document.startViewTransition`，则呈现自点击坐标向外扩散的圆形动画；不支持则直接无缝切换。
  - 正文 `<h2>` / `<h3>` 标题在悬停或聚焦时显示 `#` 锚点链接，点击可复制小节锚点链接。
  - 目录（TOC/Outline）点击跳转平滑滚动对齐。

---

## 3. Constraints & Non-Goals

- **保持 0 重型客户端框架**：不引入 React / Vue / Svelte 运行时，所有交互均基于原生轻量 TypeScript。
- **保持纯静态构建优势**：Mermaid 必须在构建期或纯 CSS/SVG 处理，禁止向客户端打入数 MB 的 mermaid 运行时包。
- **无障碍（A11y）合规**：所有新增交互需通过 Playwright Axe a11y 自动化测试。
