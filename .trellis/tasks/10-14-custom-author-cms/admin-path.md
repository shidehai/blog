# 同域名 /admin 后台

2026-10-15：用户明确要求博客与写作后台使用同一域名，后台固定在 `/admin`。沿用当前任务和已授权实现/提交范围，仅主会话串行执行。

## 行为与边界

- 博客保留根路径，CMS 的页面、API、静态资源及认证预览统一以 `/admin` 为基路径。
- Next.js `basePath` 拥有页面/资源路由；共享无服务端依赖的路径常量用于原生 fetch、XHR、img、a 和内部 CMS 请求。Next Link/router/redirect 继续使用应用内路径，由框架添加基路径。
- Caddy 保留前缀，优先将 `/admin` 和 `/admin/*` 转发 CMS；其他请求交给公开站。只需要 SITE_DOMAIN 和联系邮箱。
- CMS_ORIGIN/CMS_SITE_ORIGIN/CMS_INTERNAL_URL 保持纯 origin，精确 Origin 校验和 __Host Cookie 的 Path=/ 不变。正文/封面和备份中的 `/media/UUID` 不变；仅 CMS 内部读取/认证预览带 `/admin`。
- 根 robots 排除 `/admin`；CMS 页面仍 noindex。现有所有者、会话、数据库及实际媒体无需迁移。
- 修改范围：共享路径模块、CMS 配置及浏览器资源调用、公开站内部读取/robots、Caddy/Compose/初始化脚本、相关验证与部署文档。保持现有视觉设计和内容模型。

## 执行与验收

1. [x] 统一应用基路径、原生资源/API 调用和内部发布读取，包括公开站中间件。
2. [x] 单域名代理、健康检查、初始化提示和文档。
3. [x] 应用/数据库/运维门禁通过；两镜像构建、功能、秘密检查和实际 HIGH/CRITICAL 扫描通过。
4. [x] 隔离环境经真实 Caddy 验证同域名登录、CSS/字体/脚本、导航、图片上传/预览、发布/公开图片、实际导出文件、退出及私有媒体限制。
5. [x] 规范、验证记录和提交前差异审查完成；按用户既有授权交付当前功能分支，具体提交见 Git 历史。

## 核验结果

- `pnpm verify`：CMS 7 项测试，零跳过；两应用构建与运维回归通过。最终 `pnpm lint` 通过。
- 最终生产构建使用真实 Caddy 的 HTTP 同源回归与原生 Chromium 通过，包含默认头像、下载文件 JSON 与 API 数据一致、导航/拖图/发布/历史前后退/焦点刷新/归档/退出。
- 新镜像的 CMS/站点 smoke、秘密扫描、依赖审计通过；实际导出镜像的 HIGH/CRITICAL 均为零，扫描 DiffIDs 与 Docker RootFS 逐层一致。Docker 导出快照瞬时失败经缓存重试成功；Trivy 的 Docker API 读取等待改为实际 image save 文件，未改变扫描规则。
- 两个独立 Compose 目标完成单域名初始化、重复启动、完整包导入/再导出及重复导入保留新草稿/会话；测试栈已移除。
- 日常本机应用更新前完成冻结备份；更新后 28 内容、37 修订、3 媒体文件的完整数据与实际字节一致，所有者/原有会话保留，PostgreSQL 容器未替换；9 篇原公开文章和旧地址重定向通过。
- 证据见 `research/admin-path-evidence.json` 和 `research/admin-path-local-update-evidence.json`。私有完整日志/备份留在 Git 忽略目录。

实际域名 HTTPS 与 VPS 部署仍需在用户服务器执行。发生问题时回退本次代码及匹配的两应用镜像即可，数据库无需回滚。
