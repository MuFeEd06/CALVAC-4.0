import React, { useRef, useState, useCallback } from 'react';

interface Props {
  children: React.ReactNode;
  padding?: string;
}

export default function HorizontalScroll({ children, padding = '4px 5% 20px' }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);
  const velX = useRef(0);
  const lastX = useRef(0);
  const lastT = useRef(0);
  const rafId = useRef<number>();
  const dragDist = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    startX.current = e.pageX;
    scrollStart.current = wrapRef.current?.scrollLeft || 0;
    lastX.current = e.pageX;
    lastT.current = Date.now();
    velX.current = 0;
    dragDist.current = 0;
    cancelAnimationFrame(rafId.current!);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !wrapRef.current) return;
    wrapRef.current.scrollLeft = scrollStart.current - (e.pageX - startX.current);
    const now = Date.now();
    velX.current = (e.pageX - lastX.current) / Math.max(1, now - lastT.current) * 16;
    lastX.current = e.pageX;
    lastT.current = now;
    dragDist.current += Math.abs(e.movementX);
  }, [dragging]);

  const onMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    const glide = () => {
      if (Math.abs(velX.current) < 0.5 || !wrapRef.current) return;
      wrapRef.current.scrollLeft -= velX.current;
      velX.current *= 0.92;
      rafId.current = requestAnimationFrame(glide);
    };
    glide();
  }, [dragging]);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (dragDist.current > 6) e.stopPropagation();
  }, []);

  return (
    <div
      ref={wrapRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onClick}
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        padding,
        cursor: dragging ? 'grabbing' : 'grab',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        userSelect: 'none',
      }}
    >
      <style>{`div::-webkit-scrollbar{display:none}`}</style>
      <div style={{ display: 'flex', gap: 14, width: 'max-content', paddingBottom: 4 }}>
        {children}
      </div>
    </div>
  );
}
