import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// jsdom 未实现 Blob URL，epubjs 解析 CSS/图片资源时会调用，测试环境提供最小替身
if (!URL.createObjectURL) {
  URL.createObjectURL = (() => 'blob:bookview/test') as typeof URL.createObjectURL;
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = (() => undefined) as typeof URL.revokeObjectURL;
}

// jsdom 未实现 matchMedia，测试环境提供最小替身（默认不减少动效）
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
