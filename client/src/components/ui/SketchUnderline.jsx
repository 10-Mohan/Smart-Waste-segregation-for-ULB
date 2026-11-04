import { useLayoutEffect, useState } from 'react';
import './SketchUnderline.css';

function scribble(width) {
  const w = Math.max(20, Math.round(width));
  return {
    main: `M2 6 C ${w * 0.2} 2, ${w * 0.38} 9, ${w * 0.55} 5 S ${w * 0.85} 3, ${w - 2} 6`,
    second: `M${w * 0.06} 8.5 C ${w * 0.3} 6, ${w * 0.62} 10, ${w * 0.94} 7.5`,
    w,
  };
}

/** A hand-drawn underline that slides under the active item of its container. */
export default function SketchUnderline({ containerRef, activeKey, itemSelector, inset = 6, offset = -5 }) {
  const [box, setBox] = useState(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let cancelled = false;

    function measure() {
      if (cancelled) return;
      const active = container.querySelector(itemSelector);
      if (!active) {
        setBox(null);
        return;
      }
      setBox({
        left: active.offsetLeft + inset,
        top: active.offsetTop + active.offsetHeight + offset,
        width: Math.max(16, active.offsetWidth - inset * 2),
      });
    }

    measure();
    const frame = requestAnimationFrame(() => setReady(true));
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(container);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [containerRef, activeKey, itemSelector, inset, offset]);

  if (!box) return null;
  const path = scribble(box.width);

  return (
    <span
      className={`sketch-underline${ready ? ' is-ready' : ''}`}
      style={{ left: box.left, top: box.top, width: box.width }}
      aria-hidden="true"
    >
      <svg key={activeKey} viewBox={`0 0 ${path.w} 10`} width={path.w} height="10">
        <path d={path.main} pathLength="1" />
        <path d={path.second} pathLength="1" />
      </svg>
    </span>
  );
}