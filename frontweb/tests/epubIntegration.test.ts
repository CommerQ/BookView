import { describe, expect, it } from 'vitest';
import { loadSectionHtml, parseEpub } from '../src/services/epub/epubService';
import { asFile, buildEpub } from './fixtures/buildEpub';

describe('EPUB 解析集成', () => {
  it('解析真实 EPUB 的元数据、目录标题并读取章节正文', async () => {
    const bytes = await buildEpub();
    const parsed = await parseEpub(asFile(bytes));

    expect(parsed.title).toBe('测试之书');
    expect(parsed.author).toBe('测试作者');
    expect(parsed.sections.map((section) => section.href)).toEqual(['ch1.xhtml', 'ch2.xhtml']);
    expect(parsed.sections[0].title).toBe('第一章');

    const html = await loadSectionHtml(parsed.fileBytes, parsed.sections, 0);
    expect(html).toContain('第一章正文内容');
    // 正文包在阅读内容容器内，便于限定 EPUB 样式
    expect(html).toContain('class="reader-content"');
    // EPUB CSS 被注入并限定作用域，不再以 body 作为全局选择器
    expect(html).toContain('<style>');
    expect(html).toContain('.reader-content p');
    expect(html).toContain('text-indent');
    expect(html).not.toMatch(/body\s*\{/);
  });
});
