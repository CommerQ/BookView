import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearProgress,
  deleteBook,
  getBook,
  getProgress,
  listBooks,
  saveBook,
  setProgress,
} from '../src/services/storage/storageService';
import { getDb, STORE } from '../src/services/storage/db';
import type { BookRecord } from '../src/types/book';

/** 构造一份最小可用的书籍记录 */
function makeRecord(id: string, title = '测试书籍'): BookRecord {
  return {
    id,
    title,
    author: '作者',
    sections: [{ index: 0, href: 'chapter1.xhtml', title: '第一章' }],
    createdAt: Date.now(),
  };
}

const bytes = new TextEncoder().encode('fake-epub').buffer;

describe('storageService 进度', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('写入后可读取进度', () => {
    setProgress('book-1', 3);
    const progress = getProgress('book-1');
    expect(progress?.bookId).toBe('book-1');
    expect(progress?.sectionIndex).toBe(3);
    expect(progress?.scrollRatio).toBe(0);
  });

  it('保存章节内滚动比例并夹紧到 0–1', () => {
    setProgress('book-1', 2, 0.42);
    expect(getProgress('book-1')?.scrollRatio).toBeCloseTo(0.42, 5);

    setProgress('book-1', 2, 3);
    expect(getProgress('book-1')?.scrollRatio).toBe(1);

    setProgress('book-1', 2, -1);
    expect(getProgress('book-1')?.scrollRatio).toBe(0);
  });

  it('未记录时返回 null', () => {
    expect(getProgress('missing')).toBeNull();
  });

  it('损坏数据时返回 null 而不抛错', () => {
    localStorage.setItem('bookview:progress:bad', '{not-json');
    expect(getProgress('bad')).toBeNull();
  });

  it('clearProgress 清除记录', () => {
    setProgress('book-2', 1);
    clearProgress('book-2');
    expect(getProgress('book-2')).toBeNull();
  });
});

describe('storageService IndexedDB', () => {
  beforeEach(async () => {
    const db = await getDb();
    await db.clear(STORE);
    localStorage.clear();
  });

  it('保存后可列出书籍', async () => {
    await saveBook(makeRecord('a'), bytes);
    const books = await listBooks();
    expect(books).toHaveLength(1);
    expect(books[0].title).toBe('测试书籍');
  });

  it('getBook 返回元数据与原始文件', async () => {
    await saveBook(makeRecord('b'), bytes);
    const record = await getBook('b');
    expect(record?.meta.id).toBe('b');
    expect(record?.fileBytes.byteLength).toBe(bytes.byteLength);
  });

  it('getBook 对不存在的 id 返回 null', async () => {
    expect(await getBook('nope')).toBeNull();
  });

  it('删除书籍同时清除进度', async () => {
    await saveBook(makeRecord('c'), bytes);
    setProgress('c', 5);
    await deleteBook('c');
    expect(await getBook('c')).toBeNull();
    expect(getProgress('c')).toBeNull();
  });
});
