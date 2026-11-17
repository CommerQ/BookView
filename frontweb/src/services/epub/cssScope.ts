/**
 * EPUB 自带 CSS 的作用域处理。
 * EPUB 样式通常以 html/body 为根，直接注入会污染应用界面；
 * 这里把选择器统一限定到阅读内容容器，并保留 @media/@font-face 等结构。
 */

/** 读取字符串字面量后的位置（跳过转义） */
function skipString(css: string, start: number): number {
  const quote = css[start];
  let index = start + 1;
  while (index < css.length) {
    if (css[index] === '\\') {
      index += 2;
      continue;
    }
    if (css[index] === quote) return index + 1;
    index += 1;
  }
  return css.length;
}

/** 跳过成对的括号（支持嵌套、字符串与注释） */
function skipPair(css: string, start: number, open: string, close: string): number {
  let depth = 0;
  let index = start;
  while (index < css.length) {
    const char = css[index];
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      index = end === -1 ? css.length : end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(css, index);
      continue;
    }
    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return css.length;
}

/** 查找顶层的目标字符，忽略注释、字符串与括号内部 */
function findNextTopLevel(css: string, start: number, targets: string): number {
  let index = start;
  while (index < css.length) {
    const char = css[index];
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      index = end === -1 ? css.length : end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(css, index);
      continue;
    }
    if (char === '(' ) {
      index = skipPair(css, index, '(', ')');
      continue;
    }
    if (char === '[') {
      index = skipPair(css, index, '[', ']');
      continue;
    }
    if (targets.includes(char)) return index;
    index += 1;
  }
  return -1;
}

/** 找到与 openIndex 处 "{" 匹配的 "}" */
function findMatchingBrace(css: string, openIndex: number): number {
  let depth = 0;
  let index = openIndex;
  while (index < css.length) {
    const char = css[index];
    if (char === '/' && css[index + 1] === '*') {
      const end = css.indexOf('*/', index + 2);
      index = end === -1 ? css.length : end + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      index = skipString(css, index);
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
    index += 1;
  }
  return -1;
}

/** 按顶层逗号拆分选择器列表 */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let index = 0;

  while (index < prelude.length) {
    const char = prelude[index];
    if (char === '"' || char === "'") {
      index = skipString(prelude, index);
      continue;
    }
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1);
    if (char === ',' && depth === 0) {
      parts.push(prelude.slice(start, index));
      start = index + 1;
    }
    index += 1;
  }
  parts.push(prelude.slice(start));
  return parts;
}

/** 转义正则中的作用域选择器 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 限定单个选择器：
 * - html/body/:root 映射为内容容器
 * - 其余选择器加容器前缀
 */
function scopeSelector(selector: string, scope: string): string {
  let value = selector.trim();
  if (!value || value.startsWith('@')) return value;
  if (value.startsWith(scope)) return value;
  if (value === '*') return `${scope}, ${scope} *`;

  // 把 html/body/:root 映射为容器本身，兼容 body p、body.calibre 等写法
  value = value.replace(
    /(^|[\s>+~])(html|body|:root)(?=$|[\s>+~.:#[])/gi,
    (_match, lead: string) => `${lead}${scope}`
  );

  // 折叠 容器 容器 这类重复前缀
  const duplicate = new RegExp(
    `(${escapeRegExp(scope)})(?:\\s+${escapeRegExp(scope)})+`,
    'g'
  );
  value = value.replace(duplicate, '$1');

  if (!value.startsWith(scope) && !value.startsWith(':scope')) {
    value = `${scope} ${value}`;
  }
  return value;
}

/** 处理一段 CSS 规则体 */
function transformBlock(css: string, scope: string): string {
  let output = '';
  let index = 0;

  while (index < css.length) {
    const next = findNextTopLevel(css, index, '{;');
    if (next === -1) {
      const rest = css.slice(index).trim();
      if (rest) output += `${rest}\n`;
      break;
    }

    const prelude = css.slice(index, next).trim();

    // 顶层语句：@import/@charset 丢弃，@namespace 等保留
    if (css[next] === ';') {
      if (prelude && !/^@(charset|import)\b/i.test(prelude)) output += `${prelude};\n`;
      index = next + 1;
      continue;
    }

    const close = findMatchingBrace(css, next);
    const body = css.slice(next + 1, close === -1 ? css.length : close);

    if (!prelude) {
      index = close === -1 ? css.length : close + 1;
      continue;
    }

    if (prelude.startsWith('@')) {
      const name = prelude.slice(1).split(/[\s{]/)[0].toLowerCase();
      if (['media', 'supports', 'container', 'layer', 'scope'].includes(name)) {
        output += `${prelude}{${transformBlock(body, scope)}}\n`;
      } else if (name === 'charset' || name === 'import') {
        // 已在顶层处理，忽略
      } else {
        // @font-face、@keyframes、@page 等无选择器，原样保留
        output += `${prelude}{${body}}\n`;
      }
    } else {
      const selectors = splitSelectors(prelude)
        .map((item) => scopeSelector(item, scope))
        .filter(Boolean)
        .join(', ');
      output += `${selectors}{${body}}\n`;
    }

    index = close === -1 ? css.length : close + 1;
  }

  return output;
}

/**
 * 将任意 EPUB CSS 限定到指定容器。
 * @param css EPUB 中的样式文本
 * @param scope 内容容器选择器，例如 `.reader-content`
 */
export function scopeCss(css: string, scope = '.reader-content'): string {
  return transformBlock(css, scope).trim();
}
