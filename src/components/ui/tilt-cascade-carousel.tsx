import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import './tilt-cascade-carousel.css';

export type TiltCascadeItem = { id: string; title: string; src: string; href: string; fallback: ReactNode };
type Props = { items: TiltCascadeItem[]; ariaLabel?: string; loop?: boolean; defaultIndex?: number };
type Drag = { id: number; x: number; y: number; position: number; moved: boolean; samples: { time: number; x: number }[] };

const wrap = (position: number, count: number) => ((position % count) + count) % count;
const indexAt = (position: number, count: number, loop: boolean) => loop ? wrap(Math.round(position), count) : Math.min(Math.max(Math.round(position), 0), count - 1);
const offset = (index: number, position: number, count: number, loop: boolean) => {
  const distance = index - position;
  return loop ? distance - count * Math.round(distance / count) : distance;
};
// The supplied carousel uses a firm slide spring and a softer trailing tilt.
function spring(position: number, velocity: number, target: number, omega: number, damping: number, elapsed: number) {
  const steps = Math.max(1, Math.ceil(elapsed * 240)), dt = elapsed / steps;
  for (let step = 0; step < steps; step++) {
    velocity += (-omega * omega * (position - target) - 2 * damping * omega * velocity) * dt;
    position += velocity * dt;
  }
  return [position, velocity];
}

/** Store collection adaptation of the supplied Tilt Cascade Carousel. */
export default function TiltCascadeCarousel({ items, ariaLabel = 'Collection carousel', loop = true, defaultIndex = 0 }: Props) {
  const count = items.length, start = Math.min(Math.max(Math.round(defaultIndex), 0), Math.max(count - 1, 0));
  const [active, setActive] = useState(start);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null), stageRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const engine = useRef({
    slide: start, slideVelocity: 0, tilt: start, tiltVelocity: 0, target: start, active: start,
    raf: 0, last: 0, size: 240, reduced: false, drag: null as Drag | null,
    clickBlock: false, wheel: 0, wheelAt: 0, stepAt: 0,
  }).current;
  const config = useRef({ count, loop });
  config.current = { count, loop };

  const transformFor = (index: number) => {
    const { count, loop } = config.current;
    const x = offset(index, engine.slide, count, loop), distance = offset(index, engine.tilt, count, loop);
    const scale = 1 - 0.36 * Math.min(Math.abs(distance), 1);
    return {
      transform: `translate3d(calc(${x.toFixed(4)} * var(--tcc-size)), ${(distance * 38).toFixed(3)}%, 0) scale(${scale.toFixed(4)}) rotate(${(distance * 24).toFixed(3)}deg)`,
      zIndex: 100 - Math.round(Math.abs(distance) * 10), hidden: Math.abs(x) > 3.5 && index !== engine.active,
    };
  };
  const paint = () => {
    slideRefs.current.forEach((element, index) => {
      if (!element) return;
      const frame = transformFor(index);
      element.style.transform = frame.transform;
      element.style.zIndex = String(frame.zIndex);
      element.style.visibility = frame.hidden ? 'hidden' : '';
    });
  };
  const frame = (now: number) => {
    const dt = Math.min((now - (engine.last || now)) / 1000, 0.05);
    engine.last = now;
    if (engine.reduced) {
      if (!engine.drag) engine.slide = engine.target;
      engine.tilt = engine.slide;
      engine.slideVelocity = engine.tiltVelocity = 0;
    } else {
      const omega = 2 * Math.PI / 0.8;
      if (!engine.drag) [engine.slide, engine.slideVelocity] = spring(engine.slide, engine.slideVelocity, engine.target, omega, 0.9, dt);
      [engine.tilt, engine.tiltVelocity] = spring(engine.tilt, engine.tiltVelocity, engine.slide, omega * 1.05, 0.8, dt);
    }
    paint();
    const settled = (engine.drag || Math.abs(engine.slide - engine.target) < 0.001 && Math.abs(engine.slideVelocity) < 0.01)
      && Math.abs(engine.tilt - engine.slide) < 0.001 && Math.abs(engine.tiltVelocity) < 0.01;
    if (settled) {
      if (!engine.drag) engine.slide = engine.tilt = engine.target;
      paint();
      engine.raf = engine.last = 0;
      rootRef.current?.removeAttribute('data-moving');
    } else engine.raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!engine.raf) {
      rootRef.current?.setAttribute('data-moving', '');
      engine.raf = requestAnimationFrame(frame);
    }
  };
  const updateActive = (index: number) => {
    if (index !== engine.active) { engine.active = index; setActive(index); }
  };
  const setTarget = (target: number) => {
    const { count, loop } = config.current;
    if (!count) return;
    engine.target = loop ? target : Math.min(Math.max(target, 0), count - 1);
    updateActive(indexAt(engine.target, count, loop));
    kick();
  };
  const step = (by: number) => setTarget(Math.round(engine.target) + by);
  const goTo = (index: number) => {
    const { count, loop } = config.current;
    setTarget(loop ? engine.target + offset(index, Math.round(engine.target), count, true) : index);
  };

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { engine.reduced = media.matches; kick(); };
    preference();
    media.addEventListener('change', preference);
    const stage = stageRef.current;
    const measure = () => { engine.size = stage?.offsetWidth || 240; };
    measure();
    const observer = new ResizeObserver(measure);
    if (stage) observer.observe(stage);
    return () => {
      media.removeEventListener('change', preference);
      observer.disconnect();
      cancelAnimationFrame(engine.raf);
      engine.raf = engine.last = 0;
      engine.drag = null;
    };
    // All animation callbacks use stable refs rather than captured render state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || config.current.count < 2) return;
      event.preventDefault();
      const now = performance.now();
      if (now - engine.wheelAt > 160) engine.wheel = 0;
      engine.wheelAt = now;
      engine.wheel += event.deltaX;
      if (Math.abs(engine.wheel) > 50 && now - engine.stepAt > 320) {
        step(Math.sign(engine.wheel)); engine.wheel = 0; engine.stepAt = now;
      }
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => root.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    engine.clickBlock = false;
    if (event.button !== 0 || !event.isPrimary || count < 2 || (event.target as Element).closest('[data-tcc-controls]')) return;
    engine.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, position: engine.slide, moved: false, samples: [{ time: event.timeStamp, x: event.clientX }] };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = engine.drag;
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved) {
      if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) { engine.drag = null; return; }
      if (Math.abs(dx) < 6) return;
      drag.moved = true; engine.slideVelocity = 0;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
    const raw = drag.position - dx / engine.size;
    engine.slide = loop ? raw : raw < 0 ? raw / 3 : raw > count - 1 ? count - 1 + (raw - count + 1) / 3 : raw;
    drag.samples.push({ time: event.timeStamp, x: event.clientX });
    if (drag.samples.length > 6) drag.samples.shift();
    updateActive(indexAt(engine.slide, count, loop));
    kick();
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = engine.drag;
    if (!drag || drag.id !== event.pointerId) return;
    engine.drag = null;
    if (!drag.moved) return;
    setDragging(false); engine.clickBlock = true;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const first = drag.samples[0], last = drag.samples[drag.samples.length - 1];
    const velocity = event.type !== 'pointerup' ? 0 : -(last.x - first.x) / Math.max(last.time - first.time, 1) / engine.size * 1000;
    engine.slideVelocity = Math.min(Math.max(velocity, -8), 8);
    const here = Math.round(engine.slide);
    setTarget(Math.min(Math.max(Math.round(engine.slide + engine.slideVelocity * 0.2), here - 3), here + 3));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    engine.clickBlock = false;
    if (event.altKey || event.ctrlKey || event.metaKey || count < 2) return;
    if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
    else if (event.key === 'Home') goTo(0);
    else if (event.key === 'End') goTo(count - 1);
    else return;
    event.preventDefault();
    if ((event.target as Element).closest('.tcc-slide')) {
      const slide = slideRefs.current[engine.active];
      if (slide) { slide.style.visibility = ''; slide.focus({ preventScroll: true }); }
    }
  };

  if (!count) return null;
  return <div ref={rootRef} className="tcc-root" role="region" aria-roledescription="carousel" aria-label={ariaLabel}
    tabIndex={0} data-dragging={dragging ? '' : undefined} onKeyDown={onKeyDown}
    onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    onLostPointerCapture={event => {
      // Touch starts with implicit capture on the card. Its bubbled release
      // during transfer to the carousel must not end the drag we just started.
      if (event.target === event.currentTarget) onPointerUp(event);
    }} onDragStart={event => event.preventDefault()}
    onClickCapture={event => { if (engine.clickBlock) { event.preventDefault(); event.stopPropagation(); engine.clickBlock = false; } }}>
    <div ref={stageRef} className="tcc-stage">
      {items.map((item, index) => {
        const style = transformFor(index), isActive = index === active;
        return <Link key={item.id} ref={element => { slideRefs.current[index] = element; }} to={item.href}
          className="tcc-slide" data-active={isActive ? '' : undefined} tabIndex={isActive ? 0 : -1}
          aria-label={`Shop ${item.title}`} aria-current={isActive ? 'true' : undefined}
          onClick={event => { if (!isActive && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); goTo(index); } }}
          style={{ transform: style.transform, zIndex: style.zIndex, visibility: style.hidden ? 'hidden' : undefined }}>
          <span className="tcc-frame">
            <img src={item.src} alt="" draggable={false} loading="lazy" decoding="async" width={400} height={400}
              onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.nextElementSibling?.removeAttribute('hidden'); }} />
            <span className="tcc-fallback" hidden aria-hidden="true">{item.fallback}</span>
          </span>
          <span className="tcc-title" aria-hidden="true">{item.title}</span>
          <span className="tcc-caption" aria-hidden="true">Explore collection <ArrowUpRight size={14} /></span>
        </Link>;
      })}
    </div>
    {count > 1 && <div className="tcc-controls" data-tcc-controls="" role="group" aria-label="Collection controls">
      <button type="button" className="tcc-button" aria-label="Previous collection" disabled={!loop && active === 0} onClick={() => step(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
      <div className="tcc-dots">{items.map((item, index) => <button key={item.id} type="button" className="tcc-dot" aria-label={`Choose collection: ${item.title}`}
        aria-current={index === active ? 'true' : undefined} onClick={() => goTo(index)} />)}</div>
      <span className="tcc-count" aria-hidden="true">{String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
      <button type="button" className="tcc-button" aria-label="Next collection" disabled={!loop && active === count - 1} onClick={() => step(1)}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>}
    <span className="sr-only" aria-live="polite" aria-atomic="true">Collection {active + 1} of {count}: {items[active]?.title}</span>
  </div>;
}
