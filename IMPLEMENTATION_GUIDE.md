# E2E 测试平台实施计划（implementation guide）

## 1. 文档目标与范围

本文件用于指导项目实现，目标是在单机环境完成一个可稳定演示的 Web E2E 测试平台闭环：

- 触发执行（suite -> run）
- 排队调度（FIFO，并发上限 1）
- 运行控制（超时、取消、重启恢复）
- 产物归档（artifacts + meta.json）
- 结果解析入库（runs + case_results）
- 查询与统计（列表、详情、失败聚合 statistics）

## 2. 子系统边界与交付

- `sut-demo`（被测系统）：独立仓库，已准备就绪；本地默认 `http://localhost:3000`。
- `demo-test-lib`（测试库）：独立仓库，已准备就绪；至少提供 `npm run test:smoke`。
- `platform`（本项目核心）：当前仓库负责实现，技术栈为 NestJS + Prisma + SQLite + React（可用 Ant Design）。

跨仓协作约束（实现需满足）：

- platform 不托管 `sut-demo` 与 `demo-test-lib` 源码，通过配置接入外部仓库。
- run 执行时的命令与工作目录（`command` + `cwd`）由 platform 记录并驱动。
- platform 通过 `sut_base_url` + `probe_url` 与 SUT 联通。
- 运行产物统一落在 platform 侧 `artifacts/` 目录。

## 3. 非目标（明确不做）

- 分布式调度、多机 runner 池、消息队列
- 在线编写/调试测试脚本
- 用例级取消（仅 run 级取消）
- 实时日志逐行入库
- 复杂权限系统、多租户

## 4. 约束与核心原则

- 单机部署，低外部依赖，SQLite 作为核心存储。
- 并发上限固定为 `1`，单写者写库策略。
- SQLite 稳健写入约束：启用 WAL；同一时刻仅一个写事务；同一 run 写入链路严格串行 `await`；禁止 `Promise.all` 并行写库。
- 存储技术边界（v1）：不切换为 MySQL，保持 SQLite 单机方案。
- 结果统计以数据库结构化明细为准（`case_results` 是统计唯一数据源）。
- 用例统计主键使用 `test_lib_case_code`，`case_title` 仅用于展示。
- API、数据库、JSON 字段名统一使用 snake_case；对外资源标识字段名固定为 `id`（string）。
- API 仅暴露对外 string `id`，不暴露内部自增主键。
- DB 与文件产物必须可双向追溯。
- 排障链路要求：服务端日志与 `meta.json` 必须同时记录 `internal_id` 与对外 `id`；前端与 API 不直接接触 `internal_id`。

## 5. 总体架构与模块

- API 层：`suites/runs/cancellations/logs/report/cases/statistics`
- 调度层：`pending` 队列、running 槽位、超时控制、状态迁移
- 执行器：`child_process.spawn` 启动 Playwright 命令
- 产物层：固定目录推导 + `meta.json` 快照
- 解析入库层：读取 `results.json`，批量写入 `case_results`，回填 `runs`
- 前端展示层：runs 列表、run 详情、statistics

## 6. 运行状态机与时间语义

### 6.1 状态机

- 状态集合：`pending -> running -> (success | fail | timeout | cancelled | abort)`
- 关键定义：
  - `success`：执行成功且解析入库成功
  - `fail`：probe 失败 / 用例失败 / 退出码异常 / 解析写库失败
  - `timeout`：平台超时触发终止
  - `cancelled`：用户取消
  - `abort`：服务重启或关闭导致中断

### 6.2 时间字段（权威）

- `created_at`：创建并入队时间（必填）
- `start_time`：probe 通过且准备/已 spawn runner（未进入执行时为 `NULL`）
- `end_time`：进入终态且完成必要收尾（终态必填）
- `duration_ms`：`end_time - start_time`（仅 start/end 均有值时写入）

## 7. 调度、执行、取消、恢复

### 7.1 调度

- 新建 run 默认 `pending`。
- 调度器循环：若无 `running`，按 `created_at` FIFO 取队首执行。
- 全局并发固定 1。

### 7.2 预检查（probe）

- 默认 `probe_url = ${sut_base_url}/`
- HTTP `2xx-3xx` 判定通过
- 超时 3 秒，重试 1 次（总尝试 2 次）
- 失败则 `status=fail`、`reason=probe_failed`

### 7.3 执行器

- 通过 `spawn` 启动 suite 命令（如 `npm run test:smoke`）
- stdout/stderr 直接落文件：`stdout.log`、`stderr.log`
- 运行结束后再解析 `results.json`，批量写入数据库

### 7.4 超时与取消

- 超时阈值默认 10 分钟，触发后终止进程并标记 `timeout`
- 取消 API：`POST /api/runs/{id}/cancellations`
- 统一终止入口：`terminate_run(internal_run_id, reason)`
- `pending`：直接出队终止
- `running`：优先 `SIGTERM`，短等待后 `SIGKILL`（针对 pgid）

### 7.5 重启恢复

- 服务启动时扫描历史 `pending/running`
- 统一收敛为 `abort` + `reason=server_restart`
- 若 `meta.json` 存在存活 pgid，执行进程组清理（TERM -> KILL）

## 8. 产物归档与 meta.json

### 8.1 路径规则（由 internal_run_id 推导）

- 根目录：`artifacts/run-<internal_run_id>/`
- 文件/目录：
  - `stdout.log`
  - `stderr.log`
  - `results.json`
  - `playwright-report/`
  - `meta.json`
  - `test-results/`（可选）
- 访问缺失语义：目标文件/目录不存在时，对应 API 返回 `404`；页面层提示“未生成/已被清理”。

### 8.2 meta.json 规则

- 包含 `meta_schema_version`（默认 1）
- 不维护 artifacts 索引（所有产物路径由约定推导）
- 最小建议字段：
  - `identity.run { id, internal_id }`
  - `identity.suite { id, internal_id, suite_name_snapshot }`
  - `execution { command, cwd }`
  - `config { sut_base_url, probe_url }`
  - `result { status, reason, exit_code, timeout_minutes }`
  - `timing { created_at, start_time, end_time, duration_ms }`
  - `process { runner_pgid, started_at, platform_pid }`

### 8.3 DB 与 meta 权威边界

- DB 权威：身份关系、状态、原因、时间、统计字段
- meta 权威：运行现场与环境快照
- 冲突读法：以 DB 为准
- 写入策略：`DB -> meta(best-effort)`；若 meta 写入失败，不回滚 DB，记录结构化告警日志。

## 9. 双 ID 策略（必须先落地）

### 9.1 原则

- DB 使用内部 `INT` 主键：`suites.id`、`runs.id`
- API 对外统一返回 string `id`
- 外键与落盘目录均使用内部 id
- 对外 id 默认不落库（派生值）

### 9.2 协议

- 格式：`<typePrefix><version>~<payload>~<sig>`
- 待签名串：`<typePrefix><version>:<payload>`
- `payload`：内部 id 的可逆编码（推荐 base36）
- `sig`：`base64url(HMAC-SHA256(secret, signing_input))`
- 前缀：`runs=r`，`suites=s`

### 9.3 解析与错误语义

- 接口先验签、再解码 internal id，再查 DB/文件
- 任一步失败（格式、验签、类型不匹配、资源不存在）统一 `404`
- 签发策略：始终使用最新 `version` 对外签发 id
- 验签策略：支持多版本验签（按 id.version 选择 secret）
- 轮换策略：旧版本提供退役窗口，窗口结束后下线验签

## 10. 数据库模型与索引（以 schema.prisma 为准）

权威定义文件：`schema.prisma`（仓库根目录）。

### 10.1 表结构（按 schema）

本节以 `schema.prisma` 为唯一事实来源（source of truth），不在文档内重复列出字段明细。

### 10.2 枚举、默认值与关系

本节以 `schema.prisma` 为唯一事实来源（source of truth），不在文档内重复列出枚举、默认值与关系明细。
`runs.reason` 的业务口径与白名单规则见第 14.1、14.7。

### 10.3 索引（按 schema）

本节以 `schema.prisma` 为唯一事实来源（source of truth），索引变更以 schema 与 migration 为准。

## 11. API 最小契约（MVP）

- MVP 不引入分页参数；后续按数据规模再评估。

- `GET /api/suites`
- `POST /api/runs`（参数：suite 对外 id）
- `GET /api/runs`
  - MVP：全量返回（按 `created_at` 倒序）
- `GET /api/runs/{id}`
  - 返回字段：`id`, `suite_id`, `suite_name`, `status`, `reason`, `exit_code`, `command`, `cwd`, `sut_base_url`, `probe_url`, `artifacts`
  - `artifacts`：`{ stdout_log, stderr_log, results_json, report_dir }`
- `POST /api/runs/{id}/cancellations`
  - 请求体：空（不接收客户端自定义 `reason`；服务端固定 `reason=user_cancelled`）
  - 仅 `pending/running` 可取消；终态取消返回 `400`
  - 对终态 run 返回 `400` 时，保持统一错误体；`error.message` 使用可读文案（不拼接 `status/reason` 结构化片段）
- `GET /api/runs/{id}/logs/stdout?tail=200&cursor`
  - 返回字段：`lines(string[])`, `next_cursor`, `has_more`
  - `cursor` 为字节偏移整数；响应返回 `next_cursor` 与 `has_more`
  - 非法 cursor 返回 `400`
  - MVP：仅开放 `stdout` 子资源；后续可扩展 `GET /api/runs/{id}/logs/stderr?tail&cursor`
  - 待定细则：见 14.9（实现该 API 前定稿）
- `GET /api/runs/{id}/report`
  - 行为：可 `302` 跳转至 report 静态资源，或由后端反向代理返回 HTML
- `GET /api/runs/{id}/cases`
  - 每条返回：`test_lib_case_code`, `case_title`, `status`, `failed_at`
  - MVP：全量返回
- `GET /api/statistics/failures`
  - 聚合键：`test_lib_case_code`
  - 返回：`test_lib_case_code`, `case_title`, `fail_count`, `last_failed_at`, `last_run_id`
  - `last_failed_at` 并列时，`last_run_id` 取最大 internal_run_id 对应的对外 run.id
  - MVP：全量返回

统一错误体：

```json
{
  "error": {
    "message": "string"
  }
}
```

错误处理约定（v1）：

- `error` 仅返回 `message`，不返回 `code`。
- 前端不基于 `message` 做程序分支，仅用于展示；如需分支，使用 HTTP 状态码与接口上下文。

## 12. 前端页面最小实现

- runs 列表页：最近运行、状态、创建 run、取消入口
- run 详情页：概览、日志 tail、报告入口、case 列表
- statistics 页：按 `test_lib_case_code` 聚合失败统计，展示 `case_title`，支持跳转 `last_run_id`

## 13. 建议实施顺序（可直接执行）

1. 配置跨仓联调：接入已就绪的 `sut-demo` 与 `demo-test-lib`（固化 `sut_base_url`、`command`、`cwd`）。
2. 在触发条件满足的 feature PR 内落地 Prisma 基建与 migration（见第 15 节），并以现有 `schema.prisma` 为准执行。
3. 先实现双 ID 编解码库（含验签、404 语义），作为 API 基础依赖。
4. 实现 runs 创建与调度器（FIFO + 并发=1 + 状态流转）。
5. 实现执行器（spawn、日志落盘、超时、取消、清理）。
6. 实现产物路径推导与 meta.json 写入。
7. 在 `demo-test-lib` 引入 `test_lib_case_code`（辅助函数传参方式）并补齐现有用例。
8. 实现本地强校验（格式校验 + 全仓唯一），接入 pre-commit；CI 作为可选兜底。
9. 实现 results 解析与批量入库、runs 摘要回写（`test_lib_case_code` 必填，缺失按 `parse_or_write_error` 处理）。
10. 实现 statistics 聚合查询（按 `test_lib_case_code` 聚合；`last_failed_at` 并列时取最大 internal_run_id）。
11. 实现 logs API 字节偏移 cursor 协议与分页返回 `next_cursor`。
12. 实现前端三页面并联调 API（cases/statistics 展示 `test_lib_case_code + case_title`）。
13. 实现重启恢复逻辑与一致性校验脚本。
14. 用场景集回归（success/fail/timeout/cancelled/abort/probe_failed）。

## 14. 决策归档（已定稿）

### 14.1 运行状态、时间与 reason 口径

1. 仅用户取消 = `cancelled`（`reason=user_cancelled`）；服务关闭/重启导致中断 = `abort`（`reason=server_shutdown/server_restart`）。
2. 时间口径仅保留 `created_at`，不引入 `queued_time`。
3. probe 固定为“超时 3 秒，重试 1 次（总尝试 2 次）”。
4. `fail` 原因码固定 4 项：`probe_failed` / `cases_failed` / `runner_exit_nonzero` / `parse_or_write_error`。
5. `duration_ms` 仅在 `start_time` 与 `end_time` 均存在时写入；否则保持 `NULL`，禁止写 `0`。

### 14.2 统计口径与并列规则

1. statistics 聚合主键使用 `test_lib_case_code`，不再以 `case_title` 作为聚合键。
2. `case_title` 保留为展示文案字段。
3. `last_failed_at` 并列时，`last_run_id` 取最大 internal_run_id 对应的对外 run.id。

### 14.3 `test_lib_case_code` 策略（v1）

1. 在 `case_results` 落库 `test_lib_case_code`（`NOT NULL`）；v1 不新增 `case_key` 列。
2. `test_lib_case_code` 使用全局可读枚举字符串（示例：`AUTH_LOGIN_INVALID_PASSWORD`）。
3. `demo-test-lib` 使用辅助函数传参声明（例如 `caseTest(test_lib_case_code, case_title, fn)`）。
4. 唯一性校验采用“本地脚本强校验 + pre-commit”，CI 可选兜底。

### 14.4 logs cursor 协议

1. `GET /api/runs/{id}/logs/stdout` 的 `cursor` 定义为字节偏移整数。
2. 接口返回 `next_cursor` 与 `has_more`；非法 cursor 返回 `400`。

### 14.5 DB 与 meta 写入策略

1. 写入顺序固定为 `DB -> meta(best-effort)`。
2. 若 meta 写入失败，不回滚 DB，不改变 run 终态。
3. 记录结构化告警日志（同时包含 internal id 与对外 id）。

### 14.6 对外 id 密钥轮换策略

1. 签发：始终使用最新 `version`。
2. 验签：按 id.version 支持多版本 secret。
3. 退役：旧版本保留退役窗口，窗口结束后下线验签能力。

### 14.7 reason 值归纳（当前实现）

1. 按 `runs.status` 分组：
   - `success`：`NULL`
   - `cancelled`：`user_cancelled`
   - `abort`：`server_restart` / `server_shutdown`
   - `timeout`：`timeout_exceeded`
   - `fail`：`probe_failed` / `cases_failed` / `runner_exit_nonzero` / `parse_or_write_error`
2. `runs.reason` 当前保持 `String?`，由应用层按状态子集做白名单校验（暂不切 enum）。

### 14.8 补充实施约束（并入）

1. SQLite 写入稳健策略：启用 WAL；同一时刻仅一个写事务；同一 run 写入链路严格串行 `await`；禁止 `Promise.all` 并行写库。
2. 存储技术边界（v1）：不切换为 MySQL，保持 SQLite 单机方案。
3. 命名规范：API、数据库、JSON 字段统一 snake_case；对外资源标识字段固定为 `id`（string）。
4. 排障链路：服务端日志与 `meta.json` 必须同时记录 `internal_id` 与对外 `id`；前端与 API 不直接接触 `internal_id`。
5. 取消接口：请求体必须为空，不接收客户端自定义 `reason`，服务端固定 `reason=user_cancelled`；终态取消返回 `400`，保持统一错误体，`error.message` 仅返回可读文案（不携带 `status/reason` 结构化片段）。
6. logs 接口（MVP）：`GET /api/runs/{id}/logs/stdout`，返回 `lines(string[])`、`next_cursor`、`has_more`；`cursor` 为字节偏移整数。后续可扩展 `/logs/stderr`。
7. run 详情接口包含 `artifacts` 对象：`{ stdout_log, stderr_log, results_json, report_dir }`。
8. report 接口行为：可 `302` 跳转或后端反向代理返回 HTML。
9. 产物缺失访问语义：目标文件/目录不存在时 API 返回 `404`，页面提示“未生成/已被清理”。

### 14.9 logs API 待定细则（实现前定稿）

1. `lines` 的切分规则（`\n` / `\r\n`、是否保留换行符）。
2. `next_cursor` 的精确类型与 `null` 条件。
3. `tail` 与 `cursor` 同时出现时的优先级规则。
4. 日志正在写入时，最后一条“半行”的处理规则。
5. 文本编码约定（默认 UTF-8 或其他）。
6. 进入 logs API 开发前，先定稿以上细则，并同步单元/集成测试用例。

## 15. 延期基线（TODO 管理）

### 15.1 Prisma 基建触发条件

以下任一条件成立时，触发“Prisma 校验/迁移命令 + 真实 DB 基线”补齐工作，且必须在同一 feature PR 内完成：

1. 修改 `schema.prisma`。
2. 在应用代码中引入 Prisma Client。
3. 引入任意真实 DB 读写路径（不限于 run/case/suite 相关逻辑）。

### 15.2 触发后必交付项

1. Prisma 命令基线：至少提供 `validate` 与 `migration`（开发阶段）命令，并可在仓库内复现执行。
2. 环境约定：明确 `DATABASE_URL` 的读取方式与样例配置（如 `.env.example`）。
3. 真实 DB 路径决策：明确本地 DB 文件目录（不得与 `artifacts/` 混用）并补充 `.gitignore` 规则。
4. migration 路径决策：明确 migration 目录位置并与仓库结构保持一致。
5. 任务记录：在 PR 或任务说明中记录命令执行结果（成功/失败与原因）。

### 15.3 验收标准

1. 在触发该基线的 PR 中，Prisma 校验命令可执行且通过。
2. migration 命令可执行并生成/应用预期迁移结果。
3. `DATABASE_URL` 与本地 DB 目录规则可被他人按文档直接复现。
4. 目录边界保持清晰：运行产物走 `artifacts/`，数据库文件走独立数据目录。
