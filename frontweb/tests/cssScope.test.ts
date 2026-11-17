import { describe, expect, it } from 'vitest';
import { scopeCss } from '../src/services/epub/cssScope';

describe('scopeCss', () => {
  it('把 body/html 根选择器映射到内容容器', () => {
    const output = scopeCss('body { margin: 0; } html { padding: 0; }');
    expect(output).toContain('.reader-content');
    expect(output).not.toMatch(/body\s*\{/);
    expect(output).not.toMatch(/html\s*\{/);
  });

  it('为普通选择器加容器前缀并处理选择器列表', () => {
    const output = scopeCss('p, a:hover { color: red; }');
    expect(output).toContain('.reader-content p');
    expect(output).toContain('.reader-content a:hover');
  });

  it('递归限定 @media 内的规则', () => {
    const output = scopeCss('@media (min-width: 600px) { body p { line-height: 1.8; } }');
    expect(output).toContain('@media (min-width: 600px)');
    expect(output).toContain('.reader-content p');
  });

  it('保留 @font-face 并丢弃 @import/@charset', () => {
    const output = scopeCss(`
      @charset "utf-8";
      @import url("other.css");
      @font-face { font-family: BookFont; src: url("font.woff2"); }
    `);
    expect(output).toContain('@font-face');
    expect(output).toContain('font-family: BookFont');
    expect(output).not.toContain('@import');
    expect(output).not.toContain('@charset');
  });

  it('兼容 body 带 class 的根选择器', () => {
    const output = scopeCss('body.calibre p { text-indent: 2em; }');
    expect(output).toContain('.reader-content.calibre p');
  });
});
