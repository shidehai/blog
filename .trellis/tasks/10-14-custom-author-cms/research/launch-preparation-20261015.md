# 本地上线准备验收 — 2026-10-15

本轮本地上线准备已完成。此前生产依赖审计阻断已修复，两个最终应用镜像均通过实际 HIGH/CRITICAL 扫描；持久本地博客和后台已更新，数据、账号及媒体保留。作者明确本轮只做本地准备，没有远程部署、提交或推送。全程仅主会话串行执行，AI 并发 1。

## 本轮交付

- 两个应用固定 Next 15.5.28；Sharp 0.35.5 / libvips 8.18.7，PostCSS/source-map-js 补丁进入锁文件。最终生产依赖审计覆盖 247 项，所有级别均为 0。
- 镜像实扫发现旧基础层的 OpenSSL 和全局 npm 工具链共 17 条 HIGH/CRITICAL 命中。改用 Node 24.22.0 / Alpine 3.23.6，确认 libcrypto3/libssl3 为 3.5.8-r0；运行阶段移除 npm/Corepack/Yarn，构建和开发阶段继续保留工具。最终两个镜像扫描结果均为 0 条 HIGH/CRITICAL，没有忽略项或 ignore-unfixed。
- 新增并贯通运行时 SITE_URL。canonical、Open Graph、Twitter、robots、sitemap 和 1200×630 分享图使用配置域名；有封面文章使用自身封面，无封面文章使用默认图。发布、改址、归档即时更新收录，草稿、媒体和别名不进入 sitemap。后台 robots 禁止收录。两个应用关闭未使用的图片优化入口。
- Inter/JetBrains Mono 使用锁定的 Fontsource 本地字体，解决 Google Fonts 下载导致的构建失败；字体许可保留。修正手机导航挤压站名和数量标签换行；未实现工具如实显示「筹备中」。后台侧栏截图等动画结束后再保存，界面本身无需修改。
- 为生产运行验证提供隔离端口及串行浏览器检查，CI 同步覆盖数据库、浏览器及两个实际镜像的扫描门禁。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 完整 pnpm verify | 通过；CMS 7 个测试，0 跳过，两个生产构建及工具打包通过 |
| 最后改动复验 | 前台 verify、CMS typecheck、根 lint 通过；运维回归再次通过 |
| 运行时即时发布 | 原 404 新地址、列表/分类/系列/搜索、草稿隔离、更新、归档及媒体撤销、故障 503 通过；build IDs/PIDs 不变 |
| 串行浏览器 | 可信 CDP 文件拖入、实时图片预览、公开原字节/撤销、实际 focus/visibility、旧 404 后退/前进、可见正文更新、RSC prefetch transport、桌面/手机布局通过，无未处理页面错误 |
| SEO | 配置域名、伪造 Host 不影响 canonical、分享图尺寸、发布/改址/归档后的 sitemap、robots、优化接口 404 实测通过 |
| 容器 | 两个最终镜像非 root/只读运行，Node/Next/Sharp 版本及许可通过；CMS 的中文字体、图片上传、登录/编辑/发布/导出和受限数据库角色通过 |
| 秘密边界 | 构建上下文检查通过；两个最终镜像的配置、历史、镜像层未检出真实运行读取令牌 |
| 运维 | 生产/开发/本地 Compose 渲染及 Caddy 校验通过，日常应用配置实际启动通过 |
| 最新备份恢复 | 冻结写入后保存 custom dump、完整内容包、原图及配置；独立新建测试库恢复和重导出完全一致，所有者密码哈希相同；演练库随后删除 |

浏览器使用独立 `author_launch_hardening_1015_test` 和 4341/4342 端口，未重置日常或原预览数据库。可信 CDP 拖入不等于操作系统文件管理器的物理鼠标拖拽；Link 自动预取保持禁用，验证的是实际 RSC transport，未宣称已填充客户端预取缓存。全部断网交互分支与作者最终视觉签收仍沿用原验收边界。

## 持久本地更新

仅替换 CMS/site。PostgreSQL 容器、启动时间和媒体目录保持原状。更新前后 28 条内容、37 条修订、10 个别名、35 个迁移映射、1 个源档案以及全部 Markdown 和 3 个媒体文件（含原件）逐项相同。9 篇原公开文章均为 200，9 个 writing 地址均正确 308；公开图片字节、私有拒绝和原所有者登录正常。

最终不可变本地 image ID：

- site：`sha256:520122eaf04faf9a6b84a9a0dff708b40acf30a326d51afed14b8198998dd382`
- CMS：`sha256:e2a49b68b8e1cd44ac33c7504e0f20a8eeb3b64a4628f46fe66f465efb2f24d9`

最新备份位于 `.data/backups/local-launch-prep-20261015-145756/`，指针为 `.data/local-cms/launch-backup-path.txt`；其中数据库备份也保存认证状态。此前切换和旧平台冷归档仍保留。更新后的导出最初通过 docker cp 读取 tmpfs 路径失败，改为容器内 tar 读取后完成核对；文章分享断言按封面规则修正后通过。以上是验证工具调整，没有再次迁移、还原或改写日常内容。

CMS 本次构建临时使用清华 Alpine 镜像源下载同版固定字体包，保持 APK 签名检查；仓库 Dockerfile 仍使用官方源。扫描器及漏洞库从官方 ECR 镜像获取，具体版本和数据库时间见安全证据。

## 证据与正式部署边界

- `launch-production-audit.json`、`launch-security-evidence.json`：最终生产审计、漏洞库时间、镜像身份与门禁结果。
- `launch-runtime-evidence.json`、`launch-browser-evidence.json`：生产进程及浏览器实际覆盖和限制。
- `launch-local-update-evidence.json`、`launch-restore-evidence.json`：持久本地更新和最新备份恢复对账。
- 六张最终截图、浏览器 trace、完整扫描报告和初次扫描报告保存在 `.data/verification/launch-20261015/`；截图只包含隔离合成内容。

可以进入首次正式部署阶段。真实域名/HTTPS、生产安全 cookie、异机自动备份、告警及服务器上的恢复/回退仍需在选定部署环境验收，本轮未将其计为通过。远程 CI 尚未执行当前未提交版本。作者已接受的 68 项旧历史限制及原 `readyForCutover=false` 报告保持原样，不是本轮新增的数据丢失或未接受阻断。
