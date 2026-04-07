# AlgoManager · 算法项目智能管理平台

[![CI](https://github.com/ee58594/ag_test/actions/workflows/ci.yml/badge.svg)](https://github.com/ee58594/ag_test/actions/workflows/ci.yml)

> 基于大模型能力的算法项目全生命周期管理平台，支持多 Agent 协作、迭代追踪与智能分析。

## 产品概述

AlgoManager 是一个面向算法/建模团队的项目管理工具，核心理念是通过多角色 AI Agent 协作，覆盖算法项目从立项到持续运营的完整生命周期。

### 六大 Agent 场景

| 场景 | 说明 | 参与 Agent |
|------|------|-----------|
| 🚀 **初始建模** | 给定输入数据，设计开发代码，获取回测结果 | 项目经理、数据分析师、建模工程师、质量评估师 |
| 📊 **迭代优化分析** | 多维度分析建模结果，发现提升机会，制定优化计划 | 数据分析师、建模工程师、业务顾问 |
| 🔍 **运营复盘** | 复盘近期运行情况，异常分析，根因定位，发现迭代机会 | 根因分析师、数据分析师、项目经理 |
| 💼 **业务驱动优化** | 依据业务给定优化方向，数据探索与建模优化及回测 | 业务顾问、数据分析师、建模工程师、质量评估师 |
| ❓ **业务问题分析** | 对业务方提出的疑问进行数据分析，解释具体原因 | 数据分析师、业务顾问 |
| 📈 **监控大盘** | 制定预测异常关键指标，实时展示数据大盘 | 数据分析师、根因分析师 |

### 核心功能

- **项目全生命周期管理**：多项目并行管理，版本迭代追踪，指标趋势可视化
- **多 Agent 协作**：6种角色（项目经理、数据分析师、建模工程师、业务顾问、质量评估师、根因分析师）在每个场景中按职责分工协作
- **流式对话输出**：基于 SSE（Server-Sent Events）实现 Agent 对话的实时逐字渲染
- **迭代历史追踪**：完整记录每次迭代的版本、指标、结论、代码片段，支持多维度筛选
- **智能监控大盘**：品类级 MAPE 趋势监控，告警分级，异常根因联动分析

## 快速启动

### 本地开发

```bash
# 安装后端依赖
cd backend && npm install

# 启动服务（默认端口 3001）
npm start

# 浏览器访问
open http://localhost:3001
```

### Docker 部署

```bash
docker compose up -d
open http://localhost:3001
```

## 项目结构

```
├── backend/
│   ├── server.js          # Express 后端：API + Agent SSE 流
│   ├── test/
│   └── package.json
├── frontend/
│   ├── index.html         # 侧边栏导航 + 多视图布局
│   ├── style.css          # 现代化 UI 设计系统
│   └── app.js             # 前端路由、视图渲染、SSE 消费
├── Dockerfile
├── docker-compose.yml
└── render.yaml
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET`  | `/api/meta` | Agent 角色 & 场景元数据 |
| `GET`  | `/api/dashboard` | 总览统计 |
| `GET`  | `/api/projects` | 项目列表 |
| `POST` | `/api/projects` | 创建项目 |
| `GET`  | `/api/projects/:id` | 项目详情 |
| `GET`  | `/api/projects/:id/iterations` | 迭代列表 |
| `GET`  | `/api/projects/:id/metrics-history` | 指标历史（供图表） |
| `POST` | `/api/agent/start` | 创建 Agent 流会话 |
| `GET`  | `/api/agent/stream/:sessionId` | SSE 流式 Agent 对话 |
| `GET`  | `/api/monitoring/:project_id` | 监控大盘数据 |
