# PDFTranslate — PDF 翻译网站

一个支持完整翻译工作流的 PDF 翻译网站 Demo。后端为虚拟模拟服务，前端展示完整上传→翻译→下载流程。

## 功能特性

- 📄 拖拽 / 点击上传 PDF（最大 50 MB）
- 🌍 10+ 种语言互译（中/英/日/韩/法/德/西/俄/阿/葡）
- 📊 实时翻译进度：解析 → 提取文本 → 翻译引擎 → 重排版
- ⬇️ 翻译完成后一键下载
- 📱 响应式设计，支持移动端

## 快速启动

```bash
# 安装后端依赖
cd backend
npm install

# 启动服务（默认端口 3001）
npm start

# 浏览器访问
open http://localhost:3001
```

## 项目结构

```
├── backend/
│   ├── server.js       # Express 服务：上传、状态轮询、下载接口
│   └── package.json
└── frontend/
    ├── index.html      # 页面结构
    ├── style.css       # 样式
    └── app.js          # 前端逻辑（文件选择、进度轮询、下载）
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/upload` | 上传 PDF，返回 `taskId` |
| `GET`  | `/api/status/:taskId` | 轮询翻译进度 |
| `GET`  | `/api/download/:taskId` | 下载译文 PDF |
| `GET`  | `/api/languages` | 获取支持语言列表 |

## 说明

后端为模拟（虚拟）实现：翻译过程通过定时器模拟多步骤流水线，下载时返回原始上传文件。
如需接入真实翻译 API（如 DeepL / Google Translate），只需替换 `server.js` 中的 `simulateTranslation` 函数。
