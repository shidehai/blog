# 首次公网部署就绪评估 — 2026-10-15

这是修复前的历史评估。此后已按作者「先做本地上线准备」的授权修复依赖/镜像门禁、补齐 SEO 和浏览器验证并更新本地服务；最新结果见 [本地上线准备验收](launch-preparation-20261015.md)。下文保留初次检查事实，不代表最终版本仍被同一依赖审计阻断。

结论：个人博客首版的核心功能已具备，当前版本尚未通过公网发布门禁。优先修复生产依赖审计命中，再完成真实环境的部署与恢复验收。本次只读检查应用与依赖并记录结果，没有升级依赖、提交代码或远程部署。

## 已有实现与本地证据

`legacy-cleanup-evidence.json` 记录新博客/CMS 镜像烟测、登录和授权隔离、9 篇原文章及 9 个旧地址跳转、公开/私有媒体边界、28 条内容/37 条修订/3 个实际媒体文件及历史完全不变。切换验收另覆盖即时发布、草稿隔离、更新、归档与独立内容恢复。清理轮全部质量检查组成项分别通过；没有将首次失败的根命令表述为整条再次通过。

本轮重新访问本地博客首页、archives、categories、series、tags、about、tools 及 CMS 登录页，均为 200；两个 healthz 均为 200，三个日常容器均 healthy。

## 当前阻断项：生产依赖安全门禁

实际命令 `pnpm audit --prod --audit-level high --json` 退出码为 1。审计元数据为 2 critical、6 high、4 moderate，244 个生产依赖。实际命中版本包括 Next.js 15.5.23、Sharp 0.34.5、PostCSS 8.4.31 和 source-map-js 1.2.1。

| 包 | 公告 | 级别 | 适用条件与处理 |
| --- | --- | --- | --- |
| next | GHSA-p293-qw3h-jr36 | critical | Windows 特定文件系统行为；当前 Alpine/Linux 容器不符合该平台条件。仍会命中仓库现有审计门禁。 |
| next | GHSA-2xp9-vwfh-vxw4 | critical | AVIF 图像优化的远程代码执行公告；当前配置未显式禁用图片优化，需要修复受影响依赖后重新检查。 |
| sharp | GHSA-f88m-g3jw-g9cj | high | libvips 继承漏洞；不能仅以应用 smoke 成功替代依赖安全核验。 |
| sharp | GHSA-rgj7-g3m4-5g8c | high | libheif 依赖漏洞。 |
| sharp | GHSA-wq5f-xc86-pv6w | high | librsvg 依赖漏洞；公告的 glibc Unicode 触发条件不能直接套用于当前 musl 镜像。 |
| postcss | GHSA-6g55-p6wh-862q | high | 不可信 sourceMappingURL 的文件读取风险；需结合构建输入判断暴露面。 |
| postcss | GHSA-r28c-9q8g-f849 | high | 旧 source map 自动加载的路径穿越公告。 |
| source-map-js | GHSA-68fv-2mgg-jv7q | high | 特制 indexed source map 偏移导致事件循环拒绝服务。 |

审计命中不等于所有公告都在当前服务上可利用；本次未做漏洞利用测试。但现有 CI 明确运行同一 high/critical 门禁，因此不能把当前版本标为已满足公网发布条件。CMS 上传接受 AVIF，后台图像处理也直接依赖 Sharp，需要在升级后回归上传、SVG、中文字体、媒体可见性与生产镜像。

维护者原始公告：

- https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36
- https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4
- https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w

生产 OCI high/critical 镜像扫描在发布流程中已配置，本轮没有重新运行或宣称通过。补丁选择要复查最新公告和锁文件实际解析，不能只改 package.json 的版本范围。

## 尚未完成的首次部署验收

作者已明确尚未远程部署。Compose、Caddy、受限数据库角色、备份恢复工具与维护流程已有实现和本地检查；服务器上的真实域名/HTTPS、后台安全 cookie、自动备份与异机保存、故障告警、恢复耗时及正式发布回退尚没有本项目的生产实测证据。常规 CI 只自动替换 site，CMS/迁移/首次部署需按 maintenance 流程实际核验。

代码仍在本地工作区，未提交、推送或在远程 CI 完整跑通本次版本。上线需固定可追溯版本与两个镜像 digest，并迁入经过清单比对的当前内容包。

## 可集中补齐的完善项

- 原生文件拖拽、真实失焦/重新聚焦和显式预取场景尚缺浏览器实际操作证据，沿用 acceptance.md 的未覆盖记录。
- 本轮实测 `/robots.txt` 和 `/sitemap.xml` 均为 404；首页没有 canonical 或 Open Graph title。文章页目前只生成 title/description，正式域名确定后宜补齐搜索收录与分享元信息。这些缺口本身不代表页面不能公开访问。
- 原始历史报告仍保留作者已接受的 68 项限制；这是旧历史完整恢复边界，不是本轮新发现的当前文章或图片丢失，也不应重复作为未接受的迁移阻断项。

以上研究、检查和记录均由主会话串行执行，未使用子代理或其他 AI 会话。
