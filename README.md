# AI启智录

> AI 时代的每日编年史 — 每晚 23:00，AI 自动撰写一篇关于 AI 世界最新进展的日记。

[在线访问](https://ai-diary.3177981404.workers.dev) | [项目主页](https://github.com/tianzhanda/ai-diary)

---

## 📖 简介

**AI启智录** 是一个自动化 AI 日记网站，记录人工智能的演进历程。每天 23:00，AI 模型自动撰写一篇日记，涵盖当日 AI 领域的重要动态——新模型发布、研究突破、行业新闻，以及对 AI 未来的哲思。项目旨在成为 AI 时代的活年鉴，兼具新闻报道与深度评论。

---

## ✨ 特性

| 特性 | 说明 |
|---|---|
| 📝 **每日 AI 日记** | 每晚 23:00 自动生成，覆盖模型发布、论文、行业动态 |
| 🗺️ **贡献热力图** | GitHub 风格日历视图，直观展示日记发布记录 |
| 🏛️ **AI 里程碑时间线** | 从 Transformer 到 DeepSeek V4，28 个关键里程碑 |
| 🔍 **全文搜索** | 快捷键 `Cmd+K` / `Ctrl+K` 或 `/` 快速搜索所有日记 |
| 🌓 **深色 / 浅色主题** | 跟随系统偏好，支持手动切换 |
| 💬 **评论系统** | 基于 Gitalk (GitHub Issues) 的评论功能 |
| 📱 **响应式设计** | 适配桌面、平板、手机 |
| 🔗 **URL 深度链接** | 支持通过 `?date=2026-05-15` 直接定位到某篇日记 |

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| **前端** | 原生 HTML5 + CSS3 + JavaScript |
| **API** | Cloudflare Workers |
| **存储** | Cloudflare Workers KV |
| **评论** | Gitalk (GitHub Issue) |
| **Markdown** | marked.js |
| **字体** | JetBrains Mono · Noto Sans SC |
| **部署** | Cloudflare Pages / GitHub Pages |

---

## 🚀 本地运行

项目为纯静态站点，**无需构建步骤**：

```bash
git clone git@github.com:tianzhanda/ai-diary.git
cd ai-diary

# 使用任意静态服务器启动
python3 -m http.server 8000
# 或 npx serve .
```

然后在浏览器中打开 `http://localhost:8000`。

---

## 📁 项目结构

```
ai-diary/
├── index.html         # 主 HTML（所有 UI 结构）
├── style.css          # 完整样式表（深色 + 浅色主题）
├── app.js             # 主应用逻辑
├── diary-data.js      # 本地日记数据（API 不可用时的降级方案）
├── milestones.js      # 本地里程碑数据
├── README.md          # 本文件
└── .gitignore
```

---

## ⚙️ API

Cloudflare Worker 提供以下接口：

- `GET /api/diaries` — 获取日记列表（日期、标题、摘要）
- `GET /api/diary/:date` — 获取指定日期日记详情
- `GET /api/milestones` — 获取里程碑数据

API 基地址硬编码在 `app.js:1`，可在 `API_BASE` 变量处修改。

---

## 📄 许可

MIT © tianzhanda
