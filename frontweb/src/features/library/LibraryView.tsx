import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookRecord } from '../../types/book';
import { deleteBook, listBooks, saveBook } from '../../services/storage/storageService';
import { parseEpub } from '../../services/epub/epubService';
import { importSampleBooks, clearSampleBooks, SAMPLE_BOOK_COUNT } from '../../dev/sampleBooks';
import styles from './LibraryView.module.css';

/**
 * 书库视图：导入 EPUB、展示书籍、删除书籍。
 * 对应 FR-L01–L04、S1、S2、S7。
 */
export function LibraryView() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [clearingSamples, setClearingSamples] = useState(false);
  const [seedProgress, setSeedProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // IndexedDB 不可用时禁用导入，避免用户反复选择文件后失败（设计 §8）
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 重新读取书库列表 */
  const refresh = useCallback(async () => {
    try {
      setBooks(await listBooks());
      setStorageUnavailable(false);
    } catch {
      setStorageUnavailable(true);
      setError('书库读取失败，请检查浏览器是否允许本地存储');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // 封面 Blob → object URL；列表变化或卸载时释放旧 URL，避免内存泄漏
  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const book of books) {
      if (book.coverBlob) urls[book.id] = URL.createObjectURL(book.coverBlob);
    }
    setCoverUrls(urls);
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [books]);

  /** 处理 EPUB 选择：解析 → 入库 → 刷新列表 */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || storageUnavailable) return;

    if (!file.name.toLowerCase().endsWith('.epub')) {
      setError('仅支持导入 .epub 文件');
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const parsed = await parseEpub(file);
      const record: BookRecord = {
        id: crypto.randomUUID(),
        title: parsed.title,
        author: parsed.author,
        coverBlob: parsed.coverBlob,
        sections: parsed.sections,
        createdAt: Date.now(),
      };
      // 解析成功才写库，损坏文件不会污染书库
      await saveBook(record, parsed.fileBytes);
      await refresh();
    } catch {
      setError('EPUB 解析失败，请确认文件完整且未加密');
    } finally {
      setImporting(false);
    }
  };

  /** 开发环境：一键导入 dev-samples 下的 100 本演示书籍 */
  const handleSeedSamples = async () => {
    setSeeding(true);
    setSeedProgress({ done: 0, total: SAMPLE_BOOK_COUNT });
    setError(null);
    try {
      await importSampleBooks((done, total) => setSeedProgress({ done, total }));
      await refresh();
    } catch {
      setError('示例书籍导入失败，请稍后重试');
    } finally {
      setSeeding(false);
      setSeedProgress(null);
    }
  };

  /** 开发环境：删除全部演示书籍，保留用户导入的书 */
  const handleClearSamples = async () => {
    setClearingSamples(true);
    setError(null);
    try {
      await clearSampleBooks();
      await refresh();
    } catch {
      setError('示例书籍删除失败，请稍后重试');
    } finally {
      setClearingSamples(false);
    }
  };

  /** 删除书籍并刷新列表（进度由 storageService 联动清除） */
  const handleDelete = async (book: BookRecord) => {
    try {
      await deleteBook(book.id);
      await refresh();
    } catch {
      setError('删除失败，请稍后重试');
    }
  };

  /** 开发用示例书籍数量，用于控制清除入口 */
  const sampleCount = books.filter((book) => book.id.startsWith('sample:')).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.brand}>BookView</h1>
          <p className={styles.subtitle}>
            本地 EPUB 阅读器 · 数据仅保存在本机
            {!loading && books.length > 0 ? ` · 共 ${books.length} 本` : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".epub,application/epub+zip"
            className={styles.fileInput}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className={styles.primaryButton}
            disabled={importing || storageUnavailable}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? '正在导入…' : '导入书籍'}
          </button>
          {import.meta.env.DEV && books.length > 0 && (
            <button
              type="button"
              className={styles.ghostButton}
              disabled={seeding || clearingSamples || storageUnavailable}
              onClick={() => void handleSeedSamples()}
            >
              {seeding
                ? `正在导入 ${seedProgress?.done ?? 0}/${SAMPLE_BOOK_COUNT}`
                : `导入 ${SAMPLE_BOOK_COUNT} 本示例`}
            </button>
          )}
          {import.meta.env.DEV && sampleCount > 0 && (
            <button
              type="button"
              className={styles.ghostButton}
              disabled={seeding || clearingSamples || storageUnavailable}
              onClick={() => void handleClearSamples()}
            >
              {clearingSamples ? '正在清除…' : `清除示例 (${sampleCount})`}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className={styles.errorBar} role="alert">
          <span>{error}</span>
          <button type="button" className={styles.errorClose} onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      <main className={styles.content}>
        {loading ? (
          <p className={styles.hint}>正在加载书库…</p>
        ) : books.length === 0 ? (
          <section className={styles.empty}>
            <h2 className={styles.emptyTitle}>书库还是空的</h2>
            <p className={styles.emptyText}>导入一本 EPUB，开始你的阅读。</p>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={storageUnavailable}
              onClick={() => fileInputRef.current?.click()}
            >
              导入书籍
            </button>
            {import.meta.env.DEV && (
              <button
                type="button"
                className={styles.ghostButton}
                disabled={seeding || clearingSamples || storageUnavailable}
                onClick={() => void handleSeedSamples()}
              >
                {seeding
                  ? `正在导入 ${seedProgress?.done ?? 0}/${SAMPLE_BOOK_COUNT}`
                  : `导入 ${SAMPLE_BOOK_COUNT} 本示例书籍`}
              </button>
            )}
          </section>
        ) : (
          <ul className={styles.grid}>
            {books.map((book) => (
              <li key={book.id} className={styles.card}>
                <Link to={`/read/${book.id}`} className={styles.cardLink}>
                  <div className={styles.cover}>
                    {coverUrls[book.id] ? (
                      <img className={styles.coverImage} src={coverUrls[book.id]} alt="" />
                    ) : (
                      <span className={styles.coverFallback}>{book.title.slice(0, 1)}</span>
                    )}
                  </div>
                  <div className={styles.cardBody}>
                    <h3 className={styles.bookTitle}>{book.title}</h3>
                    <p className={styles.bookAuthor}>{book.author ?? '未知作者'}</p>
                    <p className={styles.bookMeta}>{book.sections.length} 段</p>
                  </div>
                </Link>
                <div className={styles.cardFooter}>
                  <Link to={`/read/${book.id}`} className={styles.readLink}>
                    阅读
                  </Link>
                  <button
                    type="button"
                    className={styles.deleteButton}
                    aria-label={`删除《${book.title}》`}
                    onClick={() => void handleDelete(book)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
