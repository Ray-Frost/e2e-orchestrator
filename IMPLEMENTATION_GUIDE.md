# E2E 测试平台实施计划（implementation guide）

## 1. 文档目标与范围

本文件保留平台级、不随单个 feature spec 重复的约束。运行闭环的
具体迁移入口见下文 `## 3. 迁移入口`。

## 2. 平台边界

- 平台运行保持单机、SQLite、低依赖模型。
- `sut-demo` 和 `demo-test-lib` 保持在本仓库外，通过配置接入。
- backend 负责 run 执行、产物、结果入库、和 statistics 数据源。
- frontend 仅消费 backend API，不承载运行语义。

## 3. 迁移入口

- 运行产物布局和 `meta.json` 规则见
  [`001-run-artifact-persistence`](./docs/specs/001-run-artifact-persistence/).
- failures 聚合规则和 `/api/statistics/failures` 见
  [`002-failure-statistics`](./docs/specs/002-failure-statistics/).
- singleton smoke suite、FIFO run loop、probe、spawn、timeout、和
  `results.json` ingest 见
  [`003-external-smoke-run-loop`](./docs/specs/003-external-smoke-run-loop/).
- run 详情页、`GET /api/runs/{id}` 的 `result_summary` 扩展、以及
  `artifacts` 的 availability-only 呈现见
  [`004-run-detail-page`](./docs/specs/004-run-detail-page/).
- suites 首页、`GET /api/suites` 的最小展示字段扩展、以及同页
  create-run 反馈见
  [`005-suites-page`](./docs/specs/005-suites-page/).
- runs 列表页、`GET /api/runs` 驱动的只读运营视图、以及运行中列表的
  低并发自动轮询见
  [`006-runs-page`](./docs/specs/006-runs-page/).
- run cancel API、`pending` / `running` 的取消语义、以及 `/runs` /
  `/runs/:id` 的取消入口见
  [`007-run-cancel`](./docs/specs/007-run-cancel/).
- run stdout access、`GET /api/runs/{id}/stdout`、以及 `/runs/:id` 的
  最小 stdout 查看入口见
  [`008-run-stdout-access`](./docs/specs/008-run-stdout-access/).
