# Operations

生产拓扑是 Caddy、公开 site、自建 cms 与 PostgreSQL。只有 Caddy 暴露公网端口。文章发布直接提交 CMS 事务；代码镜像发布与内容发布分开。

- [部署](deployment.md)：运行配置、受限数据库角色、镜像和受限 SSH site 发布器。
- [Debian 12 首次部署](vps-first-deploy.md)：当前 VPS 的 Docker 安装、代码构建、本机文章与图片迁入、密码和 HTTPS 初始化。
- [本地使用](local-cms.md)：本机持久博客与写作后台、登录、启动和内容备份。
- [CMS 迁移与切换](cms-migration.md)：只读源盘点、历史差异、正式切换与回退。
- [备份恢复](backup-restore.md)：CMS 媒体及原文件、内容包、Restic 和空目标演练。
- [维护与安全](maintenance-security.md)：schema 兼容、秘密、HTTP 缓存与依赖可用性。

CMS 的首次正式切换、维护发布和数据迁移由所有者审阅后单独执行；现有受限 SSH 发布器只更新 site。
