# E2E 测试平台实施计划（implementation guide）

## 1. 文档目标与范围

本文件保留平台级、不随单个 feature spec 重复的约束。运行闭环的
具体行为已迁移到：

- [`docs/specs/001-run-artifact-persistence/`](./docs/specs/001-run-artifact-persistence/)
- [`docs/specs/002-failure-statistics/`](./docs/specs/002-failure-statistics/)
- [`docs/specs/003-external-smoke-run-loop/`](./docs/specs/003-external-smoke-run-loop/)

## 2. 平台边界

- `sut-demo` 和 `demo-test-lib` 保持在本仓库外，通过配置接入。
- backend 负责 run 执行、产物、结果入库、和 statistics 数据源。
- frontend 仅消费 backend API，不承载运行语义。

## 3. 核心约束

- 单机、SQLite、低依赖。
- 并发上限固定为 `1`。
- SQLite 写入必须启用 WAL，并保持同一 run 写入链路严格串行
  `await`。
- API、数据库、JSON 字段统一 snake_case。
- 对外资源标识字段固定为 `id`（number）。
- `case_results.test_lib_case_code` 是统计唯一主键，`case_title` 仅
  用于展示。

## 4. 运行状态、时间、reason

- `created_at` 是唯一排队时间字段。
- `start_time` 只在 probe 通过且 runner 进入 spawn 路径时写入。
- `end_time` 和 `duration_ms` 只在终态收尾完成后写入。
- 当前锁定的 `fail` reason 码仍是：
  - `probe_failed`
  - `cases_failed`
  - `runner_exit_nonzero`
  - `parse_or_write_error`
- `timeout` 使用 `reason=timeout_exceeded`。
- `duration_ms` 仅在 `start_time` 和 `end_time` 都存在时写入。

## 5. 迁移入口

- 运行产物布局和 `meta.json` 规则见
  [`001-run-artifact-persistence`](./docs/specs/001-run-artifact-persistence/).
- failures 聚合规则和 `/api/statistics/failures` 见
  [`002-failure-statistics`](./docs/specs/002-failure-statistics/).
- singleton smoke suite、FIFO run loop、probe、spawn、timeout、和
  `results.json` ingest 见
  [`003-external-smoke-run-loop`](./docs/specs/003-external-smoke-run-loop/).

## 6. API 约定

- `GET /api/suites`
- `POST /api/runs`
- `GET /api/runs`
- `GET /api/runs/{id}`
- `GET /api/statistics/failures`

统一错误体：

```json
{
  "error": {
    "message": "string"
  }
}
```

`400` 表示无效输入，`404` 表示资源不存在。

## 7. DB 与 migration

- 以 `apps/server/prisma/schema.prisma` 为唯一事实来源。
- schema 变更必须同步 migration。
- `Suite` 保持最小字段集，且 `suite_name` 为唯一。

## 8. 实施顺序

1. 优先完成 `003-external-smoke-run-loop`.
2. 其次保持 `001-run-artifact-persistence` 与 `002-failure-statistics`
   行为稳定。
3. 最后再扩展前端或其他非本 slice 能力。
4. 标识规则：直接暴露数据库自增主键作为资源 `id`。
5. 排障链路：服务端日志与 `meta.json` 使用单一 `id` 语义；如需资源上下文，使用 `run_id` / `suite_id` 命名。
6. 取消接口：请求体必须为空，不接收客户端自定义 `reason`；服务端固定 `reason=user_cancelled`。终态取消返回 `400`，保持统一错误体，`error.message` 仅返回可读文案（不携带 `status/reason` 结构化片段）。
7. logs 接口（MVP）：`GET /api/runs/{id}/logs/stdout`，返回 `lines(string[])`、`next_cursor`、`has_more`；`cursor` 为字节偏移整数。后续可扩展 `/logs/stderr`。
8. run 详情接口包含 `artifacts` 对象：`{ stdout_log, stderr_log, results_json, report_dir }`。
9. report 接口行为：可 `302` 跳转或后端反向代理返回 HTML。
10. 产物缺失访问语义：目标文件/目录不存在时 API 返回 `404`，页面提示“未生成/已被清理”。

### 13.8 logs API 待定细则（实现前定稿）

1. `lines` 的切分规则（`\n` / `\r\n`、是否保留换行符）。
2. `next_cursor` 的精确类型与 `null` 条件。
3. `tail` 与 `cursor` 同时出现时的优先级规则。
4. 日志正在写入时，最后一条“半行”的处理规则。
5. 文本编码约定（默认 UTF-8 或其他）。
6. 进入 logs API 开发前，先定稿以上细则，并同步单元/集成测试用例。
