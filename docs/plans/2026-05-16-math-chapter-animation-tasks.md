# 数学章节动画 — 实施计划

> **For agentic workers:** 依赖 [平台 Phase 2a](../plans/2026-05-15-bookview-platform-tasks.md)（文档 Section/Block API）完成后启动 M2。
>
> 设计：[../specs/2026-05-16-math-chapter-animation-design.md](../specs/2026-05-16-math-chapter-animation-design.md)

**Goal:** 在指定数学章节上生成可播放的 MAS 动画（本地 Ollama 规划 + 前端 GSAP 解释器）。

**Architecture:** 章节 blocks → Planner → MAS JSON → `MathAnimPlayer`；禁止 AI 直接生成可执行 JS。

**Tech Stack:** MAS JSON Schema, FastAPI, Ollama, React, GSAP, KaTeX, SVG

---

### Task M1: MAS Schema 与手写样例

**Files:** `shared/schemas/mas-v1.json`, `frontend/src/animation/mathAnim/sample-quadratic.json`

- [ ] **Step 1:** 定义 JSON Schema（`scenes`, `steps`, `canvas`, `enter`）
- [ ] **Step 2:** 手写「二次函数图像」样例 5–7 步
- [ ] **Step 3:** Schema 校验单元测试（ajv 或 backend `jsonschema`）

---

### Task M2: MathAnimPlayer（前端）

**Files:** `frontend/src/features/mathAnim/MathAnimPlayer.tsx`, `masInterpreter.ts`, `layers/FormulaLayer.tsx`, `layers/GraphLayer.tsx`

- [ ] **Step 1:** 加载 MAS，`scenes[0].steps` 逐步播放
- [ ] **Step 2:** 实现 `reveal` / `draw` / `emphasize` → GSAP
- [ ] **Step 3:** KaTeX 渲染 `formulas`；SVG 绘制 `graph.function`
- [ ] **Step 4:** Transport：上一步/下一步/减少动效
- [ ] **Step 5:** 路由 `/read/:bookId/section/:sectionId/anim/:animId`

---

### Task M3: 后端生成 API

**Files:** `backend/app/services/math_anim_planner.py`, `api/math_animations.py`, `models/math_animation.py`, `prompts/math_anim_planner.txt`

- [ ] **Step 1:** 表 `math_animations`
- [ ] **Step 2:** 组装章节 context（blocks + 可选 KG concepts）
- [ ] **Step 3:** Ollama Planner → MAS；Schema 校验
- [ ] **Step 4:** `POST .../animations/generate` + job 状态
- [ ] **Step 5:** `GET /animations/{id}`；`PATCH` 编辑；`POST publish`

---

### Task M4: 校验与对照

- [ ] **Step 1:** LaTeX 预检；`fn` 表达式 AST 白名单
- [ ] **Step 2:** `SourcePeek` 面板高亮 `source_blocks`
- [ ] **Step 3:** 教师预览页 + 发布流程

---

### Task M5: 进阶图元（可选）

- [ ] `graph.geometry`（点线圆）
- [ ] `paramTween` 参数动画
- [ ] 章节 KG 用于 step 排序

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-16 | 初稿 |
