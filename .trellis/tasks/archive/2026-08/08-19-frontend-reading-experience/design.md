# Technical Design: Frontend Reading Experience & Polish

## 1. Architecture Overview

本设计旨在在**零重型客户端框架**和**纯静态输出**的前提下，为“海边的小卖部”带来出版级的阅读与交互体验：

```text
Markdown Content (Directus / Fixture)
        |
        v
Unified Pipeline (Remark -> Rehype)
  ├─ Mermaid -> Static SVG / Diagram Block
  ├─ Heading Anchor (# Permalink)
  └─ Shiki Syntax Highlighting with Line Metadata
        |
        v
Astro Component Composition
  ├─ PostPage (prev/next derivation, metadata)
  ├─ ArticleShare (link copy, markdown citation)
  ├─ ArticleNavigation (prev/next chronologic cards)
  ├─ CodeBlock / CodeCopyBehavior (badges, expand/collapse)
  └─ ThemeControl (View Transition circular reveal)
```

---

## 2. Component & Module Breakdown

### 2.1 文章上下文导航 (`ArticleNavigation.astro`)
- **数据来源**：在 `PostPage.astro` 或 `getPreparedSite()` 中，对已发布文章按 `publishedAt` 升序排列。
- **定位算法**：找到当前文章索引 `idx`：
  - `prevPost = posts[idx - 1]` （更早发布的文章）
  - `nextPost = posts[idx + 1]` （更新发布的文章）
- **布局设计**：文章尾部双列卡片（桌面端并排，移动端纵向堆叠），展示方向指示标签（“上一篇” / “下一篇”）、发布日期、标题及所属核心话题。

### 2.2 文章分享与 Markdown 引用 (`ArticleShare.astro`)
- **UI 结构**：
  - 复制链接按钮 (`btn-copy-url`)
  - 复制 Markdown 引用按钮 (`btn-copy-citation`)
  - Toast / 行内反馈指示器（带 `aria-live="polite"`）
- **交互实现**：原生 `navigator.clipboard.writeText()`，格式为：
  ```text
  [${post.title}](${currentUrl}) - ${authorName} / ${siteName}
  ```

### 2.3 代码块交互与排版 (`CodeBlock` / `CodeCopyBehavior.astro` & Rehype)
- **语言标签**：Shiki / Markdown 解析时在 `<pre>` 标签注入 `data-language`，CSS 伪元素或顶部栏渲染大写语言徽标（如 `TYPESCRIPT`、`JSON` 等）。
- **超长代码折叠**：
  - 在客户端通过 `CodeCopyBehavior.astro` 扫描代码行数（或构建期标记 `data-lines`）。
  - 若行数 > 35 行，添加 `is-collapsed` 类与底部渐变遮罩。
  - 挂载“展开全部 (N 行)”交互按钮，点击平滑展开；展开后可收起。

### 2.4 Mermaid 架构流程图静态渲染
- **构建期转换**：
  - 在 Markdown 处理管道 `lib/markdown.ts` 中拦截 `code.language-mermaid`。
  - 使用预编译或自包含的高保真静态 SVG 渲染器将其渲染为内联 SVG 图表，支持深/浅色模式自适应。
  - 客户端零 JS 开销，彻底规避浏览器端引入 > 2MB Mermaid 库的性能损耗。

### 2.5 交互微细节与视觉质感
- **圆形扩散主题切换 (Circular View Transition)**：
  - 监听 `#theme-control` 点击事件，获取点击坐标 `(clientX, clientY)`。
  - 若 `document.startViewTransition` 可用，计算到屏幕四角的最大半径 `maxRadius`，执行 `clip-path: circle()` 扩散动画。
  - 若不支持（如部分旧版浏览器），平滑回退为直接修改 `data-theme`。
- **标题锚点 (# Permalink)**：
  - 在 `src/lib/markdown.ts` 中对 `<h2>`、`<h3>` 注入 `<a class="heading-anchor" href="#${id}">#</a>`。
  - 悬停/聚焦时渐显，点击直接复制小节精准链接。
- **目录平滑滚动**：
  - 配置 `scroll-behavior: smooth` 与 `scroll-margin-top: 5rem`，避免顶部浮动 Header 遮挡标题。

---

## 3. Performance & Accessibility (A11y) Verification

- **无 CLS 抖动**：所有按钮与展开区域均预留高度或使用绝对定位。
- **键盘导航**：所有交互元素（复制、分享、展开折叠、主题切换）均具备标准 `tabindex="0"`、`:focus-visible` 外框及可读屏幕阅读器文案。
- **全量回归保障**：通过 `pnpm verify`、Playwright Axe a11y、端到端与单元测试全面把关。
