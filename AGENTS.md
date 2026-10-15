<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

# 项目硬性规则：仅主会话执行

- 本项目只允许当前主会话执行工作，AI 会话并发数（包含主会话）固定为 **1**。
- 禁止创建、启动或委派任何子代理、辅助代理、外部 AI worker 或并行 AI 会话；不得通过原生子代理工具、`trellis channel spawn`、另起 CLI 进程或转交其他会话来绕过限制。
- 研究、规划、实现、审查、测试和收尾均由主会话依次完成；工具调用也必须串行执行，不使用批量并发调用。
- 当 Trellis 工作流、技能、模板或代理说明要求派发研究、实现或检查代理时，由主会话直接承担对应职责，遵循其规范和质量要求。
- Trellis 必须使用 `codex.dispatch_mode: inline`，Codex 项目配置必须禁用子代理。worker 数量上限不构成启动 worker 的授权。
- 除非用户明确修改本规则，否则默认工作流、技能、模板及后续工具配置均不得放宽此限制。更新 Trellis 或 Codex 配置后，须再次核对本规则仍然有效。
