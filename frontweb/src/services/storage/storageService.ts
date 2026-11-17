import type { BookRecord, ReadingProgress } from '../../types/book';
import { getDb, STORE } from './db';

/** 统一的进度存储键，需求 FR-S02 固定该格式 */
const progressKey = (bookId: string) => `bookview:progress:${bookId}`;

/**
 * 读取某本书的阅读进度。
 * @returns 无记录或数据损坏时返回 null
 */
export function getProgress(bookId: string): ReadingProgress | null {
  const raw = localStorage.getItem(progressKey(bookId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ReadingProgress;
  } catch {
    // 容错：历史脏数据不应阻塞阅读
    return null;
  }
}

/**
 * 写入阅读进度（段索引 + 章节内滚动比例 + 更新时间）。
 * @param scrollRatio 章节内滚动位置比例，0 表示段首
 */
export function setProgress(bookId: string, sectionIndex: number, scrollRatio = 0): void {
  // 夹紧比例，避免异常值导致恢复后越界
  const ratio = Number.isFinite(scrollRatio) ? Math.min(1, Math.max(0, scrollRatio)) : 0;
  const payload: ReadingProgress = { bookId, sectionIndex, scrollRatio: ratio, updatedAt: Date.now() };
  localStorage.setItem(progressKey(bookId), JSON.stringify(payload));
}

/** 清除某本书的阅读进度（删除书籍时联动调用） */
export function clearProgress(bookId: string): void {
  localStorage.removeItem(progressKey(bookId));
}

/**
 * 保存书籍：元数据与原始文件写入同一个 IDB 记录。
 */
export async function saveBook(record: BookRecord, fileBytes: ArrayBuffer): Promise<void> {
  const db = await getDb();
  await db.put(STORE, { id: record.id, meta: record, fileBytes });
}

/** 列出书库中的全部书籍元数据 */
export async function listBooks(): Promise<BookRecord[]> {
  const db = await getDb();
  const records = await db.getAll(STORE);
  return records.map((record) => record.meta);
}

/** 按 id 读取书籍元数据与原始文件 */
export async function getBook(
  id: string
): Promise<{ meta: BookRecord; fileBytes: ArrayBuffer } | null> {
  const db = await getDb();
  return (await db.get(STORE, id)) ?? null;
}

/**
 * 删除书籍：同时清除该书阅读进度（FR-L03 / S7）。
 */
export async function deleteBook(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, id);
  clearProgress(id);
}
