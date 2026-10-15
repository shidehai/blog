# 自建 CMS 的现有边界与技术核验

核验日期：2026-10-14。本文为规划研究，未连接或修改真实 CMS、数据库或上传文件。

## 仓库事实

- `frontend-v2/lib/content.ts:23` 的模块级 Promise 在进程内保存整份内容；即时发布必须移除这种生命周期，不能仅刷新后台状态。
- `frontend-v2/app/archives/[slug]/page.tsx:18` 和 `frontend-v2/app/writing/[slug]/page.tsx:9` 禁止未预生成的参数；新文章即便进入数据库，也不能凭当前配置在旧构建中出现。分类、系列也有 generateStaticParams，需要一起覆盖。
- `frontend-v2/app/layout.tsx:35` 读取作者和全量文章；Next 客户端导航会复用 layout，不能只考虑服务端缓存。内容相关壳应按导航重新读取，验证预取、后退和刷新行为。
- 卡片、归档、侧栏和搜索只使用文章元数据；正文消费者是文章页及 MarkdownContent。可以将列表契约收敛为 PostSummary，避免把所有文章正文传给客户端搜索菜单。
- `frontend-v2/lib/media.ts` 当前在构建时校验并物化 Directus 图片；新上传媒体不能继续依赖镜像内的 public 目录。
- `directus/database.sql:23` 只允许 published/archived，草稿还在 Directus versions 中。`tests/directus.mjs:526` 和 `:607` 分别覆盖版本草稿和历史修订；只导出 posts 表会漏数据。
- `.github/workflows/publish.yml:7` 用 Directus 事件触发镜像构建。新方案将内容发布与代码部署拆开；需要替换该入口及对应运维契约。
- `scripts/backup.sh:60` 备份整个数据库，`:80` 加入上传目录。采用同库新 schema 可保留整体数据库恢复方式，但迁移期须同时覆盖旧、新媒体根目录。
- 旧规范要求 Directus、构建期读取和无运行时 CMS 配置，见 backend 的 directory-structure/database-guidelines/error-handling，以及 frontend 的 type-safety/quality-guidelines。用户已明确替换架构；保持凭据不进镜像、不泄漏草稿等安全目标，并更新旧机制对应的规则和测试。

## 技术选择及理由

- 首版采用请求时服务端读取，内容 fetch 使用 no-store，内容路由使用动态渲染。同请求可去重；不引入跨请求内容缓存、失效消息队列或 Redis。发布事务提交后的新请求读取新版本。
- 前台仍只访问经过筛选的发布接口，不连接 PostgreSQL。运行时只读服务凭据留在服务端，前台构建不访问 CMS，也不包含凭据。
- CMS 与前台通过共享 Zod 契约交换目录元数据和单篇详情；正文与 metadata 共用同一次详情读取。公开目录不包含 notes、topics 或草稿元数据。
- 独立 CMS 使用 Next.js/TypeScript，数据访问采用 Drizzle + pg；数据库结构由自己的迁移文件控制。CodeMirror 6 提供 Markdown 编辑能力；共享 unified/remark/rehype 管线负责预览与正文渲染、GFM 和 HTML 清理。
- 身份为唯一所有者，采用服务端可撤销会话；密码使用 Node 异步 scrypt，不使用实验性 KDF API。部署前核验参数和并发内存预算；登录限速、CSRF/来源检查属于正常登录实现。

## 一手资料

| 编号 | 官方来源 | 本次使用的事实 |
| --- | --- | --- |
| S1 | `https://nextjs.org/docs/15/app/api-reference/file-conventions/route-segment-config` | force-dynamic 按请求渲染；generateStaticParams 与 dynamicParams 影响新增地址是否能在构建后生成。 |
| S2 | `https://nextjs.org/docs/15/app/deep-dive/caching` | no-store/force-dynamic 可跳过服务端 Data/Full Route Cache；客户端 Router Cache 仍须单独考虑。 |
| S3 | `https://react.dev/reference/react/cache` | React cache 可在一次服务端请求内去重，不作为内容更新后的持久缓存。 |
| S4 | `https://nodejs.org/download/release/v24.15.0/docs/api/crypto.html` | Node 24.15 提供异步 scrypt，支持成本参数，并建议随机且足够长的盐。 |
| S5 | `https://www.postgresql.org/docs/17/transaction-iso.html` | Repeatable Read 为事务内多次读取提供一致快照；发布写入仍需明确锁和冲突处理。 |
| S6 | `https://github.com/drizzle-team/drizzle-orm/blob/main/LICENSE` | Drizzle 仓库许可证为 Apache-2.0；使用其数据访问能力不绑定 CMS 模型或编辑界面。 |
| S7 | `https://orm.drizzle.team/docs/get-started/postgresql-new` | 官方支持 PostgreSQL 连接和 SQL 迁移；当前示例部分使用 rc，实施时核验正式版，不能照抄预发布安装指令。 |
| S8 | `https://raw.githubusercontent.com/codemirror/lang-markdown/main/package.json` | 官方 Markdown 扩展属于 CodeMirror 6，包元数据声明 MIT 许可。 |
| S9 | `https://github.com/rehypejs/rehype-sanitize` | 提供基于允许列表的 HTML AST 清理，MIT 许可；Markdown 渲染不能把原始 HTML 直接送入浏览器。 |

S1—S9 已通过官方网页或官方源码核验。React cache 只用于同一次服务端请求的读取去重；实施时继续验证其调用上下文，不将其当作跨请求内容缓存。

## 执行约束

用户于 2026-10-14 要求仅主会话执行，AI 并发（含主会话）为 1。所有后续研究、实现和验证都由主会话串行完成；不派发 Trellis 或原生子代理，也不通过其他 AI 进程或会话代替。

## 实施前与迁移前核验

- 新依赖在引入时锁定兼容 Node 24、React 19 和现有 ESLint 的正式版本；登记直接依赖与随附字体许可证，不引入收费功能依赖。
- 必须在真实生产构建的运行进程上发布一个构建时不存在的 slug，验证无重建、无重启即可访问；还要覆盖原先 404 的 slug、分类/系列导航、客户端预取与后退。
- 实际内容数量、未绑定 item 的版本草稿、Directus delta 历史可重建性和上传文件完整性，只能由只读源快照盘点得出。迁移工具保留原始历史数据与差异报告，不预先宣称已无损迁移。
- 上传文件先持久化且校验通过，再参与发布事务；公开媒体访问校验当前发布引用。源库中标记私有的媒体不能因为某篇文章引用它就自动公开。
- DESIGN.md 的意图与当前 globals.css 存在差异。新后台沿用实际界面的语义和排版参考，预览使用共享文章样式；本次规划不顺带重写全站视觉系统。

## 运行取舍

即时内容读取意味着内容服务或数据库故障会影响新页面读取。首版用有限超时、明确的不可用响应、健康检查、备份和恢复演练处理；不在故障时返回离线夹具、把错误伪装成文章不存在，或提供可能已撤回的旧内容。
