# VPS 分支与目录约定（2026-10-15）

## 用户要求与改动边界

- 用户自行把代码合并到 `main`；部署文档从 `main` 克隆。
- 代码直接检出到 `/opt/blog`，不使用 `current` 子目录。
- README 中的 `personal-journal` 全部改为 `blog`；服务器部署目录统一使用 `blog`。
- 实际目录默认值位于 `scripts/setup-vps.sh`、`scripts/deploy-site.sh`、运维配置和 systemd 单元。仅修改 README 会导致密码读取、备份和维护命令仍指向旧目录。

## 实施范围

- 根 README 和部署/恢复指南：主分支、代码路径、数据和配置路径。
- 初始化脚本：新部署的数据根目录 `/srv/blog/data`，Compose 项目及备份默认命名 `blog`。
- Compose、备份脚本和运维模板：统一 `blog` 默认命名、`/etc/blog` 与 `/var/lib/blog/deploy`，systemd 与 SSH 入口改用 `/opt/blog`。
- 项目规范：记录上述部署契约，防止后续文档重新引入旧目录。

现有私有 `.env` 仍是重试时的权威配置；不搬动本机数据、不重置凭据、不更新日常容器、不执行 VPS 部署，也不代替用户合并 `main`。历史任务证据和既有无关改动保持原样。

## 验证计划

- 文档命令、链接与默认路径交叉核对。
- 现有运维回归：初始化拒绝/重试、凭据与内容保留、导入、备份/恢复、发布器。
- Compose 模型及 Caddy 配置验证，检查 systemd/SSH 路径指向仓库内的真实脚本。
- Markdown 格式与 `git diff --check`。

## 验证结果

- `sh tests/ops/run.sh` 通过：覆盖初始化拒绝/重试、凭据与媒体保留、一次性导入、发布回退及备份恢复。重试测试不再传数据目录参数，确认已保存配置继续生效。
- `sh scripts/validate-operations.sh` 通过：生产、本地、standalone Compose 契约和 Caddy 配置均有效。
- 22 个文档本地链接与锚点有效；README 和 VPS 指南均从 `main` 克隆到 `/opt/blog`，示例 shell 语法通过。systemd、SSH 模板的代码路径均对应仓库内真实文件。
- 活跃文档及部署文件中不存在旧服务器目录；初始化脚本与生产模板的数据目录、项目名称一致。
- 本轮未修改应用代码或数据库结构，未构建应用镜像或重启本机日常服务；真实 VPS 和域名 HTTPS 仍由后续部署验收。
