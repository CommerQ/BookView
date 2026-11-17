import type { BookRecord } from '../types/book';
import { parseEpub } from '../services/epub/epubService';
import { deleteBook, listBooks, saveBook } from '../services/storage/storageService';

/** 开发用批量示例书籍数量 */
const SAMPLE_COUNT = 100;

/** 演示书籍数量，供界面文案展示 */
export const SAMPLE_BOOK_COUNT = SAMPLE_COUNT;

/** 生成第 index 本（1 基）示例书的文件名 */
function sampleFileName(index: number): string {
  return `sample-${String(index).padStart(3, '0')}.epub`;
}

/**
 * 开发环境模拟批量导入：从项目根目录 dev-samples 拉取 100 本 EPUB 并写入书库。
 * 使用固定 id，重复点击时覆盖同一批记录，不会产生重复书籍。
 * @param onProgress 每处理完一本回调一次，用于显示导入进度
 * @returns 成功导入的数量
 */
export async function importSampleBooks(
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  let imported = 0;

  // 清理上一版演示数据（仅 id 以 sample: 开头的记录），保留用户自己导入的书
  const validIds = new Set(
    Array.from({ length: SAMPLE_COUNT }, (_, index) => `sample:${sampleFileName(index + 1)}`)
  );
  const existing = await listBooks();
  await Promise.all(
    existing
      .filter((book) => book.id.startsWith('sample:') && !validIds.has(book.id))
      .map((book) => deleteBook(book.id))
  );

  for (let index = 1; index <= SAMPLE_COUNT; index += 1) {
    const fileName = sampleFileName(index);
    try {
      // dev-samples 位于项目根目录，由 Vite 开发服务器直接提供；生产环境不会暴露该入口
      const response = await fetch(`${import.meta.env.BASE_URL}dev-samples/${fileName}`);
      if (!response.ok) continue;

      const file = new File([await response.arrayBuffer()], fileName, {
        type: 'application/epub+zip',
      });
      const parsed = await parseEpub(file);

      const record: BookRecord = {
        id: `sample:${fileName}`,
        title: parsed.title,
        author: parsed.author,
        coverBlob: parsed.coverBlob,
        sections: parsed.sections,
        createdAt: Date.now(),
      };
      await saveBook(record, parsed.fileBytes);
      imported += 1;
    } finally {
      onProgress?.(index, SAMPLE_COUNT);
    }
  }

  return imported;
}

/**
 * 删除全部演示书籍（id 以 sample: 开头），保留用户自己导入的书籍。
 * @returns 删除的数量
 */
export async function clearSampleBooks(): Promise<number> {
  const existing = await listBooks();
  const samples = existing.filter((book) => book.id.startsWith('sample:'));
  await Promise.all(samples.map((book) => deleteBook(book.id)));
  return samples.length;
}
