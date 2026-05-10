"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

/* ─────────────────────────────────────────────
   TYPES
───────────────────────────────────────────── */
export type FocusRailItem = {
  id: string | number;
  title: string;
  description?: string;
  imageSrc: string;
  href?: string;
  meta?: string;
  price?: string;
  badge?: string;
};

interface FocusRailProps {
  items: FocusRailItem[];
  initialIndex?: number;
  loop?: boolean;
  autoPlay?: boolean;
  interval?: number;
  style?: React.CSSProperties;
}

/* ─────────────────────────────────────────────
   HELPERS & PHYSICS CONFIG
───────────────────────────────────────────── */
function wrap(min: number, max: number, v: number) {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
}

const BASE_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
  mass: 1,
};

const TAP_SPRING = {
  type: "spring" as const,
  stiffness: 450,
  damping: 18,
  mass: 1,
};

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export function FocusRail({
  items,
  initialIndex = 0,
  loop = true,
  autoPlay = false,
  interval = 4000,
  style,
}: FocusRailProps) {
  const [active, setActive] = React.useState(initialIndex);
  const [isHovering, setIsHovering] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const lastWheelTime = React.useRef<number>(0);

  const count = items.length;
  const activeIndex = wrap(0, count, active);
  const activeItem = items[activeIndex];

  /* ── Navigation ── */
  const handlePrev = React.useCallback(() => {
    if (!loop && active === 0) return;
    setActive((p) => p - 1);
  }, [loop, active]);

  const handleNext = React.useCallback(() => {
    if (!loop && active === count - 1) return;
    setActive((p) => p + 1);
  }, [loop, active, count]);

  /* ── Mouse wheel / trackpad ── */
  const onWheel = React.useCallback(
    (e: React.WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 400) return;
      const isHoriz = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHoriz ? e.deltaX : e.deltaY;
      if (Math.abs(delta) > 20) {
        delta > 0 ? handleNext() : handlePrev();
        lastWheelTime.current = now;
      }
    },
    [handleNext, handlePrev]
  );

  /* ── Autoplay ── */
  React.useEffect(() => {
    if (!autoPlay || isHovering) return;
    const t = setInterval(handleNext, interval);
    return () => clearInterval(t);
  }, [autoPlay, isHovering, handleNext, interval]);

  /* ── Keyboard ── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") handlePrev();
    if (e.key === "ArrowRight") handleNext();
  };

  /* ── Swipe / drag ── */
  const swipeThreshold = 10000;
  const swipePower = (offset: number, velocity: number) =>
    Math.abs(offset) * velocity;

  const onDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    { offset, velocity }: PanInfo
  ) => {
    setIsDragging(false);
    const swipe = swipePower(offset.x, velocity.x);
    if (swipe < -swipeThreshold) handleNext();
    else if (swipe > swipeThreshold) handlePrev();
  };

  const visibleIndices = [-2, -1, 0, 1, 2];

  /* ── Styles (inline — no Tailwind) ── */
  const S = {
    root: {
      position: "relative" as const,
      display: "flex",
      flexDirection: "column" as const,
      height: 620,
      width: "100%",
      overflow: "hidden",
      background: "#080808",
      color: "#fff",
      outline: "none",
      userSelect: "none" as const,
      borderRadius: 20,
      ...style,
    },
    bgLayer: {
      position: "absolute" as const,
      inset: 0,
      zIndex: 0,
      pointerEvents: "none" as const,
    },
    bgImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover" as const,
      filter: "blur(64px) saturate(200%)",
    },
    bgGrad: {
      position: "absolute" as const,
      inset: 0,
      background:
        "linear-gradient(to top, #080808 0%, rgba(8,8,8,0.6) 50%, transparent 100%)",
    },
    stage: {
      position: "relative" as const,
      zIndex: 10,
      display: "flex",
      flex: 1,
      flexDirection: "column" as const,
      justifyContent: "center",
      padding: "0 32px",
    },
    rail: {
      position: "relative" as const,
      margin: "0 auto",
      display: "flex",
      height: 360,
      width: "100%",
      maxWidth: 1100,
      alignItems: "center",
      justifyContent: "center",
      perspective: "1200px",
      cursor: isDragging ? "grabbing" : "grab",
    },
    card: (isCenter: boolean): React.CSSProperties => ({
      position: "absolute" as const,
      width: 260,
      aspectRatio: "3/4",
      borderRadius: 16,
      borderTop: "1px solid rgba(255,255,255,0.18)",
      background: "#1a1a1a",
      boxShadow: isCenter
        ? "0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)"
        : "0 16px 32px rgba(0,0,0,0.4)",
      zIndex: isCenter ? 20 : 10,
      transformStyle: "preserve-3d" as const,
      overflow: "hidden",
    }),
    cardImg: {
      width: "100%",
      height: "100%",
      objectFit: "cover" as const,
      pointerEvents: "none" as const,
      borderRadius: 16,
    },
    cardShineTop: {
      position: "absolute" as const,
      inset: 0,
      borderRadius: 16,
      background: "linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)",
      pointerEvents: "none" as const,
    },
    cardShineDark: {
      position: "absolute" as const,
      inset: 0,
      borderRadius: 16,
      background: "rgba(0,0,0,0.08)",
      mixBlendMode: "multiply" as const,
      pointerEvents: "none" as const,
    },
    /* badge on center card */
    cardBadge: {
      position: "absolute" as const,
      top: 12,
      left: 12,
      background: "var(--primary, #2B9FD8)",
      color: "#fff",
      fontSize: "0.6rem",
      fontWeight: 800,
      padding: "3px 9px",
      borderRadius: 20,
      letterSpacing: "0.6px",
      textTransform: "uppercase" as const,
    },
    /* price on center card */
    cardPrice: {
      position: "absolute" as const,
      bottom: 12,
      right: 12,
      background: "rgba(0,0,0,0.72)",
      backdropFilter: "blur(8px)",
      color: "#fff",
      fontSize: "0.88rem",
      fontWeight: 800,
      padding: "4px 10px",
      borderRadius: 20,
      border: "1px solid rgba(255,255,255,0.12)",
    },
    info: {
      margin: "0 auto",
      marginTop: 40,
      display: "flex",
      width: "100%",
      maxWidth: 900,
      flexDirection: "row" as const,
      alignItems: "center",
      justifyContent: "space-between",
      gap: 24,
      flexWrap: "wrap" as const,
      pointerEvents: "auto" as const,
    },
    infoText: {
      flex: 1,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "flex-start",
      textAlign: "left" as const,
      height: 120,
      justifyContent: "center",
      minWidth: 200,
    },
    metaTag: {
      fontSize: "0.72rem",
      fontWeight: 600,
      textTransform: "uppercase" as const,
      letterSpacing: "0.12em",
      color: "var(--primary, #2B9FD8)",
      marginBottom: 6,
    },
    title: {
      fontSize: "clamp(1.5rem, 3vw, 2rem)",
      fontWeight: 800,
      letterSpacing: "-0.03em",
      color: "#fff",
      lineHeight: 1.1,
      fontFamily: "var(--font-display, system-ui)",
      marginBottom: 8,
    },
    desc: {
      maxWidth: 380,
      color: "#a3a3a3",
      fontSize: "0.88rem",
      lineHeight: 1.6,
    },
    controls: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      flexShrink: 0,
    },
    navPill: {
      display: "flex",
      alignItems: "center",
      gap: 2,
      borderRadius: 999,
      background: "rgba(23,23,23,0.85)",
      padding: "4px",
      border: "1px solid rgba(255,255,255,0.1)",
      backdropFilter: "blur(12px)",
    },
    navBtn: {
      borderRadius: 999,
      padding: "10px",
      color: "#a3a3a3",
      background: "none",
      border: "none",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.2s, color 0.2s",
    },
    counter: {
      minWidth: 44,
      textAlign: "center" as const,
      fontSize: "0.72rem",
      fontFamily: "monospace",
      color: "#737373",
    },
    exploreBtn: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      background: "#fff",
      padding: "12px 22px",
      fontSize: "0.85rem",
      fontWeight: 700,
      color: "#000",
      textDecoration: "none",
      transition: "transform 0.2s, box-shadow 0.2s",
      border: "none",
      cursor: "pointer",
    },
  } as const;

  return (
    <div
      style={S.root}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
    >
      {/* ── Ambient background blur ── */}
      <div style={S.bgLayer}>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={`bg-${activeItem.id}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            style={{ position: "absolute", inset: 0 }}
          >
            <img src={activeItem.imageSrc} alt="" style={S.bgImg} />
            <div style={S.bgGrad} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Main stage ── */}
      <div style={S.stage}>

        {/* ── Draggable rail ── */}
        <motion.div
          style={S.rail}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={onDragEnd}
        >
          {visibleIndices.map((offset) => {
            const absIndex = active + offset;
            const index = wrap(0, count, absIndex);
            const item = items[index];

            if (!loop && (absIndex < 0 || absIndex >= count)) return null;

            const isCenter = offset === 0;
            const dist = Math.abs(offset);

            const xOffset = offset * 290;
            const zOffset = -dist * 160;
            const scale = isCenter ? 1 : 0.82;
            const rotateY = offset * -18;
            const opacity = isCenter ? 1 : Math.max(0.08, 1 - dist * 0.48);
            const blur = isCenter ? 0 : dist * 5;
            const brightness = isCenter ? 1 : 0.45;

            return (
              <motion.div
                key={absIndex}
                style={S.card(isCenter)}
                initial={false}
                animate={{
                  x: xOffset,
                  z: zOffset,
                  scale,
                  rotateY,
                  opacity,
                  filter: `blur(${blur}px) brightness(${brightness})`,
                }}
                transition={(key: string) =>
                  key === "scale" ? TAP_SPRING : BASE_SPRING
                }
                onClick={() => {
                  if (offset !== 0) setActive((p) => p + offset);
                }}
              >
                <img
                  src={item.imageSrc}
                  alt={item.title}
                  style={S.cardImg}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://placehold.co/260x346/1a1a1a/2B9FD8?text=👟";
                  }}
                />
                <div style={S.cardShineTop} />
                <div style={S.cardShineDark} />
                {isCenter && item.badge && (
                  <span style={S.cardBadge}>{item.badge}</span>
                )}
                {isCenter && item.price && (
                  <span style={S.cardPrice}>{item.price}</span>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── Info row ── */}
        <div style={S.info}>
          {/* Text */}
          <div style={S.infoText}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
                transition={{ duration: 0.28, ease: "easeOut" }}
                style={{ display: "flex", flexDirection: "column", gap: 0 }}
              >
                {activeItem.meta && (
                  <span style={S.metaTag}>{activeItem.meta}</span>
                )}
                <h2 style={S.title}>{activeItem.title}</h2>
                {activeItem.description && (
                  <p style={S.desc}>{activeItem.description}</p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div style={S.controls}>
            {/* Prev / counter / Next pill */}
            <div style={S.navPill}>
              <NavButton onClick={handlePrev} label="Previous" style={S.navBtn}>
                <ChevronLeft size={18} />
              </NavButton>
              <span style={S.counter}>
                {activeIndex + 1} / {count}
              </span>
              <NavButton onClick={handleNext} label="Next" style={S.navBtn}>
                <ChevronRight size={18} />
              </NavButton>
            </div>

            {/* Explore link */}
            {activeItem.href && (
              <Link
                to={activeItem.href}
                style={S.exploreBtn}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.05)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                View Product
                <ArrowUpRight size={15} style={{ transition: "transform 0.2s" }} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Dot progress indicators ── */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          zIndex: 20,
        }}
      >
        {items.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => setActive(i)}
            animate={{
              width: i === activeIndex ? 24 : 6,
              background:
                i === activeIndex
                  ? "var(--primary, #2B9FD8)"
                  : "rgba(255,255,255,0.25)",
            }}
            transition={{ duration: 0.3 }}
            style={{
              height: 6,
              borderRadius: 3,
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Small reusable nav button ── */
function NavButton({
  onClick,
  label,
  children,
  style,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        background: hovered ? "rgba(255,255,255,0.1)" : "none",
        color: hovered ? "#fff" : "#a3a3a3",
      }}
    >
      {children}
    </button>
  );
}
