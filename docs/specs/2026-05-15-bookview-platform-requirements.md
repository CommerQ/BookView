# BookView 平台需求规格（Phase 2）

| 字段 | 值 |
|------|-----|
| 文档版本 | 1.0 |
| 日期 | 2026-05-15 |
| 状态 | 待评审 |
| 前置阶段 | [Phase 1 阅读器](./2026-05-15-bookview-requirements.md) |
| 关联设计 | [平台设计](./2026-05-15-bookview-platform-design.md) |
| 关联任务 | [平台实施计划](../plans/2026-05-15-bookview-platform-tasks.md) |

---

## 1. 背景与目标

### 1.1 现状（Phase 1 缺口）

当前 Phase 1 规格为 **纯浏览器端**：书籍在 IndexedDB、无服务端、**不支持 PDF**、**无文档结构持久化**、**无知识图谱**、**无 AI**。

### 1.2 Phase 2 目标

构建 **Python 后台**，实现：

1. **文档接入**：EPUB / PDF 上传、解析、结构化入库  
2. **文档结构存储**：可查询的层级结构（文档 → 章节/页 → 块）  
3. **知识图谱**：实体与关系抽取、存储、查询  
4. **本地 AI**：通过 **Ollama**（或兼容 OpenAI API 的本地推理）完成摘要、问答、图谱构建  

前端（React）通过 REST API 访问后台；阅读动效（GSAP）仍在前端。

### 1.3 成功标准

| 指标 | 目标 |
|------|------|
| PDF 入库 | 50 页以内 PDF 在 60s 内完成解析入库（本地开发机） |
| 结构查询 | 按 `document_id` 拉取完整目录树 &lt; 200ms（P95） |
| 图谱构建 | 100 页文档自动抽取 ≥ 20 实体、≥ 30 关系（可调阈值） |
| 本地问答 | 在 Ollama 已启动时，针对选中段落问答首 token &lt; 5s |
| 隐私 | 默认数据与推理均在本地；不外传文档正文 |

---

## 2. 用户与场景

| ID | 场景 | 期望结果 |
|----|------|----------|
| P-S1 | 上传 PDF/EPUB | 后台异步解析，书库显示处理状态 |
| P-S2 | 查看文档结构树 | 展示章节/页/段落层级，可定位到块 |
| P-S3 | 阅读 PDF | 前端按页或块拉取内容渲染（替代纯客户端解析） |
| P-S4 | 构建知识图谱 | 入库后触发/手动触发抽取，图谱可浏览 |
| P-S5 | 图谱探索 | 点击实体查看相关段落与其它实体 |
| P-S6 | 本地 AI 问答 | 对当前章节/选中块提问，调用本地模型回答 |
| P-S7 | 本地 AI 摘要 | 对章节或全书生成摘要并缓存 |

---

## 3. 功能需求

### 3.1 后台服务（Python）

| ID | 需求 | 优先级 | 验收要点 |
|----|------|--------|----------|
| FR-B01 | FastAPI 提供 REST API，OpenAPI 文档可访问 | P0 | `/docs` 可调试 |
| FR-B02 | 文档上传接口（multipart），支持 `.pdf`、`.epub` | P0 | 返回 `document_id` 与任务 id |
| FR-B03 | 异步解析任务队列（入库、抽图谱） | P0 | 状态：pending / running / done / failed |
| FR-B04 | 健康检查：DB、Ollama、磁盘 | P1 | `/health` 返回分项状态 |
| FR-B05 | 配置本地模型端点（`OLLAMA_BASE_URL` 等） | P0 | 未启动 Ollama 时 AI 接口明确报错 |

### 3.2 文档结构存储

| ID | 需求 | 优先级 | 验收要点 |
|----|------|--------|----------|
| FR-D01 | 统一文档模型：Document → Section → Page（PDF）/ Spine（EPUB）→ Block | P0 | 同一套 API 查询 EPUB 与 PDF |
| FR-D02 | PDF：按页解析文本块与 bbox（PyMuPDF） | P0 | 每页至少提取文本块；扫描版标记 `ocr_needed` |
| FR-D03 | EPUB：按 spine 与 html 块解析 | P0 | 与 Phase 1 段概念对齐 |
| FR-D04 | 原始文件存对象存储（本地目录或 MinIO） | P0 | 可重新下载/再解析 |
| FR-D05 | 块级索引：块 id、顺序、父节点、纯文本 | P0 | 支持全文检索（PostgreSQL `tsvector` 或 pgvector） |

### 3.3 知识图谱

| ID | 需求 | 优先级 | 验收要点 |
|----|------|--------|----------|
| FR-K01 | 实体类型：Concept、Person、Org、Location、Event、Term | P0 | 可扩展枚举 |
| FR-K02 | 关系类型：MENTIONS、RELATED_TO、PART_OF、DEFINES、CITES | P0 | 带 `source_block_id` 溯源 |
| FR-K03 | 入库后异步构建图谱（LLM 抽取 + 规则兜底） | P0 | 任务可查询进度 |
| FR-K04 | 图谱查询 API：按实体、关系、文档过滤 | P0 | 返回子图 JSON 供前端可视化 |
| FR-K05 | 实体链接到文档块（可跳转阅读位置） | P1 | 点击实体返回 block 列表 |

### 3.4 本地 AI

| ID | 需求 | 优先级 | 验收要点 |
|----|------|--------|----------|
| FR-AI01 | 集成 **Ollama**：聊天与 embedding 模型可配置 | P0 | 默认 `qwen2.5` + `nomic-embed-text`（可改） |
| FR-AI02 | 段落/块级 embedding 写入向量库（pgvector） | P0 | 支持相似段落检索 |
| FR-AI03 | RAG 问答：基于检索块 + 本地 LLM 生成答案 | P0 | 回答附带引用 block id |
| FR-AI04 | 章节/全书摘要缓存到 DB | P1 | 同文档不重复计费式调用 |
| FR-AI05 | 图谱抽取 prompt 流水线可配置 | P1 | `prompts/` 目录版本化 |

### 3.5 前端对接（Phase 1 演进）

| ID | 需求 | 优先级 | 验收要点 |
|----|------|--------|----------|
| FR-F01 | 书库改为调用后台 `GET /documents` | P0 | 不再仅依赖 IndexedDB |
| FR-F02 | 上传走 `POST /documents` | P0 | 显示解析进度 |
| FR-F03 | 阅读器按 `block`/`page` API 拉内容 | P0 | PDF 按页渲染 |
| FR-F04 | 新增「知识图谱」视图（力导向或树+边） | P1 | 加载子图 &lt; 2s |
| FR-F05 | 阅读页侧栏 AI 问答（调用 `/ai/ask`） | P1 | 显示引用片段 |

---

## 4. 非功能需求

| ID | 需求 |
|----|------|
| NFR-P01 | 后台 Python 3.11+，依赖 `uv` 或 `poetry` 管理 |
| NFR-P02 | PostgreSQL 15+，扩展 `pgvector` |
| NFR-P03 | 解析与 AI 任务可水平扩展 worker（首期单 worker 即可） |
| NFR-P04 | API 需 CORS 允许前端 dev origin |
| NFR-P05 | 敏感配置仅环境变量，不入库 |

---

## 5. 约束与假设

- **本地优先**：Ollama 在本机或局域网；无云 API 硬依赖  
- PDF 首期以 **文字版 PDF** 为主；扫描版列为 Phase 2.1（OCR）  
- 知识图谱首期 **文档内图谱**（单书/subgraph），跨书联邦为 Phase 3  
- Phase 1 客户端能力可保留为 **离线降级**（可选）

---

## 6. 范围外（Phase 2）

- 多租户账号与权限（仅单用户本地部署）
- 移动端原生 App
- 实时协同标注
- 云端模型（可作为后续插件，非默认）

---

## 7. 阶段划分

| 阶段 | 内容 |
|------|------|
| **Phase 1** | 纯前端 EPUB + GSAP（现有 spec） |
| **Phase 2a** | Python API + PostgreSQL + PDF/EPUB 结构存储 + 文件存储 |
| **Phase 2b** | 本地 AI（Ollama + embedding + RAG） |
| **Phase 2c** | 知识图谱构建与前端图谱视图 |
| **Phase 3** | 跨文档图谱、OCR、多用户（待定） |

---

## 8. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-15 | 初稿：后台、PDF 结构、知识图谱、本地 AI |
