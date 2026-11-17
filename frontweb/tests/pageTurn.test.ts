import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageTurnTimeline } from '../src/animation/pageTurn';

// 用轻量 mock 替换真实 GSAP，仅验证时间轴的构造行为
const toMock = vi.fn().mockReturnThis();
const durationMock = vi.fn().mockReturnThis();
const timelineMock = {
  to: toMock,
  duration: durationMock,
  kill: vi.fn(),
};

vi.mock('gsap', () => ({
  default: {
    timeline: () => timelineMock,
    set: vi.fn(),
  },
}));

describe('createPageTurnTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常动效时创建新旧页并行动画', () => {
    const current = document.createElement('div');
    const next = document.createElement('div');

    createPageTurnTimeline({ current, next }, 'next', false);

    // 两次 to：旧页退出 + 新页进入
    expect(toMock).toHaveBeenCalledTimes(2);
    expect(durationMock).not.toHaveBeenCalledWith(0);
  });

  it('减少动效时时间轴时长置 0', () => {
    const current = document.createElement('div');
    const next = document.createElement('div');

    createPageTurnTimeline({ current, next }, 'prev', true);

    expect(durationMock).toHaveBeenCalledWith(0);
  });
});
