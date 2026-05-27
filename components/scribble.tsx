'use client'

// Culpa — scribble primitives.
// Tiny hand-drawn SVG components with seeded wobble, so every line looks
// ballpoint-on-paper but stays stable across renders. No runtime deps.

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Seeded PRNG + wobbly path helpers
// ─────────────────────────────────────────────────────────────
type Rand = () => number

export function mulberry32(seed: number): Rand {
  let s = (seed | 0) || 1
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Cubic bezier from (x1,y1) to (x2,y2), control points nudged off the line.
function wobblyLineD(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rand: Rand,
  amp = 1.4,
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const px = -dy / len
  const py = dx / len
  const o = () => (rand() - 0.5) * amp * 2
  const oe = () => (rand() - 0.5) * amp * 0.6
  const cp1x = x1 + dx / 3 + px * o()
  const cp1y = y1 + dy / 3 + py * o()
  const cp2x = x1 + (dx * 2) / 3 + px * o()
  const cp2y = y1 + (dy * 2) / 3 + py * o()
  return `M ${x1 + oe()} ${y1 + oe()} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2 + oe()} ${y2 + oe()}`
}

// Rectangle as 4 wobbly lines; corners overshoot for a sketched feel.
// `closed` returns one continuous fillable path.
function wobblyRectD(
  x: number,
  y: number,
  w: number,
  h: number,
  rand: Rand,
  amp = 1.3,
  closed = false,
): string {
  if (closed) {
    const wobble = () => (rand() - 0.5) * amp
    const c = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.hypot(dx, dy) || 1
      const px = -dy / len
      const py = dx / len
      const cp1x = x1 + dx / 3 + px * wobble() * 2
      const cp1y = y1 + dy / 3 + py * wobble() * 2
      const cp2x = x1 + (dx * 2) / 3 + px * wobble() * 2
      const cp2y = y1 + (dy * 2) / 3 + py * wobble() * 2
      return ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`
    }
    let d = `M ${x} ${y}`
    d += c(x, y, x + w, y)
    d += c(x + w, y, x + w, y + h)
    d += c(x + w, y + h, x, y + h)
    d += c(x, y + h, x, y)
    d += ' Z'
    return d
  }
  const ov = () => (rand() - 0.5) * 2.6
  return [
    wobblyLineD(x + ov(), y, x + w + ov(), y, rand, amp),
    wobblyLineD(x + w, y + ov(), x + w, y + h + ov(), rand, amp),
    wobblyLineD(x + w + ov(), y + h, x + ov(), y + h, rand, amp),
    wobblyLineD(x, y + h + ov(), x, y + ov(), rand, amp),
  ].join(' ')
}

// Approx circle via perturbed segments stitched with quadratics.
function wobblyCircleD(
  cx: number,
  cy: number,
  r: number,
  rand: Rand,
  amp = 1.4,
  segments = 10,
): string {
  const pts: [number, number][] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const rr = r + (rand() - 0.5) * amp
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[i + 1]
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const cpx = mx + (rand() - 0.5) * amp
    const cpy = my + (rand() - 0.5) * amp
    d += ` Q ${x1 + (x2 - x1) * 0.3 + (rand() - 0.5) * amp} ${y1 + (y2 - y1) * 0.3 + (rand() - 0.5) * amp}, ${cpx} ${cpy}`
    d += ` T ${x2} ${y2}`
  }
  return d
}

// ─────────────────────────────────────────────────────────────
// useSize — track a container's pixel size so SVG borders can match it
// ─────────────────────────────────────────────────────────────
function useSize<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// ─────────────────────────────────────────────────────────────
// ScribbleBox — rough rectangle border around content
// ─────────────────────────────────────────────────────────────
export function ScribbleBox({
  children,
  seed = 1,
  color = 'var(--ink)',
  strokeWidth = 1.5,
  amp = 1.4,
  double = false,
  fill,
  fillOpacity = 1,
  className = '',
  style = {},
  padding,
}: {
  children?: React.ReactNode
  seed?: number
  color?: string
  strokeWidth?: number
  amp?: number
  double?: boolean
  fill?: string
  fillOpacity?: number
  className?: string
  style?: React.CSSProperties
  padding?: number | string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(ref)
  const rand = useMemo(() => mulberry32(seed), [seed])
  const randFill = useMemo(() => mulberry32(seed + 41), [seed])
  const rand2 = useMemo(() => mulberry32(seed + 99), [seed])
  const inset = strokeWidth + 1
  const d = w && h ? wobblyRectD(inset, inset, w - inset * 2, h - inset * 2, rand, amp) : ''
  const dFill =
    w && h ? wobblyRectD(inset, inset, w - inset * 2, h - inset * 2, randFill, amp, true) : ''
  const d2 =
    double && w && h
      ? wobblyRectD(inset + 0.5, inset + 0.5, w - inset * 2, h - inset * 2, rand2, amp * 0.9)
      : ''

  return (
    <div ref={ref} className={className} style={{ position: 'relative', padding, ...style }}>
      {w > 0 && (
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}
          aria-hidden="true"
        >
          {fill && <path d={dFill} fill={fill} stroke="none" opacity={fillOpacity} />}
          <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          {double && (
            <path d={d2} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
          )}
        </svg>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleUnderline — wavy underline that auto-fills its container width
// ─────────────────────────────────────────────────────────────
export function ScribbleUnderline({
  seed = 1,
  color = 'var(--ink)',
  strokeWidth = 2,
  amp = 2,
  double = false,
  style,
}: {
  seed?: number
  color?: string
  strokeWidth?: number
  amp?: number
  double?: boolean
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const { w } = useSize(ref)
  const rand = useMemo(() => mulberry32(seed), [seed])
  const rand2 = useMemo(() => mulberry32(seed + 7), [seed])
  const h = double ? 14 : 10
  const y = double ? 4 : 5
  const d = w ? wobblyLineD(2, y, w - 2, y, rand, amp) : ''
  const d2 = double && w ? wobblyLineD(4, y + 5, w - 4, y + 5, rand2, amp * 0.8) : ''
  return (
    <span ref={ref} style={{ display: 'block', width: '100%', height: h, position: 'relative', ...style }}>
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          {double && <path d={d2} fill="none" stroke={color} strokeWidth={strokeWidth * 0.8} strokeLinecap="round" opacity="0.6" />}
        </svg>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleCircle — a drawn-on circle wrapping its children (avatar, badge)
// ─────────────────────────────────────────────────────────────
export function ScribbleCircle({
  size = 40,
  seed = 3,
  color = 'var(--ink)',
  strokeWidth = 2,
  amp = 2,
  style,
  children,
}: {
  size?: number
  seed?: number
  color?: string
  strokeWidth?: number
  amp?: number
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const rand = useMemo(() => mulberry32(seed), [seed])
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - strokeWidth - 1
  const d = wobblyCircleD(cx, cy, r, rand, amp, 12)
  return (
    <span
      style={{
        display: 'inline-flex',
        position: 'relative',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      </svg>
      <span style={{ position: 'relative' }}>{children}</span>
    </span>
  )
}

// ScribbleCircleFill — an absolutely-positioned scribbled ring that measures
// itself, used to circle existing content (amounts, the selected payer).
export function ScribbleCircleFill({
  seed = 3,
  color = 'var(--red)',
  strokeWidth = 2,
  amp = 2.4,
}: {
  seed?: number
  color?: string
  strokeWidth?: number
  amp?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const { w, h } = useSize(ref)
  const rand = useMemo(() => mulberry32(seed), [seed])
  const cx = w / 2
  const cy = h / 2
  const rx = w / 2 - strokeWidth - 1
  const ry = h / 2 - strokeWidth - 1
  const pts: [number, number][] = []
  const segs = 14
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2
    const ja = (((rand() - 0.5) * amp) / Math.max(rx, ry)) * 2
    pts.push([cx + Math.cos(a + ja) * (rx + (rand() - 0.5) * amp), cy + Math.sin(a + ja) * (ry + (rand() - 0.5) * amp)])
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`
  return (
    <span ref={ref} style={{ position: 'absolute', inset: 0, display: 'block', pointerEvents: 'none' }}>
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleArrow — hand-drawn arrow, horizontal-ish
// ─────────────────────────────────────────────────────────────
export function ScribbleArrow({
  width = 30,
  height = 14,
  seed = 4,
  color = 'var(--ink)',
  strokeWidth = 1.6,
  style,
}: {
  width?: number
  height?: number
  seed?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}) {
  const rand = useMemo(() => mulberry32(seed), [seed])
  const y = height / 2
  const tail = wobblyLineD(3, y, width - 4, y, rand, 1)
  const head1 = wobblyLineD(width - 4, y, width - 10, y - 5, rand, 0.6)
  const head2 = wobblyLineD(width - 4, y, width - 10, y + 5, rand, 0.6)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', ...style }} aria-hidden="true">
      <path d={tail} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={head1} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={head2} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

// Curved annotation arrow, for pointing at things off to the side.
export function ScribbleCurvedArrow({
  width = 80,
  height = 60,
  seed = 9,
  color = 'var(--pencil)',
  strokeWidth = 1.6,
  style,
  dir = 'down-left',
}: {
  width?: number
  height?: number
  seed?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
  dir?: 'down-left' | 'down-right'
}) {
  // A touch of seeded jitter on the control points so the curve looks drawn.
  const rand = useMemo(() => mulberry32(seed), [seed])
  const j = () => (rand() - 0.5) * 4
  let d: string
  let hx: number
  let hy: number
  let hdx1: number
  let hdy1: number
  let hdx2: number
  let hdy2: number
  if (dir === 'down-left') {
    d = `M ${width - 5} 5 C ${width - 5 + j()} ${height * 0.4 + j()}, ${width * 0.5 + j()} ${height * 0.7 + j()}, 8 ${height - 6}`
    hx = 8
    hy = height - 6
    hdx1 = 14
    hdy1 = height - 14
    hdx2 = 14
    hdy2 = height - 2
  } else {
    d = `M 5 5 C ${5 + j()} ${height * 0.4 + j()}, ${width * 0.5 + j()} ${height * 0.7 + j()}, ${width - 8} ${height - 6}`
    hx = width - 8
    hy = height - 6
    hdx1 = width - 14
    hdy1 = height - 14
    hdx2 = width - 14
    hdy2 = height - 2
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', ...style }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={`M ${hx} ${hy} L ${hdx1} ${hdy1}`} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <path d={`M ${hx} ${hy} L ${hdx2} ${hdy2}`} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleCheckbox — wobbly square + optional tick
// ─────────────────────────────────────────────────────────────
export function ScribbleCheckbox({
  checked,
  size = 26,
  seed = 5,
  color = 'var(--ink)',
  tickColor = 'var(--red)',
  strokeWidth = 2,
}: {
  checked?: boolean
  size?: number
  seed?: number
  color?: string
  tickColor?: string
  strokeWidth?: number
}) {
  const rand = useMemo(() => mulberry32(seed), [seed])
  const tickRand = useMemo(() => mulberry32(seed + 31), [seed])
  const inset = 2
  const w = size - inset * 2
  const h = size - inset * 2
  const rect = wobblyRectD(inset, inset, w, h, rand, 1.5)
  const t1 = wobblyLineD(size * 0.22, size * 0.5, size * 0.42, size * 0.72, tickRand, 0.7)
  const t2 = wobblyLineD(size * 0.42, size * 0.72, size * 0.78, size * 0.28, tickRand, 0.7)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }} aria-hidden="true">
      <path d={rect} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      {checked && (
        <>
          <path d={t1} stroke={tickColor} strokeWidth={strokeWidth + 0.8} strokeLinecap="round" fill="none" />
          <path d={t2} stroke={tickColor} strokeWidth={strokeWidth + 0.8} strokeLinecap="round" fill="none" />
        </>
      )}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// Highlighter — a marker swipe behind content
// ─────────────────────────────────────────────────────────────
export function Highlighter({
  seed = 8,
  color = 'var(--highlighter)',
  height = 18,
  tilt = -1.5,
  opacity = 0.85,
  style,
}: {
  seed?: number
  color?: string
  height?: number
  tilt?: number
  opacity?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const { w } = useSize(ref)
  const rand = useMemo(() => mulberry32(seed), [seed])
  const y = height / 2
  const path = w ? wobblyLineD(6, y, w - 6, y, rand, 1.2) : ''
  return (
    <span ref={ref} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `rotate(${tilt}deg)`, ...style }}>
      {w > 0 && (
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
          <path d={path} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={height - 2} strokeLinecap="round" style={{ mixBlendMode: 'multiply' }} />
        </svg>
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleDivider — a wavy horizontal rule
// ─────────────────────────────────────────────────────────────
export function ScribbleDivider({
  seed = 1,
  color = 'var(--pencil-soft)',
  strokeWidth = 1.2,
  amp = 1.6,
  height = 10,
  style,
}: {
  seed?: number
  color?: string
  strokeWidth?: number
  amp?: number
  height?: number
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { w } = useSize(ref)
  const rand = useMemo(() => mulberry32(seed), [seed])
  const d = w ? wobblyLineD(2, height / 2, w - 2, height / 2, rand, amp) : ''
  return (
    <div ref={ref} style={{ width: '100%', height, ...style }}>
      {w > 0 && (
        <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} style={{ overflow: 'visible' }} aria-hidden="true">
          <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleStar — the "you" marker (3 crossing strokes)
// ─────────────────────────────────────────────────────────────
export function ScribbleStar({
  size = 18,
  color = 'var(--red)',
  seed = 11,
  strokeWidth = 2,
}: {
  size?: number
  color?: string
  seed?: number
  strokeWidth?: number
}) {
  const rand = useMemo(() => mulberry32(seed), [seed])
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 1
  const lines: string[] = []
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI + (rand() - 0.5) * 0.2
    const x1 = cx - Math.cos(a) * r
    const y1 = cy - Math.sin(a) * r
    const x2 = cx + Math.cos(a) * r
    const y2 = cy + Math.sin(a) * r
    lines.push(wobblyLineD(x1, y1, x2, y2, rand, 0.6))
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ overflow: 'visible' }}>
      {lines.map((d, i) => (
        <path key={i} d={d} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      ))}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribblePlus — small + glyph
// ─────────────────────────────────────────────────────────────
export function ScribblePlus({
  size = 14,
  color = 'currentColor',
  seed = 17,
  strokeWidth = 2,
}: {
  size?: number
  color?: string
  seed?: number
  strokeWidth?: number
}) {
  const rand = useMemo(() => mulberry32(seed), [seed])
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 1
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ overflow: 'visible' }}>
      <path d={wobblyLineD(cx - r, cy, cx + r, cy, rand, 0.4)} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
      <path d={wobblyLineD(cx, cy - r, cx, cy + r, rand, 0.4)} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleAvatar — a drawn circle with the participant's initial
// ─────────────────────────────────────────────────────────────
export function ScribbleAvatar({
  name,
  size = 36,
  seed = 1,
  color = 'var(--ink)',
  strokeWidth = 1.8,
  you = false,
}: {
  name: string
  size?: number
  seed?: number
  color?: string
  strokeWidth?: number
  you?: boolean
}) {
  const initial = (name || '?').trim().charAt(0).toUpperCase()
  // Mix the seed by name so each person keeps a stable, distinct wobble.
  const nseed = (seed + (name?.charCodeAt(0) || 0) * 7) % 9999
  return (
    <span style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      {you && (
        <Highlighter
          seed={nseed + 3}
          tilt={-3}
          height={Math.round(size * 0.45)}
          style={{ top: '50%', transform: 'translateY(-50%) rotate(-3deg)', left: -2, right: -2 }}
        />
      )}
      <ScribbleCircle size={size} seed={nseed} color={color} strokeWidth={strokeWidth} amp={1.4}>
        <span style={{ fontFamily: 'var(--font-hand), cursive', fontWeight: 700, fontSize: Math.round(size * 0.55), color: 'var(--ink)' }}>{initial}</span>
      </ScribbleCircle>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// ScribbleButton — a button whose border is a sketched rectangle.
// `ink`/`red-fill` paint a filled wobbly rect; `ghost`/`red` are outline only.
// Renders as a <button>, or as a child element (e.g. a <Link>) via asChild.
// ─────────────────────────────────────────────────────────────
type ScribbleBtnVariant = 'ghost' | 'ink' | 'red' | 'red-fill'

export function ScribbleButton({
  children,
  variant = 'ghost',
  seed = 1,
  disabled = false,
  className = '',
  style,
  fontSize = 18,
  padding = '12px 20px',
  asChild = false,
  ...props
}: {
  children?: React.ReactNode
  variant?: ScribbleBtnVariant
  seed?: number
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  fontSize?: number
  padding?: string
  asChild?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLElement>(null)
  const { w, h } = useSize(ref)
  const isFilled = variant === 'ink'
  const isRedFill = variant === 'red-fill'
  const color = variant === 'red' || isRedFill ? 'var(--red)' : 'var(--ink)'
  const fillColor = isFilled ? 'var(--ink)' : isRedFill ? 'var(--red)' : null
  const textColor = isFilled || isRedFill ? 'var(--paper)' : color
  const inset = 3
  const dStroke = w && h ? wobblyRectD(inset, inset, w - inset * 2, h - inset * 2, mulberry32(seed), 1.4) : ''
  const dFill = w && h ? wobblyRectD(inset, inset, w - inset * 2, h - inset * 2, mulberry32(seed + 71), 1.1, true) : ''

  const sharedStyle: React.CSSProperties = {
    position: 'relative',
    padding,
    background: 'transparent',
    border: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: textColor,
    fontFamily: 'var(--font-print), cursive',
    fontSize,
    opacity: disabled ? 0.45 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
    lineHeight: 1.1,
    textDecoration: 'none',
    ...style,
  }

  const border = w > 0 && (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      {fillColor && <path d={dFill} fill={fillColor} stroke="none" />}
      <path d={dStroke} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
  const inner = (
    <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{children}</span>
  )

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{
      className?: string
      style?: React.CSSProperties
      children?: React.ReactNode
    }>
    return React.cloneElement(child, {
      ref,
      className: [child.props.className, className].filter(Boolean).join(' '),
      style: { ...sharedStyle, ...child.props.style },
      children: (
        <>
          {border}
          <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {child.props.children}
          </span>
        </>
      ),
    } as React.Attributes)
  }

  return (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      disabled={disabled}
      className={className}
      style={sharedStyle}
      {...props}
    >
      {border}
      {inner}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Money — Kalam numerals; integer cents in, formatted figure out.
// ─────────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = { EUR: '€', USD: '$', GBP: '£', JPY: '¥' }

export function currencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `
}

export function Money({
  amount,
  currency = 'EUR',
  size = 'md',
  tone,
  className = '',
}: {
  amount: number
  currency?: string
  size?: 'sm' | 'md' | 'lg'
  tone?: 'owed' | 'credit'
  className?: string
}) {
  const sym = currencySymbol(currency)
  const abs = Math.abs(amount)
  const whole = Math.floor(abs)
  const cents = Math.round((abs - whole) * 100)
    .toString()
    .padStart(2, '0')
  const toneClass = tone === 'owed' ? 'owed' : tone === 'credit' ? 'credit' : ''
  const sizeClass = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : ''
  return (
    <span className={`c-money ${sizeClass} ${toneClass} ${className}`.trim()}>
      <span className="sym">{sym}</span>
      {whole}
      <span className="cents">.{cents}</span>
    </span>
  )
}
