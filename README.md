# BookView

智能文档阅读平台：Web 阅读体验（GSAP 动效）+ **Python 后台** + **PDF/EPUB 结构存储** + **知识图谱** + **本地 AI（Ollama）**。

## 产品阶段

| 阶段 | 范围 | 文档 |
|------|------|------|
| **Phase 1** | 纯前端 EPUB 阅读器（IndexedDB，无后台） | 见下表「阅读器」 |
| **Phase 2** | FastAPI 后台、PDF 结构入库、知识图谱、Ollama 本地模型 | 见下表「平台」 |

> 当前 GitHub 仓库 **尚无应用代码**，仅有规格说明；Phase 1 与 Phase 2 可并行或先 2a 再对接前端。

## 文档

### 阅读器（Phase 1）

| 文档 | 说明 |
|------|------|
| [需求规格](docs/specs/2026-05-15-bookview-requirements.md) | EPUB 阅读、GSAP、本地存储 |
| [设计说明](docs/specs/2026-05-15-bookview-design.md) | 前端架构 |
| [实施计划](docs/plans/2026-05-15-bookview-tasks.md) | 前端 Task 1–9 |

### 平台（Phase 2）— 后台 / PDF / 图谱 / AI

| 文档 | 说明 |
|------|------|
| [平台需求](docs/specs/2026-05-15-bookview-platform-requirements.md) | Python API、文档结构、知识图谱、Ollama |
| [平台设计](docs/specs/2026-05-15-bookview-platform-design.md) | PostgreSQL、解析流水线、RAG、图谱 |
| [平台实施计划](docs/plans/2026-05-15-bookview-platform-tasks.md) | 后台 Task 1–10 |

## 技术栈（目标）

- **前端：** React, TypeScript, Vite, GSAP  
- **后台：** Python 3.11, FastAPI, Celery, PostgreSQL, pgvector  
- **文档：** PyMuPDF（PDF）, ebooklib（EPUB）  
- **AI：** Ollama（本地 chat + embedding）  
- **图谱：** PostgreSQL 实体/关系表（可演进 Neo4j）

## 本地开发（规划）

```bash
docker compose up -d postgres redis
# 可选：docker compose --profile ai up -d ollama
cd backend && uvicorn app.main:app --reload
cd frontend && npm run dev
```
