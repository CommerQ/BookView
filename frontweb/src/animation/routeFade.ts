import gsap from 'gsap';
import { ROUTE_FADE_DURATION } from './constants';

/**
 * 路由切换时对容器做淡入（FR-A02）。
 * 减少动效模式下时长置 0，仅保证内容可见。
 */
export function fadeRouteIn(el: HTMLElement, reducedMotion: boolean): gsap.core.Tween {
  gsap.set(el, { opacity: reducedMotion ? 1 : 0 });
  return gsap.to(el, {
    opacity: 1,
    duration: reducedMotion ? 0 : ROUTE_FADE_DURATION,
    ease: 'power1.out',
  });
}
