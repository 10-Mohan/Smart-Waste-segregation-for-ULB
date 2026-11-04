import { useEffect, useId, useRef, useState } from 'react';
import './Tabs.css';
import SketchUnderline from './SketchUnderline.jsx';

export default function Tabs({ items, defaultTab, onChange, label = 'Content tabs' }) {
  const generatedId = useId();
  const [activeId, setActiveId] = useState(defaultTab || items[0]?.id);
  const buttons = useRef([]);
  const listRef = useRef(null);
  const activeItem = items.find((item) => item.id === activeId) || items[0];

  useEffect(() => {
    if (defaultTab && defaultTab !== activeId) {
      setActiveId(defaultTab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab]);

  function activate(index) {
    const next = items[index];
    if (!next) return;
    setActiveId(next.id);
    onChange?.(next.id);
    buttons.current[index]?.focus();
  }

  function handleKeyDown(event, index) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      activate((index + 1) % items.length);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      activate((index - 1 + items.length) % items.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      activate(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      activate(items.length - 1);
    }
  }

  return (
    <div className="ui-tabs">
      <div className="ui-tabs__list" role="tablist" aria-label={label} ref={listRef}>
        {items.map((item, index) => {
          const selected = item.id === activeItem?.id;
          return (
            <button
              key={item.id}
              ref={(element) => { buttons.current[index] = element; }}
              id={`${generatedId}-tab-${item.id}`}
              className="ui-tabs__tab"
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${generatedId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => { setActiveId(item.id); onChange?.(item.id); }}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item.label}
            </button>
          );
        })}
        <SketchUnderline containerRef={listRef} activeKey={activeItem?.id} itemSelector='[role="tab"][aria-selected="true"]' offset={-10} />
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          className="ui-tabs__panel"
          id={`${generatedId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${generatedId}-tab-${item.id}`}
          tabIndex="0"
          hidden={item.id !== activeItem?.id}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}