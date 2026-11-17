/**
 * BookView 共享数据类型。
 * 说明：BookRecord 为书库持久化元数据；ReadingProgress 为阅读进度。
 */

/** EPUB spine 中的一段（与阅读器「段」一一对应） */
export interface SpineSection {
  /** 在 spine 中的顺序，从 0 开始 */
  index: number;
  /** 章节在 EPUB 包内的 href（相对路径） */
  href: string;
  /** 用于目录展示的标题 */
  title: string;
}

/** epubService.parseEpub 的解析结果（不落库） */
export interface ParsedBook {
  title: string;
  author?: string;
  /** 原始封面二进制，入库前保留 */
  coverBlob?: Blob;
  sections: SpineSection[];
  /** 原始 EPUB 二进制，供阅读器按段取内容 */
  fileBytes: ArrayBuffer;
}

/** IndexedDB 中持久化的书籍记录 */
export interface BookRecord {
  id: string;
  title: string;
  author?: string;
  /** 封面二进制，持久化在 IDB；UI 层临时生成 object URL */
  coverBlob?: Blob;
  sections: SpineSection[];
  createdAt: number;
}

/** localStorage 中持久化的阅读进度 */
export interface ReadingProgress {
  bookId: string;
  /** 当前段索引，0 基 */
  sectionIndex: number;
  /** 章节内滚动位置比例（0–1），用于长章节恢复阅读位置 */
  scrollRatio?: number;
  updatedAt: number;
}
