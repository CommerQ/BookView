# BookView MVP 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 需求：[../specs/2026-05-15-bookview-requirements.md](../specs/2026-05-15-bookview-requirements.md)  
> 设计：[../specs/2026-05-15-bookview-design.md](../specs/2026-05-15-bookview-design.md)

**Goal:** 交付可导入 EPUB、本地书库（含删除）、GSAP 翻页与路由过渡、进度记忆的 Web 阅读器 MVP。

**Architecture:** `epubService` 只解析；`storageService` 统一 IDB + localStorage；`ReaderView` 双层面板 + `pageTurn`；`AnimatedOutlet` + `routeFade` 满足 FR-A02；无 Zustand。

**Tech Stack:** React 18, TypeScript, Vite, React Router v6, GSAP, @gsap/react, epubjs, idb, Vitest, RTL, fake-indexeddb

---

## 任务顺序说明

| 顺序 | 任务 | 原因 |
|------|------|------|
| 1→3 | 脚手架 → 类型 → **存储（含 IDB）** | Task 7 书库依赖 `saveBook` |
| 4→5 | 翻页动效 → EPUB 解析 | 阅读器依赖两者 |
| 6 | 路由动效 | 可与 7 并行 |
| 7→8 | 书库 → 阅读器 | UI 集成 |
| 9 | 全量验收 | — |

---

## 文件总览

| 路径 | 职责 |
|------|------|
| `src/services/storage/storageService.ts` | IDB 书籍 + localStorage 进度 |
| `src/services/epub/epubService.ts` | 解析与段 HTML |
| `src/animation/pageTurn.ts` | 翻页时间轴 |
| `src/animation/routeFade.ts` | 路由淡入 |
| `src/app/AnimatedOutlet.tsx` | FR-A02 |
| `src/features/library/LibraryView.tsx` | 书库 + 删除 |
| `src/features/reader/ReaderView.tsx` | 阅读 + 翻页 |
| `tests/*.test.ts(x)` | 见各 Task |

---

### Task 1: 初始化工程脚手架

**Files:** `package.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/app/App.tsx`

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts` 后 `npm install`
- [ ] **Step 2:** `npm install react-router-dom gsap @gsap/react epubjs idb`
- [ ] **Step 3:** `npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node fake-indexeddb`
- [ ] **Step 4:** 配置 `vite.config.ts`（`test.environment: 'jsdom'`, `setupFiles: './tests/setup.ts'`）
- [ ] **Step 5:** `tests/setup.ts` 引入 `@testing-library/jest-dom` 与 `fake-indexeddb/auto`
- [ ] **Step 6:** `npm run dev` — Expected: 默认页可打开

---

### Task 2: 共享类型与动画常量

**Files:** `src/types/book.ts`, `src/animation/constants.ts`

- [ ] **Step 1:** 写入类型（见设计 §4.1 `BookRecord` / `ParsedBook` / `ReadingProgress`）
- [ ] **Step 2:** 写入常量 `PAGE_TURN_DURATION=0.45`, `PAGE_OFFSET_PX=48`, `ROUTE_FADE_DURATION=0.25`

---

### Task 3: 存储服务（进度 + IndexedDB）

**Files:** `src/services/storage/db.ts`, `storageService.ts`, `tests/storageService.test.ts`

- [ ] **Step 1:** TDD 进度读写测试（`getProgress` / `setProgress` / `clearProgress`）
- [ ] **Step 2:** 实现 `storageService` 进度 API，键名 `bookview:progress:{bookId}`
- [ ] **Step 3:** 实现 `db.ts`（`idb`，store `books`）
- [ ] **Step 4:** 实现 `saveBook` / `listBooks` / `getBook` / `deleteBook`（`deleteBook` 调用 `clearProgress`）
- [ ] **Step 3b: 写入 `db.ts`**

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookRecord } from '../../types/book';

interface BookViewDB extends DBSchema {
  books: {
    key: string;
    value: { id: string; meta: BookRecord; fileBytes: ArrayBuffer };
  };
}

const DB_NAME = 'bookview';
const STORE = 'books';

export async function getDb(): Promise<IDBPDatabase<BookViewDB>> {
  return openDB<BookViewDB>(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    },
  });
}

export { STORE };
```

- [ ] **Step 4b: 写入 `storageService.ts`**

```typescript
import type { BookRecord, ReadingProgress } from '../../types/book';
import { getDb, STORE } from './db';

const progressKey = (bookId: string) => `bookview:progress:${bookId}`;

export function getProgress(bookId: string): ReadingProgress | null {
  const raw = localStorage.getItem(progressKey(bookId));
  return raw ? (JSON.parse(raw) as ReadingProgress) : null;
}

export function setProgress(bookId: string, sectionIndex: number): void {
  const payload: ReadingProgress = { bookId, sectionIndex, updatedAt: Date.now() };
  localStorage.setItem(progressKey(bookId), JSON.stringify(payload));
}

export function clearProgress(bookId: string): void {
  localStorage.removeItem(progressKey(bookId));
}

export async function saveBook(record: BookRecord, fileBytes: ArrayBuffer): Promise<void> {
  const db = await getDb();
  await db.put(STORE, { id: record.id, meta: record, fileBytes });
}

export async function listBooks(): Promise<BookRecord[]> {
  const db = await getDb();
  return (await db.getAll(STORE)).map((r) => r.meta);
}

export async function getBook(
  id: string
): Promise<{ meta: BookRecord; fileBytes: ArrayBuffer } | null> {
  const db = await getDb();
  return (await db.get(STORE, id)) ?? null;
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
  clearProgress(id);
}
```

- [ ] **Step 5:** 补充 IDB CRUD 测试（`saveBook` / `deleteBook` 等），`npm test -- tests/storageService.test.ts` — Expected: PASS

---

### Task 4: GSAP 翻页时间轴（TDD）

**Files:** `src/animation/pageTurn.ts`, `tests/pageTurn.test.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPageTurnTimeline } from '../src/animation/pageTurn';

const toMock = vi.fn().mockReturnThis();
const timelineMock = {
  to: toMock,
  duration: vi.fn().mockReturnThis(),
  kill: vi.fn(),
};

vi.mock('gsap', () => ({
  timeline: () => timelineMock,
  set: vi.fn(),
}));

describe('createPageTurnTimeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls gsap.to when motion enabled', () => {
    const current = document.createElement('div');
    const next = document.createElement('div');
    createPageTurnTimeline({ current, next }, 'next', false);
    expect(toMock).toHaveBeenCalled();
  });

  it('sets duration 0 when reduced motion', () => {
    const current = document.createElement('div');
    const next = document.createElement('div');
    createPageTurnTimeline({ current, next }, 'next', true);
    expect(timelineMock.duration).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2:** `npm test -- tests/pageTurn.test.ts` — Expected: FAIL

- [ ] **Step 3: 实现 `pageTurn.ts`**

```typescript
import gsap from 'gsap';
import {
  PAGE_TURN_DURATION,
  PAGE_TURN_EASE,
  PAGE_OFFSET_PX,
} from './constants';

export interface PageTurnLayer {
  current: HTMLElement;
  next: HTMLElement;
}

export function createPageTurnTimeline(
  layers: PageTurnLayer,
  direction: 'next' | 'prev',
  reducedMotion: boolean
): gsap.core.Timeline {
  const { current, next } = layers;
  const outX = direction === 'next' ? -PAGE_OFFSET_PX : PAGE_OFFSET_PX;
  const inFromX = direction === 'next' ? PAGE_OFFSET_PX : -PAGE_OFFSET_PX;

  gsap.set(next, { x: inFromX, opacity: 0, display: 'block' });

  const tl = gsap.timeline({
    defaults: { duration: PAGE_TURN_DURATION, ease: PAGE_TURN_EASE },
  });

  tl.to(current, { x: outX, opacity: 0 }, 0).to(next, { x: 0, opacity: 1 }, 0);

  if (reducedMotion) tl.duration(0);

  return tl;
}
```

- [ ] **Step 4:** `npm test -- tests/pageTurn.test.ts` — Expected: PASS

---

### Task 5: EPUB 解析服务

**Files:** `src/services/epub/epubService.ts`, `tests/epubService.test.ts`

- [ ] **Step 1:** Mock `epubjs`，测试 `parseEpub` 映射 title / author / sections
- [ ] **Step 2:** 实现 `parseEpub(file)` → `ParsedBook`（含 `fileBytes`）
- [ ] **Step 3:** 实现 `loadSectionHtml(fileBytes, sections, index)`，内部 `book.load(href)` 取 HTML 字符串
- [ ] **Step 4:** `npm test -- tests/epubService.test.ts` — Expected: PASS

---

### Task 6: 路由过渡（FR-A02）

**Files:** `src/animation/routeFade.ts`, `src/app/AnimatedOutlet.tsx`, 修改 `App.tsx`

- [ ] **Step 1: `routeFade.ts`**

```typescript
import gsap from 'gsap';
import { ROUTE_FADE_DURATION } from './constants';

export function fadeRouteIn(el: HTMLElement, reducedMotion: boolean): gsap.core.Tween {
  gsap.set(el, { opacity: reducedMotion ? 1 : 0 });
  return gsap.to(el, {
    opacity: 1,
    duration: reducedMotion ? 0 : ROUTE_FADE_DURATION,
    ease: 'power1.out',
  });
}
```

- [ ] **Step 2: `AnimatedOutlet.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { fadeRouteIn } from '../animation/routeFade';

export function AnimatedOutlet() {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (ref.current) fadeRouteIn(ref.current, reduced);
  }, [location.pathname, reduced]);

  return (
    <div ref={ref} className="route-outlet">
      <Outlet />
    </div>
  );
}
```

- [ ] **Step 3:** `App.tsx` 使用嵌套路由 `<Route element={<AnimatedOutlet />}>` 包裹 `/` 与 `/read/:bookId`
- [ ] **Step 4:** 手动验证路由切换淡入、减少动效时无过渡

---

### Task 7: 书库视图（FR-L01–L04、FR-L03）

**Files:** `LibraryView.tsx`, `LibraryView.module.css`, `tests/LibraryView.test.tsx`

- [ ] **Step 1:** RTL 测试空状态文案「导入书籍」
- [ ] **Step 2:** `listBooks` 加载列表；`coverBlob` → `URL.createObjectURL`（卸载 revoke）
- [ ] **Step 3:** 导入：`parseEpub` → `saveBook({ id: crypto.randomUUID(), ... }, fileBytes)`
- [ ] **Step 4:** 删除按钮 → `deleteBook` → 刷新（FR-L03）
- [ ] **Step 5:** `npm test -- tests/LibraryView.test.tsx`；手动 S1、S2、S7

---

### Task 8: 阅读器视图（FR-R、FR-A）

**Files:** `ReaderView.tsx`, `TocPanel.tsx`, `ReaderView.module.css`

- [ ] **Step 1:** 无 `getBook` 结果则 `<Navigate to="/" />`；恢复 `getProgress`
- [ ] **Step 2:** 双面板 ref；`goNext`/`goPrev` 调用 `createPageTurnTimeline` + `onComplete` 写 `setProgress`
- [ ] **Step 3:** `isAnimating` 锁；仅动画 transform/opacity
- [ ] **Step 4:** 目录跳转：直接换段 HTML，不播翻页（S5）
- [ ] **Step 5:** `gsap.matchMedia` + 卸载 `revert()`；键盘 ← → Esc（FR-R05）
- [ ] **Step 6:** 手动 S3–S6、FR-A01、FR-A03–A04

`goNext` 核心逻辑见设计 §4.4；`swapPanelRefs` 在动画结束后交换两层 DOM 角色。

---

### Task 9: 全量验收

- [ ] **Step 1:** `npm test` && `npm run build` — Expected: 全 PASS
- [ ] **Step 2:** 勾选需求文档 §8 验收清单
- [ ] **Step 3:** 浏览器清单（NFR-04）

| 浏览器 | 导入 | 翻页 | 目录 | 删除 | 减少动效 |
|--------|------|------|------|------|----------|
| Chrome | ☐ | ☐ | ☐ | ☐ | ☐ |
| Firefox | ☐ | ☐ | ☐ | ☐ | ☐ |
| Safari | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Spec 覆盖自检

| 需求 ID | 任务 |
|---------|------|
| FR-L01, FR-L04 | Task 7 |
| FR-L02 | Task 5, 7 |
| FR-L03 | Task 3, 7 |
| FR-R01–R05 | Task 5, 8 |
| FR-A01, FR-A03, FR-A04 | Task 4, 8 |
| FR-A02 | Task 6 |
| FR-S01, FR-S02 | Task 3 |
| NFR-01–03 | Task 4, 6, 8 |
| NFR-04 | Task 9 |
| NFR-05 | 设计 §10 |
| NFR-06 | Task 3–7, 9 |
| S1–S7 | Task 7–9 |

---

## 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-15 | 初稿 |
| 1.1 | 2026-05-15 | 修正：IDB 先于书库；补 FR-A02/L03/NFR；规范页眉与覆盖表 |
