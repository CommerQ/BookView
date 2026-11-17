import { describe, expect, it, vi } from 'vitest';

// 构造可配置的 epubjs mock，避免测试依赖真实 EPUB 文件
const parseMockState = vi.hoisted(() => ({
  metadata: { title: '二次函数', creator: '张老师' } as { title: string; creator: string },
  toc: [{ href: 'Text/ch1.xhtml', label: '第一章 函数' }] as Array<{ href: string; label: string }>,
}));

vi.mock('epubjs', () => {
  const sections = [
    { index: 0, href: 'Text/ch1.xhtml' },
    { index: 1, href: 'Text/ch2.xhtml' },
  ];
  const book = {
    open: vi.fn().mockResolvedValue({}),
    opened: Promise.resolve(),
    ready: Promise.resolve(),
    packaging: { get metadata() { return parseMockState.metadata; } },
    navigation: { get toc() { return parseMockState.toc; } },
    spine: {
      each: (cb: (section: (typeof sections)[number]) => void) => sections.forEach(cb),
    },
    coverUrl: vi.fn().mockResolvedValue(null),
    destroy: vi.fn(),
    request: vi.fn(),
    resources: { createUrl: vi.fn() },
  };
  return { default: () => book };
});

import { parseEpub } from '../src/services/epub/epubService';

/** 构造最小 File 替身，只需 arrayBuffer 与 name */
function makeFile(): File {
  const bytes = new TextEncoder().encode('epub-bytes').buffer;
  return { name: 'book.epub', arrayBuffer: async () => bytes } as unknown as File;
}

describe('parseEpub', () => {
  it('映射书名、作者与 spine 段标题', async () => {
    const parsed = await parseEpub(makeFile());

    expect(parsed.title).toBe('二次函数');
    expect(parsed.author).toBe('张老师');
    expect(parsed.sections).toHaveLength(2);
    // 第一章命中目录标题，第二章回退为文件名
    expect(parsed.sections[0].title).toBe('第一章 函数');
    expect(parsed.sections[1].title).toBe('ch2');
    expect(parsed.fileBytes.byteLength).toBeGreaterThan(0);
  });

  it('缺少元数据时使用文件名兜底', async () => {
    parseMockState.metadata = { title: '', creator: '' };
    const parsed = await parseEpub(makeFile());
    expect(parsed.title).toBe('book.epub');
    expect(parsed.author).toBeUndefined();
  });
});
