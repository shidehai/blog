# Frontend V2 Prototype (独立前端高保真原型)

本项目是完全脱机、零后端依赖的 **独立高保真前端原型工程**（基于 Next.js 15 App Router + Tailwind CSS）。

无需启动任何数据库或 Directus CMS，所有原型数据均由本地内存夹具直接驱动，适合进行快速原型设计、排版微调与交互验证。

---

## 🚀 启动原型

在根目录下运行：

```bash
pnpm dev:v2
```

或者直接进入 `frontend-v2` 目录运行：

```bash
cd frontend-v2
pnpm dev -p 4322
```

浏览器访问：**[http://localhost:4322](http://localhost:4322)**

---

## 🎨 页面与路由矩阵

- **🏠 博客首页**：`app/page.tsx` (`/`)
- **📚 文章归档列表**：`app/writing/page.tsx` (`/writing`)
- **📖 文章深度阅读页**：`app/writing/[slug]/page.tsx` (`/writing/production-llm-reliability-boundaries`)
- **📝 随记碎片流**：`app/notes/page.tsx` (`/notes`)
- **🧭 知识专题矩阵**：`app/topics/page.tsx` (`/topics` & `/topics/[slug]`)
- **👤 关于作者**：`app/about/page.tsx` (`/about`)
- **⌨️ 极客搜索浮窗**：`components/CommandMenu.tsx` (快捷键 `⌘K` 或 `Ctrl+K`)

---

## ✏️ 如何修改原型数据 (Mock Data)

所有原型数据集中存放在 **`lib/fixture.ts`**：

1. **修改作者信息 / 标语**：编辑 `FIXTURE_SETTINGS` 对象。
2. **新增/修改文章**：在 `FIXTURE_POSTS` 数组中添加或编辑对象（支持完整 Markdown 内容、代码块、引用、表格）。
3. **新增/修改专题**：在 `FIXTURE_TOPICS` 数组中配置。
4. **修改社交链接**：在 `FIXTURE_SOCIAL_LINKS` 数组中修改。

修改后，Next.js 会自动热重载（Fast Refresh），无需重启服务即可即时看到效果。

---

## 📦 如何完全独立导出此原型

`frontend-v2` 目录具备完整的 `package.json`、`tsconfig.json` 和依赖定义。
如需将此原型单独作为独立 Git 仓库开发，只需将 `frontend-v2` 文件夹复制到任意位置，执行 `pnpm install && pnpm dev` 即可独立运行。
