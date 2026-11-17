import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import gsap from 'gsap';
import type { BookRecord, SpineSection } from '../../types/book';
import { getBook, getProgress, setProgress } from '../../services/storage/storageService';
import { loadSectionHtml } from '../../services/epub/epubService';
import { createPageTurnTimeline } from '../../animation/pageTurn';
import { useReducedMotion } from '../../animation/useReducedMotion';
import { TocPanel } from './TocPanel';
import styles from './ReaderView.module.css';

interface PendingTurn {
  target: number;
  html: string;
  direction: 'next' | 'prev';
}

/** 正文字号偏好：全局生效，单位 px */
const FONT_SIZE_KEY = 'bookview:font-size';
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 28;
const DEFAULT_FONT_SIZE = 18;
const FONT_SIZE_STEP = 2;

/** 读取本地保存的字号，并夹紧到允许范围 */
function loadFontSize(): number {
  const raw = Number(localStorage.getItem(FONT_SIZE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_FONT_SIZE;
  return Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, raw));
}

/** 阅读背景预设 */
const READER_THEME_KEY = 'bookview:reader-theme';
const READER_THEME_IDS = ['paper', 'sepia', 'green', 'night'] as const;
type ReaderThemeId = (typeof READER_THEME_IDS)[number];

/** 背景选项：swatch 仅用于面板中的色块展示，实际配色由 CSS 主题类控制 */
const READER_THEMES: Array<{ id: ReaderThemeId; label: string; swatch: string }> = [
  { id: 'paper', label: '纸白', swatch: '#ffffff' },
  { id: 'sepia', label: '米黄', swatch: '#f7f1e3' },
  { id: 'green', label: '护眼绿', swatch: '#eaf1e8' },
  { id: 'night', label: '夜间', swatch: '#171a1e' },
];

/** 读取本地保存的背景，非法值回退为纸白 */
function loadTheme(): ReaderThemeId {
  const saved = localStorage.getItem(READER_THEME_KEY);
  return READER_THEME_IDS.includes(saved as ReaderThemeId)
    ? (saved as ReaderThemeId)
    : 'paper';
}

/** 解析正文链接：相对当前章节解析为归档内路径与锚点 */
function resolveContentLink(
  currentHref: string,
  rawHref: string
): { path: string; anchor: string } | null {
  try {
    const url = new URL(rawHref, `https://book.invalid/${currentHref}`);
    return {
      path: decodeURIComponent(url.pathname.replace(/^\//, '')),
      anchor: decodeURIComponent(url.hash.slice(1)),
    };
  } catch {
    return null;
  }
}

/** 在 spine 中定位链接目标：优先精确路径，其次文件名兜底 */
function findSectionIndex(sections: SpineSection[], path: string): number | null {
  const normalized = path.replace(/\\/g, '/');
  const exact = sections.findIndex((section) => section.href.replace(/\\/g, '/') === normalized);
  if (exact >= 0) return exact;

  const baseName = normalized.split('/').pop() ?? '';
  const byName = sections.findIndex(
    (section) => (section.href.split('/').pop() ?? '') === baseName
  );
  return byName >= 0 ? byName : null;
}

/** 把正文面板滚动到指定 id / name 锚点 */
function scrollToAnchor(panel: HTMLElement | null, anchor: string): void {
  if (!panel || !anchor) return;
  const candidates = Array.from(panel.querySelectorAll<HTMLElement>('[id], a[name]'));
  const target = candidates.find(
    (element) => element.id === anchor || element.getAttribute('name') === anchor
  );
  if (target) target.scrollIntoView({ block: 'start' });
}

/**
 * 阅读器视图：按 spine 段渲染、GSAP 翻页、目录跳转、进度记忆。
 * 对应 FR-R01–R05、FR-A01、FR-A03–A04、S3–S6。
 */
export function ReaderView() {
  const { bookId = '' } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();

  const [book, setBook] = useState<BookRecord | null>(null);
  const [fileBytes, setFileBytes] = useState<ArrayBuffer | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [currentHtml, setCurrentHtml] = useState('');
  const [nextHtml, setNextHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ReaderThemeId>(loadTheme);
  const [fontSize, setFontSize] = useState(loadFontSize);
  const [error, setError] = useState<string | null>(null);

  const currentRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<PendingTurn | null>(null);
  const animatingRef = useRef(false);
  // 章节内滚动位置（0–1）与最新段索引，供节流保存与卸载时兜底写入
  const scrollRatioRef = useRef(0);
  const sectionIndexRef = useRef(0);
  const scrollSaveTimerRef = useRef<number | null>(null);
  const pendingRestoreRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    sectionIndexRef.current = sectionIndex;
  }, [sectionIndex]);

  // 用 ref 保存最新偏好，避免翻页 effect 因偏好变化重复播放
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    reducedRef.current = reducedMotion;
  }, [reducedMotion]);

  // 载入书籍并恢复上次阅读位置（S6）
  useEffect(() => {
    loadedRef.current = false;
    let cancelled = false;

    const load = async () => {
      try {
        const record = await getBook(bookId);
        if (cancelled) return;
        if (!record) {
          setNotFound(true);
          return;
        }

        const sections = record.meta.sections;
        const progress = getProgress(bookId);
        const savedIndex = progress?.sectionIndex ?? 0;
        // 段索引越界时重置为 0 并回写进度（设计 §8）
        const start =
          sections.length === 0 ? 0 : Math.min(Math.max(savedIndex, 0), sections.length - 1);
        const savedRatio =
          progress && savedIndex === start ? Math.min(1, Math.max(0, progress.scrollRatio ?? 0)) : 0;

        // 记录待恢复位置，等正文渲染完成后按比例还原
        scrollRatioRef.current = savedRatio;
        pendingRestoreRef.current = savedRatio > 0 ? savedRatio : null;
        if (start !== savedIndex) setProgress(bookId, start, 0);

        setBook(record.meta);
        setFileBytes(record.fileBytes);
        setSectionIndex(start);

        const html = await loadSectionHtml(record.fileBytes, sections, start);
        if (!cancelled) {
          setCurrentHtml(html);
          loadedRef.current = true;
        }
      } catch {
        if (!cancelled) setError('书籍打开失败，文件可能已损坏');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  // 正文渲染后恢复章节内滚动位置；等一帧让浏览器完成布局
  useEffect(() => {
    const ratio = pendingRestoreRef.current;
    if (ratio === null || !currentHtml) return;
    pendingRestoreRef.current = null;

    const frame = requestAnimationFrame(() => {
      const el = currentRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = ratio * max;
    });
    return () => cancelAnimationFrame(frame);
  }, [currentHtml]);

  const goTo = useCallback(
    async (target: number, direction: 'next' | 'prev') => {
      if (!book || !fileBytes || animatingRef.current) return;
      if (target < 0 || target >= book.sections.length) return;

      // 取消待写入的滚动进度，避免旧段的定时器覆盖新段进度
      if (scrollSaveTimerRef.current !== null) {
        window.clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }

      animatingRef.current = true;
      try {
        const html = await loadSectionHtml(fileBytes, book.sections, target);
        pendingRef.current = { target, html, direction };
        // 先渲染下一页内容，再由 effect 启动时间轴
        setNextHtml(html);
      } catch {
        animatingRef.current = false;
        setError('章节加载失败，请稍后重试');
      }
    },
    [book, fileBytes]
  );

  // 下一页内容就绪后播放翻页动画，结束时交换两层并写入进度
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending || !nextHtml || !currentRef.current || !nextRef.current) return;

    const timeline = createPageTurnTimeline(
      { current: currentRef.current, next: nextRef.current },
      pending.direction,
      reducedRef.current
    );

    timeline.eventCallback('onComplete', () => {
      setSectionIndex(pending.target);
      setCurrentHtml(pending.html);
      setNextHtml('');
      // 新段从段首开始阅读
      scrollRatioRef.current = 0;
      setProgress(bookId, pending.target, 0);
      pendingRef.current = null;
      animatingRef.current = false;

      // 等 React 提交新内容后清理 GSAP 写入的内联样式，并回到段首
      requestAnimationFrame(() => {
        if (currentRef.current) {
          gsap.set(currentRef.current, { clearProps: 'transform,opacity' });
          currentRef.current.scrollTop = 0;
        }
        if (nextRef.current) {
          gsap.set(nextRef.current, { clearProps: 'transform,opacity,display' });
        }
      });
    });

    // 组件卸载或下一次翻页时终止时间轴，避免对已卸载组件写状态（FR-A04）
    return () => {
      timeline.kill();
    };
  }, [nextHtml, bookId]);

  // 目录跳转：瞬时切换目标段，不播放翻页（S5）
  const jumpTo = async (target: number, anchor = '') => {
    if (!book || !fileBytes || animatingRef.current) return;
    setTocOpen(false);
    animatingRef.current = true;
    try {
      const html = await loadSectionHtml(fileBytes, book.sections, target);
      setCurrentHtml(html);
      setSectionIndex(target);
      scrollRatioRef.current = 0;
      setProgress(bookId, target, 0);
      setNextHtml('');
      if (currentRef.current) gsap.set(currentRef.current, { clearProps: 'transform,opacity' });
      if (nextRef.current) {
        gsap.set(nextRef.current, { clearProps: 'transform,opacity,display' });
      }
      // 目录跳转或正文链接跳转后定位到目标位置
      requestAnimationFrame(() => {
        const panel = currentRef.current;
        if (!panel) return;
        if (anchor) {
          scrollToAnchor(panel, anchor);
        } else {
          panel.scrollTop = 0;
        }
      });
    } catch {
      setError('章节加载失败，请稍后重试');
    } finally {
      animatingRef.current = false;
    }
  };

  /**
   * 拦截正文内链接：
   * - 站内链接解析到 spine 段并跳转，支持同段锚点
   * - http(s) 链接在新窗口打开，其他协议交给系统
   */
  const handleContentClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest('a');
    if (!link || !book) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // 阻止浏览器按当前 SPA 路径解析相对链接
    event.preventDefault();

    const scheme = href.match(/^([a-z][a-z0-9+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme) {
      if (scheme === 'http' || scheme === 'https') {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else if (scheme === 'mailto' || scheme === 'tel') {
        window.location.href = href;
      }
      return;
    }

    const resolved = resolveContentLink(book.sections[sectionIndex]?.href ?? '', href);
    if (!resolved) return;

    const targetIndex = findSectionIndex(book.sections, resolved.path);
    if (targetIndex === null) return;

    if (targetIndex === sectionIndex) {
      scrollToAnchor(currentRef.current, resolved.anchor);
      return;
    }
    void jumpTo(targetIndex, resolved.anchor);
  };

  /** 调整正文字号并持久化，所有书籍共用同一偏好 */
  const changeFontSize = (delta: number) => {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, fontSize + delta));
    setFontSize(next);
    localStorage.setItem(FONT_SIZE_KEY, String(next));

    // 字号变化会改变内容高度，按原比例重新定位，避免阅读位置漂移
    requestAnimationFrame(() => {
      const el = currentRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 0) el.scrollTop = scrollRatioRef.current * max;
    });
  };

  /** 记录章节内滚动比例，250ms 节流后写入 localStorage */
  const handleScroll = () => {
    const el = currentRef.current;
    if (!el || animatingRef.current) return;

    const max = el.scrollHeight - el.clientHeight;
    scrollRatioRef.current = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0;

    if (scrollSaveTimerRef.current !== null) return;
    scrollSaveTimerRef.current = window.setTimeout(() => {
      scrollSaveTimerRef.current = null;
      setProgress(bookId, sectionIndexRef.current, scrollRatioRef.current);
    }, 250);
  };

  // 离开阅读页时保存最后一次位置，并清理未触发的节流定时器
  useEffect(() => {
    return () => {
      if (scrollSaveTimerRef.current !== null) {
        window.clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }
      if (loadedRef.current) {
        setProgress(bookId, sectionIndexRef.current, scrollRatioRef.current);
      }
    };
  }, [bookId]);

  /** 切换阅读背景并持久化 */
  const chooseTheme = (next: ReaderThemeId) => {
    setTheme(next);
    setThemeMenuOpen(false);
    localStorage.setItem(READER_THEME_KEY, next);
  };

  // 键盘：← 上一段，→ 下一段，Esc 返回书库（FR-R05）
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        void goTo(sectionIndex + 1, 'next');
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        void goTo(sectionIndex - 1, 'prev');
      } else if (event.key === 'Escape') {
        // 背景面板打开时优先关闭面板，而不是直接退出阅读页
        if (themeMenuOpen) {
          setThemeMenuOpen(false);
          return;
        }
        navigate('/');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, sectionIndex, navigate, themeMenuOpen]);

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  const total = book?.sections.length ?? 0;
  const themeClass = {
    paper: styles.themePaper,
    sepia: styles.themeSepia,
    green: styles.themeGreen,
    night: styles.themeNight,
  }[theme];

  return (
    <div
      className={`${styles.page} ${themeClass}`}
      data-reader-theme={theme}
      data-testid="reader-page"
    >
      <header className={styles.header}>
        <button type="button" className={styles.textButton} onClick={() => navigate('/')}>
          ← 书库
        </button>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{book?.title ?? '正在打开…'}</h1>
          {book?.author && <p className={styles.author}>{book.author}</p>}
        </div>
        <div className={styles.headerActions}>
          <div className={styles.fontGroup} role="group" aria-label="字号调整">
            <button
              type="button"
              className={styles.fontButton}
              aria-label="减小字号"
              disabled={fontSize <= MIN_FONT_SIZE}
              onClick={() => changeFontSize(-FONT_SIZE_STEP)}
            >
              A−
            </button>
            <span className={styles.fontValue} aria-live="polite">
              {fontSize}
            </span>
            <button
              type="button"
              className={styles.fontButton}
              aria-label="增大字号"
              disabled={fontSize >= MAX_FONT_SIZE}
              onClick={() => changeFontSize(FONT_SIZE_STEP)}
            >
              A+
            </button>
          </div>
          <div className={styles.themeGroup}>
            <button
              type="button"
              className={styles.textButton}
              aria-label="背景"
              aria-haspopup="menu"
              aria-expanded={themeMenuOpen}
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              背景
            </button>
            {themeMenuOpen && (
              <>
                {/* 透明遮罩：点击面板外任意位置关闭 */}
                <div className={styles.menuBackdrop} onClick={() => setThemeMenuOpen(false)} />
                <div className={styles.themeMenu} role="menu" aria-label="阅读背景">
                  {READER_THEMES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={theme === item.id}
                      className={styles.themeOption}
                      onClick={() => chooseTheme(item.id)}
                    >
                      <span className={styles.swatch} style={{ background: item.swatch }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button type="button" className={styles.textButton} onClick={() => setTocOpen(true)}>
            目录
          </button>
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

      <main className={styles.viewport}>
        {loading ? (
          <p className={styles.loading}>正在打开书籍…</p>
        ) : (
          <>
            <div
              ref={currentRef}
              className={styles.panel}
              style={{ fontSize }}
              data-testid="reader-current-page"
              onScroll={handleScroll}
              onClick={handleContentClick}
              dangerouslySetInnerHTML={{ __html: currentHtml }}
            />
            <div
              ref={nextRef}
              className={`${styles.panel} ${styles.nextPanel}`}
              style={{ fontSize }}
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: nextHtml }}
            />

            {/* 左右 20% 热区：点击翻页 */}
            <button
              type="button"
              className={`${styles.hotZone} ${styles.hotZoneLeft}`}
              aria-label="上一页"
              disabled={sectionIndex <= 0}
              onClick={() => void goTo(sectionIndex - 1, 'prev')}
            />
            <button
              type="button"
              className={`${styles.hotZone} ${styles.hotZoneRight}`}
              aria-label="下一页"
              disabled={sectionIndex >= total - 1}
              onClick={() => void goTo(sectionIndex + 1, 'next')}
            />
          </>
        )}
      </main>

      <footer className={styles.footer}>
        <span className={styles.progress}>
          {total === 0 ? '无可阅读章节' : `第 ${sectionIndex + 1} / ${total} 段`}
        </span>
        <span className={styles.shortcuts}>← → 翻页 · Esc 返回书库</span>
      </footer>

      {tocOpen && book && (
        <TocPanel
          sections={book.sections}
          currentIndex={sectionIndex}
          onJump={(index) => void jumpTo(index)}
          onClose={() => setTocOpen(false)}
        />
      )}
    </div>
  );
}
