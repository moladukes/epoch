import { useEffect, useRef } from "react"
import { useEngine } from "./use-engine"

const KINDS = [
  { value: "spectrum", label: "Spectrum" },
  { value: "scope", label: "Oscilloscope" },
  { value: "off", label: "Off" },
]

const POINTS = 256

type Look = {
  mode: string
  bars: number
  color: string
  mid: string
  hot: string
  dim: string
}

function readLook(canvas: HTMLCanvasElement): Look {
  const css = getComputedStyle(canvas)
  const read = (name: string, fallback: string) =>
    css.getPropertyValue(name).trim() || fallback
  const color = read("--viz-color", "#888")
  return {
    mode: read("--viz-mode", "bars"),
    bars: Number(read("--viz-bars", "24")) || 24,
    color,
    mid: read("--viz-mid", color),
    hot: read("--viz-hot", color),
    dim: read("--viz-dim", "transparent"),
  }
}

function pill(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  g.beginPath()
  if (g.roundRect) g.roundRect(x, y, w, h, r)
  else g.rect(x, y, w, h)
  g.fill()
}

function trace(
  g: CanvasRenderingContext2D,
  values: Float32Array,
  w: number,
  h: number
) {
  const step = w / (values.length - 1)
  const y = (i: number) => h - (values[i] ?? 0) * h * 0.92
  g.beginPath()
  g.moveTo(0, h)
  g.lineTo(0, y(0))
  for (let i = 1; i < values.length; i++) {
    const x = i * step
    g.quadraticCurveTo(x - step, y(i - 1), x - step / 2, (y(i - 1) + y(i)) / 2)
  }
  g.lineTo(w, y(values.length - 1))
  g.lineTo(w, h)
  g.closePath()
}

function at(scope: Float32Array, t: number) {
  const index = Math.min(POINTS - 1, Math.max(0, t * (POINTS - 1)))
  const low = Math.floor(index)
  const a = scope[low] ?? 0
  const b = scope[Math.min(POINTS - 1, low + 1)] ?? a
  return a + (b - a) * (index - low)
}

function line(
  g: CanvasRenderingContext2D,
  scope: Float32Array,
  w: number,
  mid: number,
  reach: number
) {
  const steps = 96
  const y = (i: number) => mid - at(scope, i / steps) * reach
  g.beginPath()
  g.moveTo(0, y(0))
  for (let i = 1; i <= steps; i++) {
    const x = (i / steps) * w
    const before = ((i - 1) / steps) * w
    g.quadraticCurveTo(before, y(i - 1), (before + x) / 2, (y(i - 1) + y(i)) / 2)
  }
  g.lineTo(w, y(steps))
}

function paintScope(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  look: Look,
  scope: Float32Array
) {
  g.clearRect(0, 0, w, h)

  if (look.mode === "blocks") {
    const unit = Math.max(2, Math.round(2 * dpr))
    const columns = Math.floor(w / unit)
    const rows = Math.floor(h / unit)
    const row = (i: number) =>
      Math.round((0.5 - at(scope, i / (columns - 1)) * 0.48) * (rows - 1))
    let last = row(0)
    for (let i = 0; i < columns; i++) {
      const next = row(i)
      const top = Math.min(last, next)
      const size = Math.abs(next - last) + 1
      const swing = Math.abs(next - (rows - 1) / 2) / (rows / 2)
      g.fillStyle = swing > 0.66 ? look.hot : swing > 0.36 ? look.mid : look.color
      g.fillRect(i * unit, top * unit, unit, size * unit)
      last = next
    }
    return
  }

  if (look.mode === "dots") {
    const columns = look.bars
    const slot = w / columns
    const rows = Math.max(1, Math.floor(h / slot))
    const size = slot * 0.62
    const pad = (slot - size) / 2
    const base = h - rows * slot
    const row = (i: number) =>
      Math.round((0.5 - at(scope, i / (columns - 1)) * 0.5) * (rows - 1))
    let last = row(0)
    for (let i = 0; i < columns; i++) {
      const next = row(i)
      const from = Math.min(last, next)
      const to = Math.max(last, next)
      for (let r = 0; r < rows; r++) {
        g.fillStyle = r >= from && r <= to ? look.color : look.dim
        g.fillRect(i * slot + pad, base + r * slot + pad, size, size)
      }
      last = next
    }
    return
  }

  if (look.mode === "wave") {
    const mid = h * 0.42
    line(g, scope, w, mid, h * 0.36)
    g.lineTo(w, h)
    g.lineTo(0, h)
    g.closePath()
    g.fillStyle = look.color
    g.fill()
    line(g, scope, w, mid, h * 0.36)
    g.globalAlpha = 0.7
    g.strokeStyle = look.mid
    g.lineWidth = 1.5 * dpr
    g.stroke()
    g.globalAlpha = 1
    return
  }

  g.lineJoin = "round"
  g.lineCap = "round"
  line(g, scope, w, h / 2, h * 0.46)
  if (look.mode === "lines") {
    g.strokeStyle = look.color
    g.lineWidth = 1.5 * dpr
    g.stroke()
    return
  }
  const stroke = g.createLinearGradient(0, 0, w, 0)
  stroke.addColorStop(0, look.color)
  stroke.addColorStop(0.5, look.hot)
  stroke.addColorStop(1, look.color)
  g.shadowColor = look.mid
  g.shadowBlur = 8 * dpr
  g.strokeStyle = stroke
  g.lineWidth = 2 * dpr
  g.stroke()
  g.shadowBlur = 0
}

function paint(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  look: Look,
  levels: Float32Array,
  peaks: Float32Array
) {
  g.clearRect(0, 0, w, h)
  const count = levels.length

  if (look.mode === "wave") {
    g.globalAlpha = 0.28
    g.fillStyle = look.mid
    trace(g, peaks, w, h)
    g.fill()
    g.globalAlpha = 1
    g.fillStyle = look.color
    trace(g, levels, w, h)
    g.fill()
    return
  }

  const slot = w / count
  for (let i = 0; i < count; i++) {
    const level = levels[i] ?? 0
    const x = i * slot

    if (look.mode === "blocks") {
      const gap = Math.max(1, Math.round(dpr))
      const block = 2 * gap
      const rows = Math.floor(h / (block + gap))
      const lit = Math.round(level * rows)
      for (let row = 0; row < lit; row++) {
        const rise = row / rows
        g.fillStyle = rise > 0.8 ? look.hot : rise > 0.55 ? look.mid : look.color
        g.fillRect(x, h - (row + 1) * (block + gap) + gap, slot - gap, block)
      }
      const cap = Math.round((peaks[i] ?? 0) * rows)
      if (cap > 0) {
        g.fillStyle = look.dim
        g.fillRect(x, h - cap * (block + gap), slot - gap, gap)
      }
    } else if (look.mode === "dots") {
      const rows = Math.max(1, Math.floor(h / slot))
      const lit = Math.round(level * rows)
      const size = slot * 0.62
      for (let row = 0; row < rows; row++) {
        g.fillStyle = row < lit ? look.color : look.dim
        g.fillRect(
          x + (slot - size) / 2,
          h - (row + 1) * slot + (slot - size) / 2,
          size,
          size
        )
      }
    } else if (look.mode === "lines") {
      const width = Math.max(2 * dpr, slot * 0.4)
      const height = Math.max(width, level * h)
      g.fillStyle = look.color
      pill(g, x + (slot - width) / 2, (h - height) / 2, width, height, width / 2)
    } else {
      const width = slot * 0.72
      const height = Math.max(dpr, level * h)
      const fill = g.createLinearGradient(0, h, 0, 0)
      fill.addColorStop(0, look.color)
      fill.addColorStop(0.6, look.mid)
      fill.addColorStop(1, look.hot)
      g.fillStyle = fill
      pill(g, x + (slot - width) / 2, h - height, width, height, width / 3)
    }
  }
}

function Visualizer({ kind }: { kind: string }) {
  const engine = useEngine()
  const ref = useRef<HTMLCanvasElement>(null)
  const mode = useRef(kind)
  const redraw = useRef(() => {})

  useEffect(() => {
    mode.current = kind
    redraw.current()
  }, [kind])

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext("2d")
    if (!canvas || !g) return

    const bins = new Uint8Array(1024)
    const samples = new Uint8Array(2048).fill(128)
    const scope = new Float32Array(POINTS)
    const calm = matchMedia("(prefers-reduced-motion: reduce)")
    const scheme = matchMedia("(prefers-color-scheme: dark)")
    const root = canvas.closest<HTMLElement>("[data-era]")
    const player = canvas.closest<HTMLElement>(".player")
    let look = readLook(canvas)
    let levels = new Float32Array(look.bars)
    let peaks = new Float32Array(look.bars)
    let energy = -1
    let envelope = 0
    let frames = 0
    let raf = 0

    const restyle = () => {
      look = readLook(canvas)
      if (levels.length !== look.bars) {
        levels = new Float32Array(look.bars)
        peaks = new Float32Array(look.bars)
      }
      wake()
    }

    const resize = () => {
      const dpr = devicePixelRatio || 1
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      wake()
    }

    const frame = () => {
      raf = 0
      const live = engine.spectrum(bins)
      const count = levels.length
      let total = 0
      for (let i = 0; i < count; i++) {
        const from = Math.floor(2 * 380 ** (i / count))
        const to = Math.max(from + 1, Math.floor(2 * 380 ** ((i + 1) / count)))
        let sum = 0
        for (let bin = from; bin < to; bin++) sum += bins[bin] ?? 0
        const tilt = 0.75 + (i / count) * 0.7
        const target = live ? Math.min(1, (sum / (to - from) / 255) * tilt) : 0
        const level = Math.max(target, (levels[i] ?? 0) - 0.035)
        levels[i] = level
        peaks[i] = Math.max(level, (peaks[i] ?? 0) - 0.006)
        total += level
      }

      let moving = false
      if (mode.current === "scope") {
        const heard = engine.waveform(samples)
        let start = 0
        if (heard) {
          for (let i = 1; i < 1024; i++) {
            if ((samples[i - 1] ?? 128) < 128 && (samples[i] ?? 128) >= 128) {
              start = i
              break
            }
          }
        }
        let power = 0
        for (let i = start; i < start + 1024; i++) {
          const sample = ((samples[i] ?? 128) - 128) / 128
          power += sample * sample
        }
        const rms = Math.sqrt(power / 1024)
        envelope = envelope ? envelope * 0.92 + rms * 0.08 : rms
        const gain = Math.min(14, 0.55 / Math.max(envelope, 0.01))
        for (let i = 0; i < POINTS; i++) {
          const sample = samples[start + Math.floor((i / POINTS) * 1024)] ?? 128
          const target = heard
            ? Math.max(-1, Math.min(1, ((sample - 128) / 128) * gain))
            : 0
          const value = (scope[i] ?? 0) * 0.45 + target * 0.55
          scope[i] = Math.abs(value) < 0.004 ? 0 : value
          if (scope[i] !== 0) moving = true
        }
      }

      if (!calm.matches || frames++ % 8 === 0) {
        const dpr = devicePixelRatio || 1
        if (mode.current === "off") {
          g.clearRect(0, 0, canvas.width, canvas.height)
        } else if (mode.current === "scope") {
          paintScope(g, canvas.width, canvas.height, dpr, look, scope)
        } else {
          paint(g, canvas.width, canvas.height, dpr, look, levels, peaks)
        }
        const next = Math.round((total / count) * 50) / 50
        if (next !== energy) {
          energy = next
          player?.style.setProperty("--energy", String(next))
        }
      }

      if (live || moving || peaks.some((peak) => peak > 0.001)) wake()
    }

    function wake() {
      raf ||= requestAnimationFrame(frame)
    }

    const resizer = new ResizeObserver(resize)
    resizer.observe(canvas)
    const watcher = new MutationObserver(restyle)
    if (root) {
      watcher.observe(root, { attributes: true, attributeFilter: ["data-era"] })
    }
    scheme.addEventListener("change", restyle)
    const unsubscribe = engine.subscribe(wake)
    redraw.current = wake
    resize()

    return () => {
      cancelAnimationFrame(raf)
      resizer.disconnect()
      watcher.disconnect()
      scheme.removeEventListener("change", restyle)
      unsubscribe()
    }
  }, [engine])

  return <canvas ref={ref} className="visualizer" aria-hidden="true" />
}

export { KINDS, Visualizer }
