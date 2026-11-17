import gsap from 'gsap';
import { PAGE_OFFSET_PX, PAGE_TURN_DURATION, PAGE_TURN_EASE } from './constants';

/** 参与翻页动画的两层 DOM：当前页与即将进入的下一页 */
export interface PageTurnLayer {
  current: HTMLElement;
  next: HTMLElement;
}

/**
 * 创建翻页时间轴（仅动画 transform 的 x 与 opacity，满足 NFR-01）。
 * 调用方需在 onComplete 中交换两层内容并写入阅读进度。
 *
 * @param layers 当前页与下一页 DOM
 * @param direction next=向后翻，prev=向前翻
 * @param reducedMotion 系统开启「减少动态效果」时整条时间轴时长置 0
 */
export function createPageTurnTimeline(
  layers: PageTurnLayer,
  direction: 'next' | 'prev',
  reducedMotion: boolean
): gsap.core.Timeline {
  const { current, next } = layers;

  // 根据方向决定旧页退出/新页进入的位移符号
  const outX = direction === 'next' ? -PAGE_OFFSET_PX : PAGE_OFFSET_PX;
  const inFromX = direction === 'next' ? PAGE_OFFSET_PX : -PAGE_OFFSET_PX;

  // 初始化下一页位置：先放到屏幕外并隐藏，避免首帧闪烁
  gsap.set(next, { x: inFromX, opacity: 0, display: 'block' });

  // 旧页退出与新页进入并行动画，保证翻页连贯
  const tl = gsap.timeline({
    defaults: { duration: PAGE_TURN_DURATION, ease: PAGE_TURN_EASE },
  });
  tl.to(current, { x: outX, opacity: 0 }, 0).to(next, { x: 0, opacity: 1 }, 0);

  // 减少动效：直接跳到终态
  if (reducedMotion) tl.duration(0);

  return tl;
}
