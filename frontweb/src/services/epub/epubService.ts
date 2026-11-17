import ePub, { type Book } from 'epubjs';
import type { NavItem } from 'epubjs/types/navigation';
import type Section from 'epubjs/types/section';
import type { ParsedBook, SpineSection } from '../../types/book';
import { scopeCss } from './cssScope';

/**
 * 按 ArrayBuffer 缓存已打开的 Book 实例。
 * 避免每次翻页都重新解压 EPUB（大文件下会明显卡顿）。
 */
const bookCache = new WeakMap<ArrayBuffer, Promise<Book>>();

/** 规范化 href：去掉查询串/锚点与开头的 ./，便于目录与 spine 对齐 */
function normalizeHref(href: string): string {
  return decodeURIComponent(href.split('#')[0].replace(/^\.\//, '')).replace(/\\/g, '/');
}

/** 取路径最后一段，用于目录与 spine 路径前缀不一致时的兜底匹配 */
function hrefBaseName(href: string): string {
  return normalizeHref(href).split('/').pop() ?? '';
}

/**
 * 递归展开 EPUB 目录，生成 href → 标题 的映射。
 * 同时记录文件名索引：部分书籍目录 href 带 OEBPS/ 前缀，而 spine 不带。
 */
function collectTocTitles(items: NavItem[] | undefined, map: Map<string, string>): void {
  if (!items) return;
  for (const item of items) {
    if (item.href && item.label) {
      const label = item.label.trim();
      map.set(normalizeHref(item.href), label);
      // 文件名兜底；同名文件在个别书中可能冲突，但命中率更高
      map.set(hrefBaseName(item.href), label);
    }
    collectTocTitles(item.subitems, map);
  }
}

/** 从 href 提取文件名作为目录标题兜底 */
function titleFromHref(href: string): string {
  const name = hrefBaseName(href);
  return name.replace(/\.(x?html?|xml)$/i, '') || href;
}

/**
 * 打开 EPUB 并解析元数据、spine 段与封面。
 * 注意：本函数只解析，不写 IndexedDB（ADR：解析与存储分离）。
 */
export async function parseEpub(file: File): Promise<ParsedBook> {
  const fileBytes = await file.arrayBuffer();
  // 不做 epubjs 的资源替换：本应用自行重写图片地址，跳过可避免 CSS 预处理报错并加快导入
  const book = ePub({ replacements: 'none' });

  // 使用二进制方式打开；传副本避免后续缓存实例复用同一份数据
  await book.open(fileBytes.slice(0), 'binary');
  // ready 等待导航解析完成，opened 等待资源替换链结束；
  // 两者都完成后再 destroy，避免 epubjs 异步回调访问已销毁的实例
  await Promise.all([book.ready, book.opened]);

  const metadata = book.packaging.metadata;
  const title = metadata?.title?.trim() || file.name || '未命名书籍';
  const author = metadata?.creator?.trim() || undefined;

  // 展开目录，spine 段标题优先取目录标签
  const tocTitles = new Map<string, string>();
  collectTocTitles(book.navigation?.toc, tocTitles);

  const sections: SpineSection[] = [];
  book.spine.each((section: Section) => {
    const href = section.href ?? '';
    sections.push({
      index: section.index,
      href,
      title:
        tocTitles.get(normalizeHref(href)) ??
        tocTitles.get(hrefBaseName(href)) ??
        titleFromHref(href),
    });
  });

  // 封面：coverUrl 为临时 object URL，需转 Blob 后立即释放
  let coverBlob: Blob | undefined;
  const coverUrl = await book.coverUrl();
  if (coverUrl) {
    try {
      coverBlob = await (await fetch(coverUrl)).blob();
    } finally {
      URL.revokeObjectURL(coverUrl);
    }
  }

  // 解析阶段结束即释放解析实例，阅读阶段使用独立缓存实例
  book.destroy();

  return { title, author, coverBlob, sections, fileBytes };
}

/** 获取（或创建）用于读取章节内容的 Book 实例 */
function getCachedBook(fileBytes: ArrayBuffer): Promise<Book> {
  let pending = bookCache.get(fileBytes);
  if (!pending) {
    // 同样关闭 epubjs 的资源替换，正文资源由 rewriteResourceUrls 处理
    const book = ePub({ replacements: 'none' });
    pending = book
      .open(fileBytes.slice(0), 'binary')
      .then(() => book.opened)
      .then(() => book);
    bookCache.set(fileBytes, pending);
  }
  return pending;
}

/** 将单个相对资源路径解析为归档内的绝对路径 */
function resolveArchivePath(raw: string, sectionUrl: string): string {
  const baseDir = sectionUrl.slice(0, sectionUrl.lastIndexOf('/') + 1);
  return decodeURIComponent(new URL(raw, `https://book.invalid/${baseDir}`).pathname.slice(1));
}

/**
 * 将章节内的相对资源地址替换为可访问的 blob URL。
 * 兼容 HTML <img>、SVG <image>（含 xlink:href）以及 CSS 背景图。
 * 失败时保留原地址，不影响正文阅读。
 */
async function rewriteResourceUrls(book: Book, sectionUrl: string, doc: Document): Promise<void> {
  /** 替换一个元素的资源属性 */
  const rewriteNode = async (node: Element, attr: string): Promise<void> => {
    const raw = node.getAttribute(attr);
    if (!raw || /^(data:|blob:|https?:)/i.test(raw)) return;
    try {
      // 以章节所在目录为基准解析相对路径，再向 EPUB 归档请求 blob
      const url = await book.resources.createUrl(resolveArchivePath(raw, sectionUrl));
      if (!url) return;
      if (attr === 'xlink:href') {
        node.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
      } else {
        node.setAttribute(attr, url);
      }
    } catch {
      // 资源缺失时保持原样，正文仍可阅读
    }
  };

  const nodeAttrs: Array<[string, string]> = [
    ['img[src]', 'src'],
    ['image[href]', 'href'],
    ['image[xlink\\:href]', 'xlink:href'],
  ];

  const tasks: Array<Promise<void>> = [];
  for (const [selector, attr] of nodeAttrs) {
    for (const node of Array.from(doc.querySelectorAll(selector))) {
      tasks.push(rewriteNode(node, attr));
    }
  }

  // CSS 背景图（部分 EPUB 的封面使用内联 background-image）
  for (const node of Array.from(doc.querySelectorAll<HTMLElement>('[style*="url("]'))) {
    const style = node.getAttribute('style') ?? '';
    const matches = style.match(/url\((['"]?)([^'")]+)\1\)/g) ?? [];
    for (const match of matches) {
      const raw = match.replace(/^url\((['"]?)/, '').replace(/['"]?\)$/, '');
      if (!raw || /^(data:|blob:|https?:)/i.test(raw)) continue;
      const replacement = await book.resources
        .createUrl(resolveArchivePath(raw, sectionUrl))
        .catch(() => null);
      if (replacement) {
        node.setAttribute('style', style.replace(match, `url("${replacement}")`));
      }
    }
  }

  await Promise.all(tasks);
}

/**
 * 把 CSS 中的相对资源地址替换为 blob URL。
 * 远程地址一律阻断，避免阅读时产生网络请求（NFR-05）。
 */
async function rewriteCssUrls(book: Book, cssPath: string, css: string): Promise<string> {
  const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  const matches = Array.from(css.matchAll(pattern));
  let result = css;

  for (const match of matches) {
    const raw = match[2].trim();
    if (!raw || raw.startsWith('#') || /^(data:|blob:)/i.test(raw)) continue;

    if (/^https?:/i.test(raw)) {
      result = result.split(match[0]).join('url("about:blank")');
      continue;
    }

    try {
      const url = await book.resources.createUrl(resolveArchivePath(raw, cssPath));
      if (url) result = result.split(match[0]).join(`url("${url}")`);
    } catch {
      // 资源缺失时保留原地址，不影响其余样式
    }
  }

  return result;
}

/**
 * 递归展开 CSS 中的 @import，并重写被导入文件内的相对资源地址。
 * 最多展开 4 层，避免异常书籍造成无限递归。
 */
async function resolveCssImports(
  book: Book,
  cssPath: string,
  css: string,
  depth = 0
): Promise<string> {
  if (depth >= 4) return css;

  const pattern = /@import\s+(?:url\(\s*)?(['"]?)([^'")\s]+)\1\s*\)?\s*[^;]*;/gi;
  const matches = Array.from(css.matchAll(pattern));
  let result = css;

  for (const match of matches) {
    const raw = match[2].trim();
    if (!raw || /^(https?:|data:)/i.test(raw)) {
      result = result.replace(match[0], '');
      continue;
    }

    const importPath = resolveArchivePath(raw, cssPath);
    const imported = await book.archive.getText(importPath).catch(() => '');
    const nested = imported
      ? await resolveCssImports(book, importPath, imported, depth + 1)
      : '';
    const rewritten = nested ? await rewriteCssUrls(book, importPath, nested) : '';
    result = result.replace(match[0], rewritten);
  }

  return result;
}

/**
 * 收集章节的样式：<style> 内联样式与 <link rel="stylesheet"> 外链样式。
 * 外链样式从 EPUB 归档读取，不发起网络请求。
 */
async function collectSectionCss(book: Book, doc: Document, sectionUrl: string): Promise<string> {
  const chunks: string[] = [];

  for (const style of Array.from(doc.querySelectorAll('style'))) {
    const text = style.textContent?.trim();
    if (text) chunks.push(await rewriteCssUrls(book, sectionUrl, text));
  }

  const links = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
  for (const link of links) {
    const href = link.getAttribute('href') ?? '';
    if (!href || /^(https?:|data:)/i.test(href)) continue;

    const cssPath = resolveArchivePath(href, sectionUrl);
    const text = await book.archive.getText(cssPath).catch(() => '');
    if (!text) continue;

    const expanded = await resolveCssImports(book, cssPath, text);
    chunks.push(await rewriteCssUrls(book, cssPath, expanded));
  }

  return chunks.join('\n');
}

/** 转义插入 HTML 属性的文本 */
function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * 读取指定 spine 段的正文 HTML。
 * 每次返回单段内容，满足 NFR-02（不挂载全书）。
 * 同时把 EPUB 样式限定到 .reader-content，避免污染应用界面。
 */
export async function loadSectionHtml(
  fileBytes: ArrayBuffer,
  sections: SpineSection[],
  index: number
): Promise<string> {
  const sectionMeta = sections[index];
  if (!sectionMeta) return '';

  const book = await getCachedBook(fileBytes);
  const section = book.spine.get(sectionMeta.href);
  if (!section) return '';

  // 直接读取归档内容：不触发 epubjs 的 <head> 重写钩子，兼容缺少 head 的书籍
  const doc = (await book.load(section.url)) as unknown as Document;
  if (!doc?.querySelector) return '';

  await rewriteResourceUrls(book, section.url, doc);

  const body = doc.body ?? doc.querySelector('body');
  const bodyHtml = body?.innerHTML ?? '';

  // EPUB CSS 可能使用 html/body 根选择器，统一限定到阅读内容容器
  const css = await collectSectionCss(book, doc, section.url);
  const scopedCss = css ? scopeCss(css) : '';

  // 保留 body 上的 class，兼容 body.calibre 这类选择器
  const bodyClass = body?.getAttribute('class')?.trim() ?? '';
  const contentClass = bodyClass ? `reader-content ${escapeAttribute(bodyClass)}` : 'reader-content';
  const styleTag = scopedCss ? `<style>${scopedCss}</style>` : '';

  return `${styleTag}<div class="${contentClass}">${bodyHtml}</div>`;
}
