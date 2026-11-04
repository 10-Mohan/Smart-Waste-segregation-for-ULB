import { useEffect, useRef } from 'react';
import './RetroTvError.css';

const NOISE_W = 106;
const NOISE_H = 52;

/** Live black-and-white TV static. Draws one still frame if the user prefers reduced motion. */
function StaticNoise() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return undefined;
    const image = context.createImageData(NOISE_W, NOISE_H);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let last = 0;

    function paint() {
      const { data } = image;
      for (let i = 0; i < data.length; i += 4) {
        const value = Math.random() < 0.5 ? 0 : 255;
        data[i] = value;
        data[i + 1] = value;
        data[i + 2] = value;
        data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    }

    function tick(time) {
      if (time - last > 70) {
        paint();
        last = time;
      }
      frame = requestAnimationFrame(tick);
    }

    paint();
    if (!reduceMotion) frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="retro-tv__noise" width={NOISE_W} height={NOISE_H} aria-hidden="true" />;
}

export default function RetroTvError({ code = '404', message = 'NOT FOUND', title, description, children, className = '' }) {
  const digits = String(code).split('');

  return (
    <div className={`retro-tv-error ${className}`.trim()}>
      <div className="retro-tv" aria-hidden="true">
        <svg viewBox="0 0 300 230" xmlns="http://www.w3.org/2000/svg">
          {digits.map((digit, index) => (
            <text
              key={`${digit}-${index}`}
              x={(300 * (index + 0.5)) / digits.length}
              y="170"
              fontSize="190"
              textAnchor="middle"
              className="retro-tv__ghost"
            >
              {digit}
            </text>
          ))}
          <line x1="138" y1="70" x2="112" y2="16" className="retro-tv__rod" />
          <circle cx="112" cy="14" r="4" className="retro-tv__tip" />
          <line x1="162" y1="68" x2="190" y2="28" className="retro-tv__rod" />
          <circle cx="192" cy="25" r="4" className="retro-tv__tip" />
          <path d="M112 96 A38 30 0 0 1 188 96 Z" className="retro-tv__dome" />
          <ellipse cx="133" cy="78" rx="10" ry="4" transform="rotate(-20 133 78)" className="retro-tv__shine" />
          <rect x="14" y="94" width="272" height="112" rx="14" className="retro-tv__body" />
          <rect x="20" y="100" width="260" height="100" rx="10" className="retro-tv__bevel" />
          <rect x="24" y="104" width="176" height="92" rx="12" className="retro-tv__frame" />
          <rect x="208" y="104" width="68" height="92" rx="9" className="retro-tv__panel" />
          <circle cx="242" cy="126" r="12" className="retro-tv__knob" />
          <line x1="236" y1="132" x2="248" y2="120" className="retro-tv__mark" />
          <circle cx="242" cy="158" r="12" className="retro-tv__knob" />
          <line x1="236" y1="164" x2="248" y2="152" className="retro-tv__mark" />
          <circle cx="224" cy="177" r="3.5" className="retro-tv__knob" />
          <circle cx="242" cy="177" r="3.5" className="retro-tv__knob" />
          <circle cx="260" cy="177" r="3.5" className="retro-tv__knob" />
          <line x1="222" y1="185" x2="262" y2="185" className="retro-tv__mark" />
          <line x1="222" y1="191" x2="262" y2="191" className="retro-tv__mark" />
          <rect x="44" y="206" width="34" height="12" className="retro-tv__foot" />
          <rect x="222" y="206" width="34" height="12" className="retro-tv__foot" />
          <line x1="6" y1="218" x2="294" y2="218" className="retro-tv__ground" />
        </svg>
        <div className="retro-tv__screen">
          <StaticNoise />
          <span className="retro-tv__label">{message}</span>
        </div>
      </div>

      <div className="retro-tv-error__text">
        <p className="sr-only">Error {code}: {message}</p>
        {title && <h1 className="retro-tv-error__title">{title}</h1>}
        {description && <p className="retro-tv-error__description">{description}</p>}
        {children && <div className="retro-tv-error__actions">{children}</div>}
      </div>
    </div>
  );
}