import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { fadeRouteIn } from '../animation/routeFade';
import { useReducedMotion } from '../animation/useReducedMotion';

/**
 * 路由出口容器：pathname 变化时执行淡入，并清理未完成的 tween。
 */
export function AnimatedOutlet() {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!ref.current) return;
    const tween = fadeRouteIn(ref.current, reduced);
    return () => {
      tween.kill();
    };
  }, [location.pathname, reduced]);

  return (
    <div ref={ref} className="route-outlet">
      <Outlet />
    </div>
  );
}
