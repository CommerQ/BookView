# BookView 平台实施计划（Phase 2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.
>
> 需求：[../specs/2026-05-15-bookview-platform-requirements.md](../specs/2026-05-15-bookview-platform-requirements.md)  
> 设计：[../specs/2026-05-15-bookview-platform-design.md](../specs/2026-05-15-bookview-platform-design.md)

**Goal:** Python 后台 + PostgreSQL 文档结构存储 + PDF/EPUB 入库 + Ollama 本地 AI + 知识图谱。

**Architecture:** FastAPI monorepo `backend/`；Celery worker 解析与抽图谱；pgvector RAG；前端逐步改调 API。

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, Alembic, PostgreSQL, pgvector, PyMuPDF, ebooklib, Celery, Redis, Ollama, httpx

---

## 阶段顺序

| 子阶段 | 任务 | 产出 |
|--------|------|------|
| **2a** | Task 1–6 | API、DB、PDF/EPUB 入库、结构查询 |
| **2b** | Task 7–8 | Ollama、embedding、RAG |
| **2c** | Task 9–10 | 图谱构建、前端图谱与 AI 面板 |

---

### Task 1: 后台脚手架与 Docker

**Files:** `backend/pyproject.toml`, `backend/app/main.py`, `docker-compose.yml`, `.env.example`

- [ ] **Step 1:** `backend/` 使用 `uv init` 或 `poetry new`，依赖：`fastapi`, `uvicorn[standard]`, `sqlalchemy`, `alembic`, `psycopg[binary]`, `python-multipart`, `pydantic-settings`
- [ ] **Step 2:** `docker-compose.yml`：`postgres`（`pgvector/pgvector:pg16`）、`redis`
- [ ] **Step 3:** `GET /health` 返回 `{ "status": "ok" }`
- [ ] **Step 4:** `docker compose up -d` 后 `uvicorn app.main:app --reload` 可访问 `/docs`

---

### Task 2: 数据模型与迁移

**Files:** `backend/app/models/`, `alembic/versions/001_initial.py`

- [ ] **Step 1:** 建模 `Document`, `Section`, `Page`, `Block`, `IngestJob`（见设计 ER 图）
- [ ] **Step 2:** Alembic 初始化迁移；`Block.plain_text` + `search_vector` generated column
- [ ] **Step 3:** 启用 `pgvector` 扩展；预留 `BlockEmbedding(block_id, vector)` 表

---

### Task 3: 文件上传与存储

**Files:** `backend/app/api/documents.py`, `backend/app/services/storage_files.py`

- [ ] **Step 1:** `POST /documents` 保存至 `data/uploads/{uuid}.pdf`
- [ ] **Step 2:** 写 `Document` 记录，`status=pending`
- [ ] **Step 3:** `GET /documents`、`GET /documents/{id}`、`DELETE /documents/{id}`

---

### Task 4: PDF 解析入库（FR-D02）

**Files:** `backend/app/services/ingest_pdf.py`, `backend/app/workers/tasks.py`

- [ ] **Step 1:** PyMuPDF 遍历页，提取 blocks（text + bbox）
- [ ] **Step 2:** 写入 `Page`、`Block`；PDF outline → `Section`
- [ ] **Step 3:** Celery task `ingest_document(document_id)` 或 BackgroundTasks MVP
- [ ] **Step 4:** 完成后 `Document.status=ready`；失败 `failed` + error_message

---

### Task 5: EPUB 解析入库（FR-D03）

**Files:** `backend/app/services/ingest_epub.py`

- [ ] **Step 1:** ebooklib spine → Section；html → Blocks
- [ ] **Step 2:** 共用 Task 4 的 job 流水线

---

### Task 6: 结构查询 API（FR-D05）

**Files:** `backend/app/api/structure.py`

- [ ] **Step 1:** `GET /documents/{id}/structure` 返回嵌套 JSON 树
- [ ] **Step 2:** `GET /documents/{id}/blocks/{block_id}`
- [ ] **Step 3:** `GET /documents/{id}/pages/{page_number}`（PDF）
- [ ] **Step 4:** 集成测试：上传样例 PDF 后 structure 节点数 &gt; 0

---

### Task 7: Ollama 客户端（FR-AI01）

**Files:** `backend/app/services/ollama_client.py`, `backend/app/core/config.py`

- [ ] **Step 1:** `chat(messages)` → `POST {OLLAMA_BASE_URL}/api/chat`
- [ ] **Step 2:** `embed(texts)` → `/api/embeddings`
- [ ] **Step 3:** `/health` 增加 `ollama` 分项（不可达时 `degraded`）

---

### Task 8: Embedding + RAG（FR-AI02–03）

**Files:** `backend/app/services/rag.py`, `backend/app/api/ai.py`

- [ ] **Step 1:** 入库完成后批量 embed blocks 写入 `block_embeddings`
- [ ] **Step 2:** `POST /ai/ask`：检索 top-5 + chat + citations
- [ ] **Step 3:** `POST /ai/summarize` 缓存至 `summaries` 表

---

### Task 9: 知识图谱（FR-K01–K04）

**Files:** `backend/app/models/graph.py`, `backend/app/services/kg_extract.py`, `prompts/extract_graph.txt`

- [ ] **Step 1:** 表 `entities`, `relations`
- [ ] **Step 2:** Worker：按 block 批次调 Ollama 抽 JSON → 落库
- [ ] **Step 3:** `POST /documents/{id}/build-graph`；`GET /graph/documents/{id}/subgraph`
- [ ] **Step 4:** 实体带 `source_block_id` 溯源

---

### Task 10: 前端对接（FR-F01–F05）

**Files:** `frontend/src/api/client.ts`, `GraphView.tsx`, `AiPanel.tsx`

- [ ] **Step 1:** API client 基址 `VITE_API_URL=http://localhost:8000`
- [ ] **Step 2:** Library 改 `POST/GET /documents`；展示 job 状态
- [ ] **Step 3:** Reader 按 structure API 拉块/页（PDF 分页）
- [ ] **Step 4:** `GraphView` 力导向图展示 subgraph
- [ ] **Step 5:** 阅读器侧栏 `POST /ai/ask`

---

## Spec 覆盖自检

| 需求 | 任务 |
|------|------|
| FR-B01–B05 | Task 1, 7 |
| FR-D01–D05 | Task 2–6 |
| FR-K01–K05 | Task 9 |
| FR-AI01–AI05 | Task 7–8 |
| FR-F01–F05 | Task 10 |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-15 | 初稿 |
