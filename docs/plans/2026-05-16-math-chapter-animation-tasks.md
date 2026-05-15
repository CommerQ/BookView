# 数学章节动画 — 实施计划（全场景）

> 设计：[../specs/2026-05-16-math-chapter-animation-design.md](../specs/2026-05-16-math-chapter-animation-design.md)（v1.2，含 §14 库选型）

**Goal:** 全学段、全领域（代数/几何/分析/线代/概率/离散）统一 MAS + Classifier + 分模板 Planner + LayerRegistry 播放。

**Architecture:** Classifier → 多 scene_kind Planner → 合并 MAS → MathAnimPlayer 按层渲染。

---

## 任务总览

| 阶段 | 任务 | 场景覆盖 |
|------|------|----------|
| M1 | Task M1–M2 | 内核 + 3 手写样例 |
| M2 | Task M3–M5 | algebra, generic |
| M3 | Task M6–M7 | geometry |
| M4 | Task M8 | analysis |
| M5 | Task M9 | linear_algebra, probability, discrete |
| M6 | Task M10 | KG、编辑、导出、回归集 |

---

### Task M1: MAS 1.1 Schema（全图元）

**Files:** `shared/schemas/mas-v1.1.json`

- [ ] 定义 `meta.domains`, `scene.scene_kind`, `scene.domain`
- [ ] `canvas` 全部图元键（§7.3 表）
- [ ] `enter` 含 `mark`, `construct`, `partition`, `inductionStep`
- [ ] ajv / jsonschema 单测

---

### Task M2: 三领域手写金样例

**Files:** `samples/mas/`

- [ ] `algebra-quadratic.graph_exploration.json`
- [ ] `geometry-triangle-proof.geometry_proof.json`
- [ ] `analysis-limit-epsilon.limit_proof.json`

---

### Task M3: LayerRegistry + Interpreter 骨架

**Files:** `frontend/src/features/mathAnim/`

- [ ] 安装：`gsap`, `@gsap/react`, `katex`, `mafs`, `jsxgraph`, `d3`
- [ ] `animation/presets.ts`：fadeUp / strokeDraw / pulse / paramSmooth
- [ ] `LayerRegistry`：`FormulaLayer`(KaTeX)、`MafsLayer`、`JSXGraphLayer`
- [ ] `masInterpreter.ts`：解析 `enter` → GSAP
- [ ] `MathAnimPlayer.tsx`：SceneTabs + Transport
- [ ] M1 三样例可逐步播放

---

### Task M4: Scene Classifier

**Files:** `backend/app/services/math_scene_classifier.py`, `prompts/math/classifier.txt`

- [ ] 输入章节包 → `detected.scenes[]`
- [ ] 规则兜底（标题关键词）
- [ ] 单测：混合章节分出 ≥2 scene

---

### Task M5: 代数 Planner + API

**Files:** `prompts/math/algebra/*`, `math_anim_planner.py`, `api/math_animations.py`

- [ ] few-shot：`worked_example`, `graph_exploration`, `definition_intuition`
- [ ] `POST .../animations/generate`
- [ ] 图元校验：algebra 场景禁用 `distribution`

---

### Task M6: GeometryLayer

- [ ] `GeometryLayer`：点线圆、辅助线
- [ ] `enter.mark`, `enter.construct`
- [ ] 样例 `geometry-triangle-proof` 全绿

---

### Task M7: geometry Planner 模板

- [ ] `prompts/math/geometry/geometry_proof.txt`
- [ ] `prompts/math/geometry/construction.txt`

---

### Task M8: Analysis 层 + 模板

- [ ] `LimitLayer`, `IntegralLayer`
- [ ] `prompts/math/analysis/limit_proof.txt` 等
- [ ] 样例 `analysis-limit-epsilon` 全绿

---

### Task M9: 线代 / 概率 / 离散

- [ ] `VectorMatrixLayer`, `ChartDistributionLayer`, `InductionLayer`
- [ ] 各 domain 至少 1 个 prompt + 1 个 sample
- [ ] Classifier 识别 6 个 domain

---

### Task M10: 生产化

- [ ] 教师 MAS 编辑 `PATCH /animations/{id}`
- [ ] KG 辅助 scene 排序
- [ ] `samples/mas/` 13 scene_kind 各 1 金样例 + 回归测试
- [ ] Manim 导出（可选）

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-16 | 初稿 |
| 1.1 | 2026-05-16 | 全场景任务拆分 M1–M10 |
