# Bug Analysis: Seed 所有权与上传媒体身份漂移

## 1. Root Cause Category

- **C / Change Propagation Failure**：V2 settings 使用 `author_name`、`footer_text` 等字段，而 `SETTINGS_OWNED_FIELDS` 仍列 V1 字段，导致真实所有者资料变更未完整受保护。
- **E / Implicit Assumption**：预检假定封面 UUID 等于静态 `EDITORIAL_IDS.cover`，实际上传由 Directus 生成 UUID；settings 预检还缺少真实的 `default_og_image`。
- **D / Test Coverage Gap**：静态媒体和离线前端构建不能证明真实安装的第二次执行无副作用。

## 2. Why Earlier Evidence Was Insufficient

- 首次安装、图片文件存在与 Next 构建通过，只能证明对应单步成功，未执行真实第二次 seed。
- 不可删除所有权保护或忽略封面字段来消除误报：那会让真正的作者资料、页脚和媒体更改被覆盖。

## 3. Prevention Mechanisms

| Priority | Mechanism | Status |
| --- | --- | --- |
| P0 | 只读查找精确 digest-addressed 封面 UUID，预检和写入共享 payload builder | DONE |
| P0 | 以当前 settings 字段集合检查所有权；头像与非自有字段保留 | DONE |
| P0 | 离线执行真实 seed 入口，覆盖 generated UUID、每个自有字段变更、缺失/部分数据、确认与 dry-run | DONE |
| P1 | 真实实例连续 seed，比较正文、媒体、原始时间戳和未知记录哨兵 | DONE |
| P1 | 部分安装修复包含 id 的所有权比较，已匹配文件元数据不 PATCH | DONE |

## 4. Systematic Expansion

- 同一动态封面 ID 同时影响 settings、post cover relation 与正文媒体引用，不能只修单个比较值。
- 2026-10-09 另发现原有 `directus/launch.mjs` apply 使用静态 cover UUID，当时单列待协调；2026-10-10 用户明确追加后已修复，独立离线与副本实测通过，详见 `launch-cover-uuid.md` 和验收记录。
- 真实 owner-change 拒绝测试需要主动 PATCH 合成 settings，再恢复字段。Directus 自然更新 settings 的 `user_updated`/`date_updated`；这些测试操作的审计变化不是 seed 写入，不应伪造恢复审计历史。
- seed 的无写入断言仍比较完整审计字段；仅测试清理后的内容恢复比较排除主动 PATCH 产生的两项 settings 审计字段。文章原始时间戳始终不排除。

## 5. Knowledge Capture

- `.trellis/spec/backend/database-guidelines.md` 的 Canonical Editorial Seed Migration 已明确 generated UUID、当前所有权字段、拒绝矩阵与回归命令。
- 根 `pnpm verify` 包含 `tests/seed-install.mjs`；私有真实测试脚本和日志保留在忽略的 `.data/cleanup-test/`。
