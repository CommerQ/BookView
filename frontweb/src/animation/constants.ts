/**
 * 动画时长与位移常量。
 * 需求 FR-A01：翻页时长 0.35–0.5s。
 */

/** 翻页动画时长（秒） */
export const PAGE_TURN_DURATION = 0.45;

/** 翻页时新旧页的水平位移量（像素） */
export const PAGE_OFFSET_PX = 48;

/** 路由切换淡入时长（秒），对应 FR-A02 */
export const ROUTE_FADE_DURATION = 0.25;

/** 统一缓动曲线，避免各页面观感不一致 */
export const PAGE_TURN_EASE = 'power2.out';
