import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { BookRecord } from '../../types/book';

/** IndexedDB 结构定义：books 表以书籍 id 为主键，value 同时保存元数据与原始文件 */
interface BookViewDB extends DBSchema {
  books: {
    key: string;
    value: { id: string; meta: BookRecord; fileBytes: ArrayBuffer };
  };
}

const DB_NAME = 'bookview';
const STORE = 'books';

let dbPromise: Promise<IDBPDatabase<BookViewDB>> | null = null;

/**
 * 打开（并缓存）BookView 数据库连接。
 * 首次打开时创建 books 对象仓库。
 */
export function getDb(): Promise<IDBPDatabase<BookViewDB>> {
  if (!dbPromise) {
    dbPromise = openDB<BookViewDB>(DB_NAME, 1, {
      upgrade(db) {
        // 仅在首次建库时创建对象仓库，避免重复创建报错
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export { STORE };
