# 验收进展：2026-10-09 至 2026-10-10

## 状态与边界

- `09-01-system-audit` 已按用户确认归档到 `archive/2026-10/`。该历史任务直接在 main 完成且没有 PR，归档使用 `--skip-branch-validation`，未虚构功能分支。
- 本任务已重新激活，状态继续为 `in_progress`。原实施改动位于提交 `80ee9ed`；本轮后续修复按下方确认计划另建代码检查点，不能将该提交误记为所有后续修复的完成提交。
- 本轮只修复原清理范围内的验收缺口、恢复受 V1 删除影响的 CMS 夹具、补回归和同步规范。没有重建预览、修改生产内容或绕过许可证/权限门禁。
- 验收依据包括全范围 Trellis check 审查、源代码与引用搜索、离线测试、最终快照构建、容器测试和隔离 CMS 实测；不是仅凭任务状态判断完成。用户要求自行启动实例后，已保留独立测试栈，不再以没有实例为由阻塞可完成的测试。

## 本轮修复

| 问题                                                              | 修复与回归证据                                                                                                                               |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `next lint` 被根 ESLint ignore 排除前端，可能虚报成功             | V2 显式运行 `eslint --no-ignore app components lib next.config.ts`，实际 lint 通过                                                           |
| 严格 lint 暴露无用 catch 绑定，运输层诊断可能携带凭据             | 移除无用绑定，保留有界错误；自检模拟含 token 的运输错误并断言最终错误不含 token                                                              |
| 开发模式 `/app` 绑定挂载遮住工作区的 Next 依赖                    | 保留根和 V2 两个 node_modules 卷；静态回归及真实镜像挂载后的 Next CLI 解析通过                                                               |
| 根 Zod 4 的唯一执行消费者 `scripts/env.mjs` 已删除                | 删除根依赖与锁项；保留 V2 的 Zod 3 与 Directus SDK                                                                                           |
| CMS 夹具仍引用 V1 删除的根 public 文件，导致 ENOENT               | 恢复历史相同字节至 `directus/seed/assets/`，更新 helper 并将离线回归接入根 verify                                                            |
| 第二次 seed 将原样夹具误判为 owner-modified；当前资料字段保护遗漏 | 修正 V1 所有权字段，预检只读查找实际上传的封面 UUID，统一 settings/posts 的预检与写入 payload；新增 `tests/seed-install.mjs` 并接入根 verify |
| 确认的部分 seed 修复会重复 PATCH 原样记录及文件元数据             | 比较 payload 时包含确定的 id，匹配文件元数据时直接复用；真实缺失 junction 修复与离线回归均证明其他记录/时间戳不变                            |
| 规范仍承诺已删除的媒体生成、日期归一化和统一内容目录              | 按 V2 实际代码同步媒体、更新时间、独立 fixture 与 CMS seed 的边界，不额外实现这些旧功能                                                      |

恢复的 WebP 为 18,500 字节，SHA-256：

```text
666002f894f46da14b86f0bb2b9e963e1f69907cf714b089b939afd6fe8fc26b
```

历史原件来自 `01ee324^:public/images/ai-reliability-boundaries-960.webp`，没有重新渲染或改写现有 CMS 媒体。

## 已通过的本地验收

| 检查                                                                                | 结果                                                                                                     |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `CONTENT_SOURCE=fixture pnpm verify`                                                | 通过：离线 CMS 媒体与安装所有权回归、类型、真实前端 lint、自检、20 个静态页面及运维测试                  |
| `pnpm lint`                                                                         | 根 scripts/Directus 与 V2 实际 lint 均通过                                                               |
| `pnpm --filter frontend-v2 exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | 通过                                                                                                     |
| `sh scripts/validate-operations.sh`                                                 | 生产/开发 Compose 与 Caddy 配置通过                                                                      |
| 最终 runtime 与 development 镜像构建                                                | 均通过                                                                                                   |
| `scripts/test-runtime-image.sh blog-site:cleanup-validation-20261009`               | 只读根目录、node 用户、4321、healthz 与首页均通过，无 CMS 运行时环境                                     |
| 最终镜像路由检查                                                                    | 文章 200；已知 writing 308 且目标正确；未知 archive/writing、writing 根路径及 notes 均 404               |
| 两个依赖卷加只读源码绑定挂载                                                        | development 镜像离线解析 Next CLI 成功，版本 15.5.23                                                     |
| fixture 镜像秘密检查                                                                | 使用非生产随机检查 token，历史、配置、导出层及环境检查通过；不等价于成功 Directus 构建的真实 secret 验收 |
| 最终 Directus 构建负例                                                              | 缺 URL、缺 secret 在 Next 前失败；API 不可用时返回有界错误而非 fixture；三种日志均不含测试 token         |
| `git diff --check`、目标文件 Prettier                                               | 通过                                                                                                     |

最终 fixture runtime 镜像：`blog-site:cleanup-validation-20261009`。

```text
sha256:8f1c2bc9606a83c55cb3622286b87857543685a1b50e510d8091c6e2a786c1f6
```

development 镜像：`blog-site:cleanup-development-20261009`。本地镜像仅为验收产物，没有部署到生产。

## 保留的隔离 CMS 测试栈

- Compose 项目 `blog-cleanup-test`：Directus 12.2.0、PostgreSQL 17.9-alpine，独立网络和数据库/上传卷。API/Studio 仅绑定 `http://127.0.0.1:18055`，数据库不开放主机端口。未使用生产 `.env` 执行写入，也未启动或修改原有 personal-journal/VPP 服务。
- 使用方式记录在忽略的 `.data/cleanup-test/README.md`；随机凭据位于同目录权限为 600 的 `test.env`，目录权限为 700。测试实例保持运行，未自动删除容器或数据卷；凭据、数据库备份与私有日志不提交到 Git 或镜像。
- 真实 schema dry-run/apply、`directus/database.sql` 约束/索引/slug 触发器、`tests/directus.mjs schema` 均通过；CLI apply 后重启 Directus 刷新 schema 缓存。
- 首次明确确认的 seed 安装成功。修复重复安装缺陷后，两轮真实重复安装均返回 `No mutations performed`：16 posts、6 topics、28 joins、2 files 稳定，正文、slug、原始时间戳、资料和文件不变；额外未知 post/topic/join 哨兵原样保留，测试后仅删除哨兵。
- 在合成 settings 上分别主动修改 `author_name`、`footer_text`，真实 seed 均在任何 mutation 前拒绝，拒绝前后完整快照一致。探针恢复原资料字段且文章时间戳不变；仅主动 PATCH 产生的 settings 审计时间/操作者自然更新。恢复后再次运行两轮 seed，仍均为无写入。
- 删除一条明确已知的合成 fixture junction 后执行确认的部分 seed，准确恢复该 junction；所有现存 posts/topics/settings/files 的完整快照（包括文章时间戳与文件元数据）保持不变。
- 管理员下载原始封面字节后的 SHA-256 与提交的 18,500 字节 WebP 完全一致，schema 检查同时验证 MIME、960×540 尺寸和发布文件夹。构建只读测试身份没有 assets 权限，此项不是公开媒体权限验收。

### 真实 Directus 构建正例：AC6 通过

- Core 合法支持无自定义规则的基础只读权限。为适配器七个集合建立了与生产 Build Reader 分离的测试身份；匿名 posts、该身份写入与 users/asset 访问均为 403。它能读到全部合成 posts，因此已发布/kind 筛选只是客户端筛选，不能声称生产 ACL 已通过。
- 实际 SDK 读取并构建 9 篇 CMS 已发布 article/tutorial，而非离线 fixture 的 3 篇。URL 只用于构建参数，实际使用的 token 只通过 BuildKit secret 传入；没有改变生产 bootstrap 或 Build Reader 权限。
- 最终真实镜像 `blog-site:cleanup-directus-test-20261009` 成功；对该镜像使用同一个实际消费 token 检查历史、配置、导出层与运行时环境，均无泄漏。只读根目录、node 用户、4321、healthz 与首页测试通过。
- 以 `--network none` 启动该最终镜像，37 项路由断言通过：9 篇真实 CMS 文章均 200、对应 writing 均正确 308、5 个 CMS note slug 的 archive/writing/notes 均 404，未知路由和 writing 根路径均 404，healthz 为 200；运行时没有 CMS 环境变量。
- 该镜像仅为合成数据验收产物，不得部署到生产。最终镜像 ID：

```text
sha256:5e0f7711496f397fda159c01f9d0817534eb3f05f3e13eec017e5a7ccea711b2
```

### 精确退休清理：AC8 的已验证子集

- 创建真实旧基础 read permission，以及固定退休 ID 的 policy/role/access/user，再运行两轮 bootstrap 退休步骤。旧 permission 的实际删除路径与精确旧身份删除均通过，不再只是没有 permission 的空操作。
- 同名但不同 ID 的操作者身份、note 正文与 slug、topic、junction、原始文章时间戳、作者/Build Reader 角色与私有文件夹保持不变；Posts preview_url 为 null。测试哨兵已清理。
- 完整 bootstrap 和 `tests/directus.mjs access` 仍在现有许可证门禁停止；精确退休子集成功不等于完整权限工作流成功。

## 删除证据与保留项

- V2 notes/topics 投影、旧模拟目录、CategoriesClient、无效 RSS、Tailwind 和 next/image 策略已通过引用审查与构建/自检交叉确认；CMS 内的同名内容模型不随前端投影一起删除。
- 工具页数据、项目/活动数据和个人资料回退仍有页面消费者，因此保留。
- 文章、分类、标签、系列、健康检查以及已知 writing 兼容路由具有框架或外部入口，不能因缺少静态 import 而删除。
- CMS 的 posts、topics、posts_topics、note、作者能力、Build Reader 与私有资产边界保留；没有批量改写正文中的 writing/notes 链接。
- 本轮 diff 未触及原先要求保护的 globals.css、fixture.ts、mock.ts、avatar.svg，也没有回退 Trellis 工具链的既有改动。
- 历史任务、日志中的 V1 描述保留为历史；当前运行规范按 Next V2 修正。

## 2026-10-10：发布脚本封面 UUID 已修复，AC12 通过

- 用户明确追加修复此前发现的 `launch apply` 问题。修复只涉及发布入口、共享 payload builder 的可选排期参数、离线回归和根 verify 接线；没有修改前端、生产权限或保留实例的内容。
- 预检只读查找精确 digest-addressed 封面 UUID，再统一构建 fixture/manifest 目标；现有 owned 数据缺少封面或被修改时，在任何 mutation 前拒绝。
- 首次上传后重建 settings、文章 cover relation 与正文媒体引用，全部使用真实返回 UUID，不再只替换 default_og_image。相同 manifest 重复执行跳过匹配记录与文件元数据，保留原始时间戳和头像/非自有字段。
- `tests/launch-apply.mjs` 覆盖真实入口的 seeded/fresh 上传、无写入重放、资料/文章/封面/junction 所有权拒绝、缺媒体的部分状态、未知记录、确认与 digest 失败；已接入 `pnpm verify`。独立 check 审查通过，未追加产品代码修订。
- 主会话使用独立数据库、复制的 uploads 卷和 localhost:18056 临时 Directus 12.2.0 容器实测：已安装夹具的真实 UUID 被接受；空夹具状态的新上传 UUID 正确传播；两次同 manifest 重放的完整内容/时间戳快照保持一致；资料、正文、缺失封面三类真实拒绝均无写入；未知 post/topic/join 哨兵保持原样。
- 临时容器、上传卷和克隆数据库均已删除。保留的 localhost:18055 实例在副本创建、测试和清理后的 posts/topics/joins/settings/socials/files 摘要一致，健康与 schema 检查通过。
- 本轮最终 `CONTENT_SOURCE=fixture pnpm verify`、根 lint、unused typecheck、Prettier 和 `git diff --check` 均通过。未修改公开镜像/运行时边界，因此未重新部署站点或将副本发布内容写回原实例。

## 历史发现：原有发布目标确认缺口（本轮已修复，AC13）

- check 离线复现并经源代码确认：`launch apply` 只校验确认文本中的 `manifest.targetOrigin`，实际客户端仍使用独立配置的 `DIRECTUS_URL`。为 A origin 确认的 manifest 可以对 B origin 尝试写入；这是本次 UUID 修复之前已存在的问题。
- 原 UUID 修复轮次保持确认格式和 manifest digest 行为，没有顺带修复该缺口。用户在本次继续任务时明确批准修复；后续实现与验收见下方 AC13 记录。

## 2026-10-10：本次继续任务，AC13 / AC14 通过

### 用户确认与改动

- 继续已有任务，不创建新任务。用户批准一并修复发布目标确认缺口和旧夹具 owner 内容覆盖；确认目前没有自定义权限授权，先完成其他工作。
- `launch apply` 在 digest 验证后、确认/认证及任何 CMS 请求前，比较实际 `DIRECTUS_URL`（含原客户端默认值）与 manifest 的规范化 HTTP(S) origin。主机、协议、有效端口不一致或地址无效时拒绝；等价大小写、默认端口和尾斜线继续可用，manifest 版本/digest/确认格式保持不变。
- 最终 check 又复现并修复同 origin 的用户名/密码 URL：原生 fetch 会把该 URL 写入错误。现在两种输入都在请求前拒绝嵌入凭据，使用不含输入值的有界错误；新增 token/login 两种认证模式下的零请求及不泄露诊断回归。
- `buildLegacyFixtureOriginals({ coverId })` 记录四条冻结历史基线，独立重放 `29d5d85^:directus/seed/index.mjs` 后逐字段比较一致。没有真实 fixture cover 时，不认可前两条含媒体的历史原始记录；当前归档目标保持不变。
- seed/launch 在任何写入前分类全部旧夹具：仅允许缺失、精确原始及精确归档；正文、slug 或其他 owned 字段修改时拒绝。seed 的无写入早退出包含旧夹具检查，缺失及待迁移状态正常触发确认后的精确补装/迁移。
- 两个入口的离线回归分别覆盖两种基线、四个 ID、14 个 owned 字段以及 canonical 完整/部分状态，共各 224 个编辑拒绝组合，完整状态与时间戳不变；另覆盖历史原始迁移、归档重放、仅缺旧夹具修复及缺失媒体拒绝。

### 最终验证

| 检查                                                             | 结果                                                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 完整 Trellis check：原清理范围及所有本轮修复                     | 通过；修复凭据 URL 诊断缺口，无其他本轮 source 修订                                          |
| `CONTENT_SOURCE=fixture pnpm verify`                             | 通过：三个 CMS 离线回归、V2 类型/lint/自检/生产构建和运维测试                                |
| `pnpm lint`                                                      | 通过                                                                                         |
| V2 `tsc --noEmit --noUnusedLocals --noUnusedParameters`          | 通过                                                                                         |
| 三个新增测试的显式 ESLint、目标文件 Prettier、`git diff --check` | 通过                                                                                         |
| `sh scripts/validate-operations.sh`                              | 生产/开发 Compose 与临时 Caddy 配置验证通过                                                  |
| 保留实例 `tests/directus.mjs schema`                             | 通过                                                                                         |
| 保留实例 `tests/directus.mjs access`                             | 失败在原有 Core entitlement gate；不能记为通过                                               |
| 真实 CLI + 两个临时本地请求观察器                                | plan 零请求；错目标的 token/login 均零请求；同目标尾斜线仅进入预期只读观察器；未写入实际 CMS |
| 保留实例 posts/topics/joins/settings/socials/files 前后完整摘要  | 一致，原始内容/时间戳保持不变                                                                |

完整验证使用缓存的项目固定 `pnpm 9.15.9`。全局 pnpm 12.5.1 会尝试联网解析项目版本；固定版本不需要绕过项目约束。首次沙箱 verify 在 tsx CLI 的本地 IPC `EPERM` 停止；允许本地 IPC 后最终完整命令通过，未修改测试或降低检查。

保留实例前后摘要均为：

```text
4a6c5275089134116a851feb5fe49f74b08357941e4b536b2f6e143648fa5361
```

原受保护的 `globals.css`、`fixture.ts`、`mock.ts`、`avatar.svg` 与 Trellis 工具链没有本轮新增 diff。未重新构建/部署容器镜像，因为本轮改变的是 CMS 命令的离线预检/写入边界；既有镜像及秘密隔离证据仍保留。未执行生产写入、激活授权、提交代码或归档任务。

可选的额外 JS `checkJs` 会在原有 `directus/client.mjs:31` 返回 TS2769（fetch body 类型联合）；独立检查原共享客户端可复现，本轮没有把该非规定检查记为通过，也没有扩展修改共享客户端。项目规定的全部类型门禁通过。

## 2026-10-10：站点公开图片交付已修复（R15 / AC15）

用户明确要求先不处理授权、解决图片 403。根因是 V2 向匿名浏览器提供需要认证的
CMS 原图地址；按文件夹配置匿名权限同样依赖暂缓的自定义权限能力。采用构建时
图片交付：只读取已验证的公开文章/头像所引用且位于 publishable 文件夹的原图，
复制到站点 `/_cms/<sha256>.<ext>`，访客不再依赖 CMS 匿名访问。没有调整 Public
策略、生产 Build Reader、许可证门禁或 CMS 内容。

### 改动与检查

- `loadFromDirectus` 使用同一实际 build token 完成整批文件元数据预检、原图下载及
  写入前复查，输出本地 cover/avatar/body 地址。意外返回的 draft/archived/note
  在媒体收集前拒绝；摘要、字数、阅读时间按原正文计算。
- 只支持 JPEG/PNG/WebP/GIF/AVIF 原图；20 MiB/张、100 MiB/唯一引用集、15 秒/请求，
  限流读取并核对 ID、公开文件夹、MIME、长度、文件头。禁止重定向、URL token、
  CMS 查询变换及越界输出，不下载未引用文件。
- 共享 Markdown 扫描器与真实 React 渲染覆盖行内图片、可选标题、安全相对地址、
  属性转义和窄屏尺寸；长/短/未闭合代码围栏、行内代码、转义示例保持字面量。
  不支持的 CMS HTML/srcset/引用式图片会让构建失败，不静默留断图。
- build/dev 包命令独占固定生成目录的清理与锁；Next workers 仅在 public 之外
  暂存并原子发布。Git/Docker 排除本机生成目录、暂存与锁；fixture 或失败构建
  清理旧图，保留所有作者本地资产。
- 独立 checker 完整 `CONTENT_SOURCE=fixture pnpm verify`、根 lint、unused tsc、
  scoped Prettier 和 diff 检查通过；额外 `.mts` 严格类型/lint 与四进程并发写入
  回归通过。最终 fixture 生成目录/暂存为空、锁不存在；四个受保护文件未改。
- `sh scripts/validate-operations.sh` 的 Compose/Caddy 检查通过。

### 真实 CMS 与镜像证据

保留 Core 测试实例创建了一个独立、临时、仅用于合成测试的基础只读身份，具有
适配器集合与文件读权限，无写权限/用户读权限（两类请求均403）。它可以读取私有
原图，因此适合证明导出器自身的公开文件夹拒绝；它不代表生产 ACL 已验收。

- 使用该真实身份引用私有文件，导出器在 `/files/<private-id>` 元数据检查拒绝；
  0 次原图请求，0 个 public 文件，诊断不包含 token。
- 实际消费该 token 的 Directus Docker 构建成功；针对同一个最终镜像检查历史、
  配置、层、运行环境，实际 token 均不存在，运行时也无 CMS 环境变量。
- 最终镜像以非 root node 用户、只读根目录和 `--network none` 运行：9 篇真实
  CMS 文章200；其中2篇正文图片实际渲染；公开图片匿名200、MIME正确、18,500字节
  且SHA-256与提交的原图完全一致；私有图片不存在/404。输出仅有被引用的1份
  内容寻址图片。
- CMS 的公开/私有原图仍匿名403；这是保留的 CMS 访问策略，不是站点交付失败。
  CMS posts/topics/joins/settings/socials/files 内容与原始时间戳完整摘要保持
  `4a6c5275089134116a851feb5fe49f74b08357941e4b536b2f6e143648fa5361`。

Directus 测试镜像（未部署生产）：

```text
blog-site:cleanup-media-test-20261010
sha256:227ff9883dd8d46957107bc88fab2cffd19db7d8725d7994ecc629e0ed8055da
```

最终 fixture 镜像 `blog-site:cleanup-fixture-media-20261010` 的类型检查覆盖全部
6个`.mts`；镜像秘密/健康检查通过，断网只读运行时的生成 CMS 目录为空。

```text
sha256:029dc97e2e30b7986f1a34b38412ac67295cdbe401f62917542f0aba8816ed5a
```

补齐常规类型门禁时，仅给测试环境字典补入 `NODE_ENV: "test"`，没有改变
CMS字段或断言。package typecheck/lint、unused检查、fixture/media回归通过；
已按最终配置重新构建并验证上述两个镜像。

临时测试身份、精确权限/role/policy/access及临时builder标签已删除；保留实例
schema检查再次通过，内容/时间戳摘要不变。最终格式、diff、任务清单和受保护
文件摘要检查通过；验收时未提交/部署/归档。

静态图片撤回与正文撤回一样，需要重新构建并部署。已有镜像仍保存旧快照；没有
引入运行时 CMS 代理、凭据或自动将作者私有上传移为公开的行为。

### 额外发现：原有字体下载依赖

尝试将整个 Docker 构建设为 `--network none`，首先在 Corepack 下载 pnpm 时失败；
依赖阶段联网是预期要求。随后使用依赖已安装的 build-stage 镜像，在断网容器内
单独执行 fixture Next 编译，发现原有 `next/font/google` 会请求
`fonts.googleapis.com` 的 Inter/JetBrains Mono，导致 EAI_AGAIN 和构建失败。
普通 fixture 镜像构建及断网运行均通过；fixture 内容快照无需 CMS，但不能将其
描述为整个 Next 编译可完全断网。R7 的完整断网构建承诺仍存在这项既有依赖，
本轮没有扩大修改字体或 UI；该限制不影响 AC15 的断网运行图片交付证据。

## 仍阻塞归档的验收

**AC8：完整生产权限验证。** schema 和实际旧 permission/身份退休已验证；仍需
实例合法激活自定义权限后完成完整 bootstrap/access 测试，验证生产 Build Reader
的已发布文章/字段/文件夹边界、作者能力及私有草稿资产保护。用户要求暂缓该项。
公开图片交付已由 AC15 独立解决，不再是待处理的站点缺口。

保留实例 `/license` 返回 Core，`custom_permission_rules_enabled.default=false`。
本轮没有激活授权或改变授权检查。保留测试实例继续可用，不删除其数据库/上传卷。

当前15项验收已完成14项，AC8仍未勾选；R7 的完全离线构建另有上方字体依赖待处理。用户已按项目Phase3.4一次确认commit-plan.md，按计划创建两个本地代码检查点；
任务继续in_progress，完成时间与最终完成提交为空。不推送、不执行生产部署或
生产内容写入、不归档；开发日志仍保留未提交。

## 用户确认后的本地提交

1. `2dd5126` — `fix: preserve CMS fixture ownership and launch targets`，14个批准文件。
2. `fix: deliver validated CMS images in static builds`，35个批准文件，为本记录所在
   检查点；实际hash另记录在未提交的开发日志与最终回复中。

提交前逐组核对暂存文件与已确认计划完全一致，原夹具WebP字节摘要正确；不包含
凭据、私有日志、生成媒体或workspace开发日志。代码及验收结论未在提交阶段改写。
