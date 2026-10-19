import { useEffect, useRef, useState, type RefObject } from 'react';
import { useMotionValueEvent, useReducedMotion, type MotionValue } from 'framer-motion';
import { FrameBuffer } from '@/utils/frameBuffer';

export const SHOE_FRAME_COUNT = 60;

export function useShoeFrames(options: {
  canvasRef: RefObject<HTMLCanvasElement>; progress: MotionValue<number>;
  isMobile: boolean; skipped: boolean; imageScale: number; imageVisible: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const limitedMotion = Boolean(reducedMotion || connection?.saveData || options.skipped);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [bgColor, setBgColor] = useState('#F4F8FB');
  const buffer = useRef<FrameBuffer<ImageBitmap> | null>(null);
  const target = useRef(0);
  const color = useRef(bgColor);
  const config = useRef(options);
  config.current = options;
  const raf = useRef<number>();

  const draw = () => {
    raf.current = undefined;
    const canvas = config.current.canvasRef.current;
    const image = buffer.current?.nearest(target.current);
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.fillStyle = color.current;
    ctx.fillRect(0, 0, width, height);
    if (!config.current.imageVisible) return;
    const scale = Math.min(width / image.width, height / image.height) * config.current.imageScale;
    const dw = image.width * scale, dh = image.height * scale;
    ctx.drawImage(image, 1, 1, image.width - 2, image.height - 2, (width - dw) / 2, (height - dh) / 2, dw, dh);
  };
  const scheduleDraw = () => { if (raf.current === undefined) raf.current = requestAnimationFrame(draw); };

  useMotionValueEvent(options.progress, 'change', progress => {
    if (limitedMotion) return;
    target.current = Math.min(SHOE_FRAME_COUNT - 1, Math.max(0, Math.round(progress * (SHOE_FRAME_COUNT - 1))));
    buffer.current?.request(target.current);
    scheduleDraw();
  });

  useEffect(() => {
    setReady(false); setError(false);
    const base = (import.meta.env.VITE_FRAMES_BASE || '/frames/v2').replace(/\/$/, '');
    const variant = options.isMobile ? 'mobile' : 'desktop';
    const loader = new FrameBuffer<ImageBitmap>({
      count: SHOE_FRAME_COUNT, radius: limitedMotion ? 0 : 4, concurrency: 2,
      load: async (index, signal) => {
        const response = await fetch(`${base}/${variant}/${String(index).padStart(3, '0')}.webp`, { signal });
        if (!response.ok) throw new Error('Frame unavailable');
        return createImageBitmap(await response.blob());
      },
      release: frame => frame.close(),
      onReady: (index, frame) => {
        if (index === 0) {
          const sample = document.createElement('canvas'); sample.width = 1; sample.height = 1;
          const ctx = sample.getContext('2d');
          if (ctx) {
            ctx.drawImage(frame, 2, 2, 1, 1, 0, 0, 1, 1);
            const rgb = ctx.getImageData(0, 0, 1, 1).data;
            color.current = `#${[rgb[0], rgb[1], rgb[2]].map(c => c.toString(16).padStart(2, '0')).join('')}`;
            setBgColor(color.current);
          }
          setReady(true);
        }
        scheduleDraw();
      },
      onError: index => { if (index === 0) setError(true); },
    });
    buffer.current = loader;
    target.current = limitedMotion ? 0 : Math.round(options.progress.get() * (SHOE_FRAME_COUNT - 1));
    loader.request(target.current);
    const observer = new ResizeObserver(scheduleDraw);
    if (options.canvasRef.current) observer.observe(options.canvasRef.current);
    return () => {
      observer.disconnect(); loader.dispose(); buffer.current = null;
      if (raf.current !== undefined) cancelAnimationFrame(raf.current);
      raf.current = undefined;
    };
  }, [options.isMobile, limitedMotion]);

  useEffect(scheduleDraw, [options.imageScale, options.imageVisible]);
  return { ready, error, bgColor, limitedMotion };
}
