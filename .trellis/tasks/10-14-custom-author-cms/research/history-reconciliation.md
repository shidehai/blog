# 旧历史对账（2026-10-14—15，本地核对完成）

源快照 SHA256：63e38cb0ed6ebacc5522e95250715d12bb73fe834e94be6755e085e10468b813。
只读取既有快照，使用新的隔离目标；预览及旧源均不重置、不写入。

## 已确认的差异分组

此前 69 条 limitations 包括：16 条当前 posts 的创建快照缺 tags/topics；34 条
posts_topics 修订（data/delta 只有 id）；9 条 site_settings 修订；5 条已删除
posts；5 条已删除 topics。此前“53 条无当前内容可绑定”的描述过于笼统。
另有 20 条只有 activity 的删除事件，其中 4 条涉及 2 个已无内容快照的
social_links；不能把这 4 条活动当成已恢复链接内容。

## 本轮最小改动边界

- 行为缺口：历史报告未区分非正文、已删除和关系字段缺失；历史关系数组只
  给 junction id 或操作 delta 时，转换器可能借用当前关系而伪造完整旧快照。
- 所有者：author-cms/lib/source-transfer.ts 的历史转换与报告。
- 修改该文件：只接纳独立完整的历史关系快照；可重建的已删除内容必须有
  删除事件，保留稳定 ID，仅恢复为归档且无公开指针、无地址占用。此快照中
  5 个已删除专题具有 name/slug，description 在创建时可按源 schema 的 null
  默认处理；专题的成员关系由文章持有，不从当前关系反推。
- 修改 author-cms/tests/content.test.mts：覆盖归档恢复、删除证明、缺字段、
  ID-only/操作历史关系拒绝、完整关系快照独立于当前关系、活动遗漏、重放与
  完整导出恢复。使用专用 _test 库，避免影响演示编辑数据。
- 报告逐项包含来源 ID、集合、item、活动/时间、处置、缺字段与目标映射；
  原始历史仍随 source_archives 保存。删除事件不是正文修订；缺失原内容的
  删除事件需要单独报告。
- 同步迁移手册、任务验收、恢复证据和数据库规范。重新做源导入及独立恢复，
  比对实际文件和完整结构化数据。
- 不扩展成通用事件重放器，不猜测关系，不自动丢弃测试记录，不修改历史源，
  不创建新的公共频道，不做正式切换或提交推送。

## 本轮结果

补回 5 个已删除专题至归档；目标为 27 contents / 33 revisions / 35 mappings。
64 条修订仍只有原档案（21 posts 缺关系、34 junction 只有 ID、9 站点资料
历史）；新增发现 4 条 social_links 删除活动缺原字段快照。报告共 68 项
limitations，readyForCutover=false。全部 75 revisions 与 20 无 revision 的
活动均有逐项处置；详细记录见 history-reconciliation.json。

宿主隔离导入和独立恢复通过。最终 CMS 镜像再次在新库实际 source-import /
export，再在另一个空库 restore / reexport；完整 data 和三个实际文件均
一致，原始源快照、SVG 原件及 WebP 未变，原有 22 条内容的草稿/发布字段及
9 个公开地址不变。证据见 recovery-evidence.json，最终原始产物在
/tmp/blog-author-history-1014/image-final。建议取舍见 ../cutover-review.md，
尚未获得差异接受或正式切换授权。

## 镜像实跑发现的必要补充

首次新 CMS 镜像实际导入原源快照时，Sharp 报 Fontconfig 配置缺失。源 SVG
含一个 sans-serif 文字节点；原件与 WebP 字节保持不变，但容器 PNG 显示副本
与本机不同。增加 Dockerfile 中仅 CMS runtime 的 Fontconfig/Noto CJK 依赖、
缓存及对应许可，扩展镜像烟测验证中英文 SVG 文本确有像素；同步依赖文档。
这是修复原迁移范围内的 SVG 显示副本，不扩大图片上传格式或改动公开页面。
跨平台 rasterizer/字体不同不要求 PNG 校验和相同，要求原件原字节保存、实际
部署环境中的显示副本完整，且该副本导出恢复后字节相同。

修复结果：固定 fontconfig 2.17.1-r0 / font-noto-cjk 0_git20220127-r1，
设置显式配置路径和 /tmp/cms-font-cache 缓存回退。只读非root镜像的中英文
字体匹配/文字像素检查通过；真实源SVG显示副本文字已目视核验。完整许可与
实际字体版权元数据包含在镜像中；字体包约增加88 MiB。最终镜像源码导入
未再出现 Fontconfig 错误，完整恢复保持 PNG 显示副本原字节。
