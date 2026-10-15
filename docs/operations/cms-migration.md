# 从 Directus 迁移到青山写作

2026-10-15 已完成本地切换并按作者要求移除旧平台程序、SDK、配置与本地服务。旧数据、媒体和历史差异报告保存在受保护备份中。本文保留离线快照转换与历史核验方法，不能在当前写作库重新导入源快照；远程环境尚未部署。

## 源快照

临时停止旧后台写入，创建可恢复的数据库备份及媒体副本；数据库内容和文件必须对应同一冻结窗口。`source-export` 以 repeatable-read 只读事务导出 posts、topics、分类/标签/系列、关系、站点资料、文件元数据、versions、revisions 和最少活动信息，不导出用户、密码或会话表。

```sh
pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/transfer.mts source-export /protected/source.json
```

该命令额外需要只读 `SOURCE_DATABASE_URL`。也可在源数据库用 `scripts/source-snapshot.sql` 生成同格式 JSON。用文件复制保存原 uploads，不能修改源媒体。源快照和历史正文仍是私有资料。

## 隔离导入与报告

先在隔离数据库创建 role/schema 并 migrate；设置目标 `DATABASE_URL`、新的 `CMS_MEDIA_ROOT`，以及 `SOURCE_UPLOADS_ROOT`、`SOURCE_CMS_ORIGIN`。目标不得已有内容。

```sh
pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/manage.mts migrate
pnpm --filter author-cms exec node --env-file=.env.local --import=tsx scripts/transfer.mts source-import /protected/source.json
```

报告位于源 JSON 同名 `.report.json`。逐项核对 sourceCounts、targetCounts、稳定 ID/映射校验和、addresses、mediaChecksums、historyReconciliation、limitations 和 readyForCutover。historyReconciliation.records 逐项列出集合、item、活动/时间、处置与目标修订；limitations 另含缺失字段和原因代码。相同完整批次重复执行返回已保存报告，不会覆盖作者写入或重新转换历史；核验新版转换器必须使用新空目标。中断留下的文件只在校验和完全相同时复用。

当前转换器保留 posts 和 topics 的主记录、可重建版本/修订、未绑定版本首稿、原地址/时间、关系与原文件。SVG 原件私有保存，并生成 PNG 显示副本。行内 `directus://UUID`、当前源 origin 的 `/assets/UUID` 会转为 `/media/UUID`；代码示例不改写。带变换参数、HTML/引用式旧媒体语法和不支持的文件类型需要先单独核验转换，不能静默丢图。

历史关系必须是独立完整的数组快照，元素包含 tags_id/topics_id；空数组表示当时无关系。不能拿当前 junction 值补齐缺失字段、仅有 junction ID 的数组或操作 delta。正文/专题字段完整、稳定 ID 一致且有带时间的删除证明时，已删除内容可恢复为归档：不发布、不占用历史地址，保留源 ID 和可重建修订的时间。缺少删除证明的游离历史不自动复活。

历史 delta 缺字段、历史关系不完整、junction/分类/站点等非正文历史逐项列入 limitations。只有删除活动且已无原内容快照的记录也单独列报。删除活动元数据与可恢复字段不同，不把它算成正文修订。完整原始快照保存在 `source_archives` 并随内容包导出。`readyForCutover=false` 表示仍需逐项审阅、补齐信息或明确接受仅保留原档案的差异；不能把当前记录数一致当成无损历史验收。工具不会自行清除差异或执行生产切换。

CMS 镜像包含固定版本 Fontconfig/Noto CJK、字体许可与版权说明，支持带中英文文字的 SVG 转换。在只读容器内，字体缓存使用 /tmp tmpfs。跨平台字体/渲染器可产生不同的 PNG 显示副本；源 SVG 必须原字节保留，部署环境实际生成的 PNG 必须随完整内容包原字节恢复。

## 正式切换条件

1. 源写入冻结，取得最终一致源快照与备份，重复核对隔离结果和差异。
2. 完成完整内容包及实际媒体恢复演练；对账通过，历史差异已审阅。
3. 部署受审阅的 CMS/site 镜像和新 Compose/Caddy，设置所有者密码、运行时只读令牌、受限 DB 角色与媒体目录权限。
4. 检查实际文章、旧地址、时间、分类/系列、搜索、横竖图和私有草稿边界；在已启动服务发布全新地址，验证无需构建/重启。
5. CMS 成为唯一正式写入来源；旧 Directus 保持停写，不继续运行旧发布 Flow。
6. 留存镜像 digest、迁移报告、源快照、媒体清单、备份点和验收记录。

当前仓库不再包含旧服务 Compose、schema、seed 或 launch 工具。恢复旧原始数据库必须使用与备份匹配的旧版本，在隔离环境导出只读快照，再用保留的离线转换器核验；日常写作只使用新 CMS。

## 回退

新后台尚未产生正式写入时，可恢复旧应用路由与旧写入来源。已经产生新写入后，先冻结新写入并导出新内容及媒体，优先修复或恢复新 CMS。直接恢复旧数据库会丢掉切换后的文字，不能作为普通代码回滚。

2026-10-14—15 本地演练覆盖源快照的 16 posts、6 topics、28 个专题关系和 2 个图片。补回 5 个已删除专题至归档后，得到 27 contents、33 revisions、9 aliases 和 3 个实际文件（含 SVG 原件）。原有 22 条内容的草稿/发布数据、地址和媒体引用保持一致。

原 69 条差异中补回 5 条；其余 64 条修订为 21 条 posts 缺关系快照（含 5 条已删除 posts）、34 条只有 ID 的关联历史、9 条站点资料历史。另查出 4 条 social_links 删除活动，涉及 2 个已无原始内容快照的链接。最新 limitations 共 68 项，readyForCutover=false。完整恢复、逐项原因和处置见当前任务 research/ 与 cutover-review.md。

2026-10-15 作者确认尚未远程部署，批准本地切换并接受上述旧历史保留原始档案。最终本地冻结快照的源数据、全部差异记录、地址和媒体校验和与已审阅结果一致；完成独立空库及实际媒体恢复后，日常本地博客已接入新 CMS。后续旧程序、SDK、服务与数据目录已备份清理，迁入内容与历史保留。报告仍保留原 limitations 和 readyForCutover，作者接受记录单独保存。本地启动、登录及备份见 [本地使用](local-cms.md)；远程环境尚未部署。
