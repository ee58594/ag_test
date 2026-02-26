# PDFTranslate — PDF 翻译网站

[![🌐 Live Demo](https://img.shields.io/badge/🌐_Live_Demo-GitHub_Pages-4F46E5?style=for-the-badge&logo=github)](https://ee58594.github.io/ag_test/)
[![CI](https://github.com/ee58594/ag_test/actions/workflows/ci.yml/badge.svg)](https://github.com/ee58594/ag_test/actions/workflows/ci.yml)
[![Deploy to Pages](https://github.com/ee58594/ag_test/actions/workflows/pages.yml/badge.svg)](https://github.com/ee58594/ag_test/actions/workflows/pages.yml)

> **🔗 在线访问地址：[https://ee58594.github.io/ag_test/](https://ee58594.github.io/ag_test/)**

一个支持完整翻译工作流的 PDF 翻译网站 Demo。后端为虚拟模拟服务，前端展示完整上传→翻译→下载流程。  
前端**无需后端**即可独立运行（自动切换为浏览器内模拟模式），可直接部署到 **GitHub Pages**。

## 功能特性

- 📄 拖拽 / 点击上传 PDF（最大 50 MB）
- 🌍 10+ 种语言互译（中/英/日/韩/法/德/西/俄/阿/葡）
- 📊 实时翻译进度：解析 → 提取文本 → 翻译引擎 → 重排版
- ⬇️ 翻译完成后一键下载
- 📱 响应式设计，支持移动端
- 🚀 **GitHub Pages 一键部署**（无需服务器）

## 在线体验（GitHub Pages）

> 推送到 `main` 分支后，GitHub Actions 自动部署到：
>
> **https://ee58594.github.io/ag_test/**

在 GitHub Pages 上，前端会自动切换为**浏览器内模拟模式**——无需任何后端服务，翻译流程完全在浏览器中模拟运行。

## 自动部署说明

### GitHub Actions 工作流

| 文件 | 触发条件 | 作用 |
|------|----------|------|
| `.github/workflows/ci.yml` | 所有 push / PR | 安装依赖、语法检查、运行测试（Node 20 & 22） |
| `.github/workflows/pages.yml` | push 到 `main` | 运行 CI → 将 `frontend/` 部署到 GitHub Pages |

### 启用 GitHub Pages 步骤

1. 进入仓库 **Settings → Pages**
2. **Source** 选择 `GitHub Actions`
3. 推送代码到 `main` 分支，工作流自动执行

### 本地开发（带真实后端）

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
# 一键启动（使用 docker-compose）
docker compose up -d

# 浏览器访问
open http://localhost:3001
```

### Render 部署（云端 Node.js 后端）

1. 在 [Render](https://render.com) 新建 Web Service，连接本仓库
2. Render 会自动读取 `render.yaml` 配置并部署
3. 部署完成后将 Render 服务 URL 更新到前端 `app.js` 的 `API_BASE` 即可接入真实后端

## 项目结构

```
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI：安装 + 语法检查 + 测试
│       └── pages.yml       # CD：部署到 GitHub Pages
├── backend/
│   ├── server.js           # Express 服务（虚拟翻译后端）
│   ├── test/
│   │   └── health.test.js  # 后端健康检查测试
│   └── package.json
├── frontend/
│   ├── index.html          # 页面结构
│   ├── style.css           # 样式
│   └── app.js              # 前端逻辑（含浏览器内 mock 模式）
├── Dockerfile              # 容器化构建
├── docker-compose.yml      # 本地一键启动
└── render.yaml             # Render 云部署配置
```

## API 接口（后端模式）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传 PDF，返回 `taskId` |
| `GET`  | `/api/status/:taskId` | 轮询翻译进度 |
| `GET`  | `/api/download/:taskId` | 下载译文 PDF |
| `GET`  | `/api/languages` | 获取支持语言列表 |

## 说明

前端 `app.js` 在启动时尝试访问 `/api/languages`：
- **成功** → 使用真实后端（本地开发或 Render 部署）
- **失败** → 自动切换为浏览器内模拟模式（适用于 GitHub Pages）

如需接入真实翻译 API（如 DeepL / Google Translate），只需替换 `backend/server.js` 中的 `simulateTranslation` 函数。
