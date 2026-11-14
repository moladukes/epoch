import { BANDS, CUSTOM, presets } from "./presets"
import { renderSong, songDuration, songs } from "./synth"

type Status = "stopped" | "playing" | "paused"

type Track = {
  id: string
  title: string
  artist: string
  duration: number
  kbps: number
  khz: number
  channels: number
  preset?: string
  added?: boolean
}

type PlayerState = {
  tracks: Track[]
  current: string
  status: Status
  loading: boolean
  position: number
  volume: number
  balance: number
  preamp: number
  bands: number[]
  preset: string
  eqOn: boolean
  autoEq: boolean
  muted: boolean
  shuffle: boolean
  repeat: boolean
}

type Graph = {
  ctx: AudioContext
  input: GainNode
  filters: BiquadFilterNode[]
  analyser: AnalyserNode
  panner: StereoPannerNode
  volume: GainNode
}

const SONG_PRESETS: Record<string, string> = {
  "corner-store-cipher": "Loudness",
  "six-four-sunday": "Bass boost",
  "two-way-pager": "Vocal",
  "candy-paint": "Flat",
  "rewind-selecta": "Treble boost",
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

function createEngine() {
  const builtIn: Track[] = songs.map((song) => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    duration: Math.round(songDuration(song)),
    kbps: 1411,
    khz: 44,
    channels: 2,
    preset: SONG_PRESETS[song.id],
  }))

  let state: PlayerState = {
    tracks: builtIn,
    current: songs[0]!.id,
    status: "stopped",
    loading: false,
    position: 0,
    volume: 70,
    balance: 0,
    preamp: 0,
    bands: [...presets.Flat!],
    preset: "Flat",
    eqOn: true,
    autoEq: false,
    muted: false,
    shuffle: false,
    repeat: true,
  }

  const listeners = new Set<() => void>()
  const buffers = new Map<string, Promise<AudioBuffer>>()
  let graph: Graph | null = null
  let source: AudioBufferSourceNode | null = null
  let running = false
  let offset = 0
  let startedAt = 0
  let token = 0
  let ticker: ReturnType<typeof setInterval> | undefined

  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch }
    for (const listener of listeners) listener()
  }

  const now = () => (graph ? graph.ctx.currentTime : performance.now() / 1000)
  const track = () =>
    state.tracks.find((item) => item.id === state.current) ?? state.tracks[0]!
  const position = () =>
    running ? Math.min(offset + now() - startedAt, track().duration) : offset

  const applyTone = () => {
    if (!graph) return
    const at = graph.ctx.currentTime
    const on = state.eqOn
    graph.input.gain.setTargetAtTime(
      on ? 10 ** (state.preamp / 20) : 1,
      at,
      0.02
    )
    graph.filters.forEach((filter, index) => {
      filter.gain.setTargetAtTime(on ? (state.bands[index] ?? 0) : 0, at, 0.02)
    })
    graph.panner.pan.setTargetAtTime(state.balance / 100, at, 0.02)
    graph.volume.gain.setTargetAtTime(
      state.muted ? 0 : (state.volume / 100) ** 2,
      at,
      0.02
    )
  }

  const ensureGraph = () => {
    if (graph || typeof AudioContext === "undefined") return graph
    const ctx = new AudioContext()
    const input = ctx.createGain()
    const filters = BANDS.map((hz, index) => {
      const filter = ctx.createBiquadFilter()
      filter.type =
        index === 0
          ? "lowshelf"
          : index === BANDS.length - 1
            ? "highshelf"
            : "peaking"
      filter.frequency.value = hz
      filter.Q.value = 1.4
      return filter
    })
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.78
    const panner = ctx.createStereoPanner()
    const volume = ctx.createGain()
    let node: AudioNode = input
    for (const filter of filters) node = node.connect(filter)
    node.connect(analyser)
    node.connect(panner).connect(volume).connect(ctx.destination)
    graph = { ctx, input, filters, analyser, panner, volume }
    applyTone()
    return graph
  }

  const bufferFor = (id: string) => {
    let buffer = buffers.get(id)
    if (!buffer) {
      const song = songs.find((item) => item.id === id)
      if (!song) return Promise.reject(new Error(`No audio for ${id}`))
      buffer = renderSong(song)
      buffers.set(id, buffer)
    }
    return buffer
  }

  const warm = () => {
    if (typeof OfflineAudioContext === "undefined") return
    const index = state.tracks.findIndex((item) => item.id === state.current)
    const upcoming = state.tracks[(index + 1) % state.tracks.length]
    void bufferFor(state.current)
      .then(() => upcoming && bufferFor(upcoming.id))
      .catch(() => {})
  }

  const stopSource = () => {
    if (!source) return
    source.onended = null
    try {
      source.stop()
    } catch {
      // A source that never started throws on stop.
    }
    source.disconnect()
    source = null
  }

  const tick = () => {
    const at = position()
    if (at >= track().duration - 0.05) ended()
    else if (Math.floor(at) !== Math.floor(state.position)) set({ position: at })
  }

  const halt = () => {
    token++
    stopSource()
    running = false
    clearInterval(ticker)
    ticker = undefined
  }

  const start = async () => {
    const mine = ++token
    stopSource()
    running = false
    const audio = ensureGraph()
    if (audio) {
      set({ loading: true })
      try {
        await audio.ctx.resume()
        const buffer = await bufferFor(state.current)
        if (mine !== token) return
        source = audio.ctx.createBufferSource()
        source.buffer = buffer
        source.connect(audio.input)
        source.start(0, Math.min(offset, buffer.duration - 0.01))
      } catch {
        if (mine === token) {
          halt()
          set({ status: "stopped", loading: false })
        }
        return
      }
      set({ loading: false })
      warm()
    }
    startedAt = now()
    running = true
    ticker ??= setInterval(tick, 200)
  }

  const play = () => {
    if (state.status === "playing") return
    set({ status: "playing" })
    void start()
  }

  const pause = () => {
    if (state.status !== "playing") return
    offset = position()
    halt()
    set({ status: "paused", position: offset, loading: false })
  }

  const stop = () => {
    halt()
    offset = 0
    set({ status: "stopped", position: 0, loading: false })
  }

  const toggle = () => (state.status === "playing" ? pause() : play())

  const seek = (seconds: number) => {
    offset = clamp(seconds, 0, track().duration)
    set({ position: offset })
    if (state.status === "playing") void start()
  }

  const applyAuto = () => {
    const name = track().preset
    const bands = name ? presets[name] : undefined
    if (!state.autoEq || !name || !bands) return
    set({ bands: [...bands], preset: name })
    applyTone()
  }

  const select = (id: string, options: { play?: boolean } = {}) => {
    if (!state.tracks.some((item) => item.id === id)) return
    offset = 0
    set({ current: id, position: 0 })
    applyAuto()
    if (options.play && state.status !== "playing") set({ status: "playing" })
    if (state.status === "playing") void start()
  }

  const neighbour = (step: 1 | -1) => {
    const { tracks } = state
    const index = tracks.findIndex((item) => item.id === state.current)
    if (state.shuffle && tracks.length > 1) {
      let pick = index
      while (pick === index) pick = Math.floor(Math.random() * tracks.length)
      return tracks[pick]!
    }
    return tracks[(index + step + tracks.length) % tracks.length]!
  }

  const next = () => select(neighbour(1).id)

  const previous = () => {
    if (position() > 3) seek(0)
    else select(neighbour(-1).id)
  }

  function ended() {
    const last = state.tracks.at(-1)?.id === state.current
    if (last && !state.repeat && !state.shuffle) stop()
    else next()
  }

  const setBands = (bands: number[], preset = CUSTOM) => {
    set({ bands: bands.map((gain) => clamp(Math.round(gain), -12, 12)), preset })
    applyTone()
  }

  const engine = {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getState: () => state,
    warm,
    play,
    pause,
    stop,
    toggle,
    seek,
    select,
    next,
    previous,
    skip: (seconds: number) => seek(position() + seconds),
    setVolume: (volume: number) => {
      set({ volume: clamp(volume, 0, 100), muted: false })
      applyTone()
    },
    setMuted: (muted: boolean) => {
      set({ muted })
      applyTone()
    },
    setBalance: (balance: number) => {
      set({ balance: clamp(balance, -100, 100) })
      applyTone()
    },
    setPreamp: (preamp: number) => {
      set({ preamp: clamp(preamp, -12, 12) })
      applyTone()
    },
    setBand: (index: number, gain: number) =>
      setBands(state.bands.map((value, i) => (i === index ? gain : value))),
    setBands,
    setPreset: (name: string) => {
      const bands = presets[name]
      if (bands) setBands(bands, name)
    },
    setEqOn: (eqOn: boolean) => {
      set({ eqOn })
      applyTone()
    },
    setAutoEq: (autoEq: boolean) => {
      set({ autoEq })
      applyAuto()
    },
    setShuffle: (shuffle: boolean) => set({ shuffle }),
    setRepeat: (repeat: boolean) => set({ repeat }),
    spectrum: (out: Uint8Array<ArrayBuffer>) => {
      if (!graph || !running) return false
      graph.analyser.getByteFrequencyData(out)
      return true
    },
    waveform: (out: Uint8Array<ArrayBuffer>) => {
      if (!graph || !running) return false
      graph.analyser.getByteTimeDomainData(out)
      return true
    },
    addFiles: async (files: File[]) => {
      const audio = ensureGraph()
      if (!audio) return 0
      const added: Track[] = []
      for (const file of files) {
        try {
          const buffer = await audio.ctx.decodeAudioData(
            await file.arrayBuffer()
          )
          const id = `file-${crypto.randomUUID()}`
          buffers.set(id, Promise.resolve(buffer))
          added.push({
            id,
            title: file.name.replace(/\.[^.]+$/, ""),
            artist: "Your file",
            duration: Math.round(buffer.duration),
            kbps: Math.round((file.size * 8) / buffer.duration / 1000),
            khz: Math.round(buffer.sampleRate / 1000),
            channels: buffer.numberOfChannels,
            added: true,
          })
        } catch {
          // A file the browser can't decode is skipped.
        }
      }
      if (added.length > 0) set({ tracks: [...state.tracks, ...added] })
      return added.length
    },
    removeTrack: (id: string) => {
      const index = state.tracks.findIndex((item) => item.id === id)
      if (index < 0 || state.tracks.length < 2) return
      const tracks = state.tracks.filter((item) => item.id !== id)
      if (state.tracks[index]!.added) buffers.delete(id)
      if (id !== state.current) return set({ tracks })
      const playing = state.status === "playing"
      halt()
      offset = 0
      const follow = tracks[Math.min(index, tracks.length - 1)]!
      set({ tracks, current: follow.id, position: 0, loading: false })
      applyAuto()
      if (playing) void start()
    },
    sortTracks: (by: "title" | "duration") => {
      const tracks = [...state.tracks].sort((a, b) =>
        by === "title" ? a.title.localeCompare(b.title) : a.duration - b.duration
      )
      set({ tracks })
    },
    reverseTracks: () => set({ tracks: [...state.tracks].reverse() }),
    moveTrack: (id: string, step: 1 | -1) => {
      const from = state.tracks.findIndex((item) => item.id === id)
      const to = from + step
      if (from < 0 || to < 0 || to >= state.tracks.length) return
      const tracks = [...state.tracks]
      const [moved] = tracks.splice(from, 1)
      tracks.splice(to, 0, moved!)
      set({ tracks })
    },
    resetTracks: () => {
      const keep = builtIn.some((item) => item.id === state.current)
      for (const item of state.tracks) if (item.added) buffers.delete(item.id)
      if (!keep) stop()
      set({ tracks: builtIn, current: keep ? state.current : builtIn[0]!.id })
    },
    clearFiles: () => {
      const playingAdded = track().added
      const tracks = state.tracks.filter((item) => !item.added)
      for (const item of state.tracks) if (item.added) buffers.delete(item.id)
      if (playingAdded) stop()
      set({ tracks, current: playingAdded ? tracks[0]!.id : state.current })
    },
    destroy: () => {
      halt()
      listeners.clear()
      void graph?.ctx.close()
      graph = null
    },
  }

  return engine
}

type Engine = ReturnType<typeof createEngine>

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export { createEngine, formatTime }
export type { Engine, PlayerState, Status, Track }
