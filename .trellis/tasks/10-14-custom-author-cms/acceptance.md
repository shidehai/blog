# 本地实现与验收记录 — 2026-10-14—15

用户已批准实施和本地切换，明确尚未远程部署。所有工作由主会话串行完成，AI并发1；没有子代理、委派、提交、推送或远程部署。本地日常写入来源已切换到新 CMS；任务保留 in_progress 如实记录未覆盖的原生浏览器验收。

## 已实现

独立 Next.js 单作者后台；scrypt/可撤销会话/来源校验/登录限速；Markdown
CodeMirror 编辑及共用 GFM 实时预览；自动保存、乐观锁冲突、历史草稿恢复；
上传/粘贴/拖拽处理器、媒体库、alt/封面/引用；分类、标签、系列、站点资料、
随记和专题管理；草稿与发布快照分离、原子幂等发布/撤回、旧地址映射；运行时
发布读取、搜索摘要、受控媒体、generation 刷新；完整迁移/导出/恢复工具及运维配置。

后台视觉为温暖中性色、衬线标题和朱红发布操作。桌面并排编辑/预览；手机明确
切换编辑/预览。实际长标题不截断，横竖图比例正确，媒体选择器无横向溢出。

## 检查结果

| 检查 | 结果与证据 |
| --- | --- |
| 根 pnpm verify | 本地切换轮已整条通过；清理续轮分别运行全部组成检查并通过，未把首次失败的整条命令计为成功 |
| CMS 续轮检查 | 清理后类型、lint、7个测试全部通过，无skip；生产build和工具打包通过 |
| frontend-v2 verify | 清理后类型、lint、fixture/Markdown/运行时环境自检及生产build通过 |
| 根 pnpm lint | 最终两个应用和根脚本通过 |
| operations | tests/ops/run.sh、Compose渲染、Caddy验证通过 |
| Docker镜像 | 清理后两个应用镜像重新构建，构建上下文不含环境文件/持久数据；非root只读烟测及真实本地运行通过 |
| CMS镜像独立账号 | 迁移/登录/Sharp上传/私有404/发布200/完整export+verify通过；legacy sentinel SELECT拒绝 |
| 镜像秘密边界 | 两个镜像config/history/layers扫描通过；构建本身没有使用任何秘密 |
| 生产进程即时发布 | 全新且原404地址、列表/分类/系列/搜索摘要、草稿隔离、更新/归档/媒体撤销、故障503通过；build IDs/PIDs不变 |
| 浏览器写作 | 上传按钮、媒体库+alt、PNG截图粘贴、自动保存/刷新恢复、多标签页409保留文本与重载流程已操作通过 |
| 最终浏览器回归 | 原404→归档→后台发布→后退显示完整文章→前进归档4篇→后退正文正常；图片实际加载 |
| 最终响应式确认 | 1440×1000、390×844；长标题无裁切、手机编辑按钮选中、预览/媒体库、导航inert/Escape正常 |
| 独立恢复 | 最终CMS镜像实际导入源快照，在另一个空库恢复；27内容/33修订/3实际文件重新导出与原包逐项一致，包含SVG原件和raw archive；宿主独立恢复也通过 |
| SVG文字 | 修复镜像缺字体和只读缓存路径；Latin/中文字体匹配与像素检查通过，实际源SVG显示副本文字目视可读；字体许可和原字体版权记录包含在镜像内 |

切换前验证镜像（历史证据，现已退役）：blog-site:author-cms-test；blog-cms:author-cms-history-test。
镜像内保留第三方许可和native库README说明，最终镜像运行/秘密扫描再次通过。
切换前CMS config digest：sha256:8e1162ef7e08a357a0080744d86a23f7e8741dc97fbbf4371833fc5eabc6c869。
切换前CMS manifest list / 本机image ID：sha256:8a5d3ccf881c0dd4e9fce382da90ce92f3bc3e93d98cecc32d025dc9283ff750。
运行证据：research/runtime-evidence.json；恢复证据：research/recovery-evidence.json。
镜像扫描的合成marker没有在构建时使用，不能把扫描表述为曾使用真实秘密的构建验证。

## 源迁移差异

只读源快照：16 posts、6 topics、28 posts_topics、2 files、0 versions、75 revisions、95 activities。
新目标：27 contents、33 revisions、9 aliases、2 media、35 mappings、1 raw archive；
导出包含3实际文件（含SVG原件）。补回5个有明确删除证明、字段可重建的专题至
私有归档；原有22条内容的草稿/发布投影、公开地址和媒体引用未变。

切换前隔离核验时，源快照校验未变、旧源容器未被写入/停止。后续本地切换已停止旧 Directus 并取得最终快照，见下方完成记录。原69条差异中补回5条，剩64条修订：
21条posts缺关系快照（含5条已删除posts）、34条只有ID的关联历史、9条站点
资料历史。另发现4条social_links删除活动，涉及2个缺原字段快照的链接。
最新limitations=68，readyForCutover=false，均保留原档案；75条修订和20条
无对应修订的活动有逐项处置记录。完整恢复不代表这些历史均可后台一键恢复。

逐项报告：research/history-reconciliation.json。差异取舍与正式切换准备：
cutover-review.md。没有将缺失关系从当前值或fixture补齐，没有自动清空差异。
SVG原件/WebP字节保持不变；固定运行环境的PNG显示副本完整导出恢复，跨环境
字体/渲染器造成的PNG差异已明确记录。

## 初始轮未执行的操作验收（后续补充见下方）

- 原生拖拽真实文件的浏览器事件：处理器已实现，共用上传路径已验证；尚未通过浏览器工具实际拖入文件。
- 真实失焦/重新聚焦、显式预取缓存的独立场景：handler/禁用预取已实现；最终确认覆盖导航、pageshow、前进后退及旧404，未把上述场景计为已实际操作。
- 未对发布结果未知时断网等所有交互分支做真实浏览器故障注入；API幂等/回滚、冲突和不确定结果锁定逻辑已检查。
- 用户对美观效果的最终审阅；未来远程环境的部署和对应冻结对账。本次本地切换已完成。

## 预览与截图

原隔离预览在2026-10-15续轮检查时两项healthz均为200，现已正常结束，`author_cms_test` 数据及原证据保留。当前同一入口由持久 `blog-local` 环境提供：CMS http://localhost:4322，博客 http://localhost:4321。
旧合成预览密码不适用于新日常账号；新随机所有者密码只保存在 `.data/local-cms/owner-password.txt`。编辑地址见旧 research/runtime-evidence.json，仅代表旧预览，不能用于推断新内容库。
完整质量门禁使用 `author_history_checks_1014_test`，没有重置原预览库或新的日常 `blog_author` 数据库。

截图根目录：/home/sdh/.codex/visualizations/2026/10/14/01a139b2-da51-7a33-b451-9be3f0f0b7c1/

- cms-editor-wide.jpg：1440桌面编辑/实时预览。
- cms-editor-mobile.jpg、cms-preview-mobile.jpg：390手机编辑/预览。
- cms-content-list.jpg、cms-media-mobile.jpg：内容列表/媒体选择器。
- cms-conflict.jpg：已操作的过期编辑冲突。
- blog-after-publication.jpg：从原404返回后显示已发布文章。

## 本地切换完成 — 2026-10-15

作者明确本次为本机切换，并接受已列明的旧历史原档案处置。最终冻结源 SHA256 为 ae41cd55b4cf590341a45cb53564e3c688bed1733a84b07dc9bd53f22763d46c；全部源表与此前审阅数据一致，最终报告的 68 条 limitations、地址及媒体校验和逐项相同。保留 `readyForCutover=false` 原报告，另记人工接受结果。

旧本地 Directus 已停止，旧库/卷保留；同一窗口备份 DB、源 JSON 和 uploads。用固定镜像和受限 blog_cms 角色导入新的持久 `blog_author`，27 条内容、33 个修订及三个实际文件在另一个空数据库恢复/重导出完全一致。

实际本地 HTTP 验证覆盖所有 9 篇原公开文章及 writing 308、公开图片原字节、私有图片 404、登录和未认证/reader 的后台拒绝。新建此前404地址，发布后详情/首页/列表/搜索 catalog立即更新；新草稿不影响公开版，再发布更新、归档撤回均通过，期间镜像/PID/启动时间不变，无构建或重启。原公开 catalog 完全不变，验收文章仅保留归档。

切换后当前为28 contents / 37 revisions / 10 aliases，包含1篇归档验收文章及其历史；已另导出完整内容包和新库 custom dump并验证。备份位于 `.data/backups/local-cutover-20261015-095257/`。日常使用 `pnpm local:up/down/status/logs`，环境文件已忽略且0600；详细证据见 research/local-cutover-evidence.json。

本轮最终 `pnpm lint`、`pnpm typecheck`、完整 `pnpm verify` 通过，其中 CMS 测试7项且零跳过。生产/源码开发/本地 Compose 与 Caddy、当前真实本地配置验证通过。后台登录页已在应用内浏览器实际打开；未重新宣称原生拖拽、聚焦或预取覆盖。

## 旧平台清理完成 — 2026-10-15

当前博客和后台已换为 `blog-site:local-cms` / `blog-cms:local-cms`，本地固定 ID 和详细检查见 `legacy-cleanup.md`。旧平台源码、SDK、配置、命令、测试及构建适配已移除，备份/恢复改用 CMS 实际媒体；离线历史转换、原始档案及其回归保留。

两套旧数据库、上传文件、旧源码/配置和当前 CMS 均已保存受保护恢复备份，之后移除 4 个旧容器、2 个卷、4 个网络、14 个旧镜像与五个旧数据目录。日常与独立测试库保留，其他项目资源未改动。最近完整备份为 `.data/backups/legacy-cleanup-20261015-103907/`。

新镜像 smoke、真实读取令牌的镜像扫描、运行文件树旧 SDK/环境文件检查及本地 Compose 检查通过。真实本地登录、9 篇原文章、9 个旧地址跳转和两种媒体可见性均正常。28 条内容、37 条修订、历史映射、原档案、Markdown 及 3 个实际媒体文件与清理前备份完全一致。证据见 `research/legacy-cleanup-evidence.json`。原生浏览器覆盖缺口和原报告 68 项限制保持原记录。

## 交付边界

2026-10-15 本地上线准备补齐后的最新结果见 `research/launch-preparation-20261015.md`：247 项生产依赖审计零命中；两个 Node 24.22 最终镜像 high/critical 零命中，真实令牌检查及 smoke 通过；SEO、分享图、本地字体和手机导航完成。可信 CDP 文件拖入、真实 focus/visibility、旧 404 前进/后退及 RSC transport 均有浏览器证据；仍不将其表述为文件管理器物理拖拽或已填充客户端预取缓存。

持久本地应用已更新，28 内容/37 修订/3 实际媒体文件与最新冻结备份完全相同，9 个原文章/旧地址、账号和媒体边界正常。最新 custom dump 在独立新库恢复并重导出一致，所有者密码哈希保留；临时演练库已删除。日常 PostgreSQL 没有重建或恢复。当前完整备份指针为 `.data/local-cms/launch-backup-path.txt`，此前归档保留。任务仍保留 in_progress 供作者审阅和后续正式部署，不能再将已修复依赖审计或已补齐聚焦场景列为当前阻断。

全部产品修改未提交，留给用户审阅；不运行会自动提交的Trellis archive/add_session。
保留原有workspace日志及pelican-airplane-candy-puzzle.svg；这两类不是本任务产物。
正式部署流程、恢复与切换条件见docs/operations/；日常写作见docs/authoring.md。
