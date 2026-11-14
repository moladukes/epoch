type Drums = "four" | "half" | "none"

type Song = {
  id: string
  title: string
  artist: string
  bpm: number
  bars: number
  root: number
  scale: number[]
  progression: number[]
  lead: OscillatorType
  arp: OscillatorType
  bass: OscillatorType
  pad: OscillatorType
  drums: Drums
  arpRate: 2 | 4
  cutoff: number
  seed: number
}

const MINOR = [0, 2, 3, 5, 7, 8, 10]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]
const DORIAN = [0, 2, 3, 5, 7, 9, 10]
const PENTATONIC = [0, 2, 4, 7, 9]

const ARTIST = "Epoch House Band"

const songs: Song[] = [
  {
    id: "dial-up-sunrise",
    title: "Dial-Up Sunrise",
    artist: ARTIST,
    bpm: 132,
    bars: 24,
    root: 57,
    scale: MINOR,
    progression: [0, 5, 3, 4],
    lead: "square",
    arp: "square",
    bass: "triangle",
    pad: "triangle",
    drums: "four",
    arpRate: 4,
    cutoff: 5200,
    seed: 1997,
  },
  {
    id: "brushed-aluminium",
    title: "Brushed Aluminium",
    artist: ARTIST,
    bpm: 104,
    bars: 20,
    root: 53,
    scale: DORIAN,
    progression: [0, 3, 6, 4],
    lead: "sawtooth",
    arp: "triangle",
    bass: "sawtooth",
    pad: "sawtooth",
    drums: "half",
    arpRate: 2,
    cutoff: 2400,
    seed: 2003,
  },
  {
    id: "glass-dock",
    title: "Glass Dock",
    artist: ARTIST,
    bpm: 118,
    bars: 24,
    root: 60,
    scale: MAJOR,
    progression: [0, 4, 5, 3],
    lead: "sine",
    arp: "sine",
    bass: "sine",
    pad: "sawtooth",
    drums: "four",
    arpRate: 4,
    cutoff: 3600,
    seed: 2007,
  },
  {
    id: "flat-white",
    title: "Flat White",
    artist: ARTIST,
    bpm: 88,
    bars: 16,
    root: 55,
    scale: PENTATONIC,
    progression: [0, 2, 3, 1],
    lead: "triangle",
    arp: "sine",
    bass: "sine",
    pad: "triangle",
    drums: "half",
    arpRate: 2,
    cutoff: 1800,
    seed: 2026,
  },
  {
    id: "bend-the-curve",
    title: "Bend the Curve",
    artist: ARTIST,
    bpm: 124,
    bars: 24,
    root: 50,
    scale: DORIAN,
    progression: [0, 2, 5, 4],
    lead: "sawtooth",
    arp: "square",
    bass: "sawtooth",
    pad: "sawtooth",
    drums: "four",
    arpRate: 4,
    cutoff: 4400,
    seed: 2030,
  },
]

const TAIL = 1.5

function songDuration(song: Song) {
  return (song.bars * 4 * 60) / song.bpm + TAIL
}

function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function frequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function degree(song: Song, step: number) {
  const size = song.scale.length
  const index = ((step % size) + size) % size
  return song.root + (song.scale[index] ?? 0) + 12 * Math.floor(step / size)
}

async function renderSong(song: Song, sampleRate = 44100) {
  const duration = songDuration(song)
  const ctx = new OfflineAudioContext(
    1,
    Math.ceil(duration * sampleRate),
    sampleRate
  )
  const rand = random(song.seed)
  const beat = 60 / song.bpm
  const bar = beat * 4

  const master = ctx.createGain()
  master.gain.value = 0.7
  const compressor = ctx.createDynamicsCompressor()
  master.connect(compressor).connect(ctx.destination)
  const end = song.bars * bar
  master.gain.setValueAtTime(0.7, end - bar)
  master.gain.linearRampToValueAtTime(0.0001, end + TAIL * 0.8)

  const tone = ctx.createBiquadFilter()
  tone.type = "lowpass"
  tone.frequency.value = song.cutoff
  tone.Q.value = 0.8
  tone.connect(master)

  const noise = ctx.createBuffer(1, sampleRate, sampleRate)
  const samples = noise.getChannelData(0)
  for (let i = 0; i < samples.length; i++) samples[i] = rand() * 2 - 1

  const note = (
    type: OscillatorType,
    midi: number,
    at: number,
    length: number,
    level: number,
    out: AudioNode,
    attack = 0.005,
    detune = 0
  ) => {
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = frequency(midi)
    osc.detune.value = detune
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(level, at + attack)
    gain.gain.setTargetAtTime(0, at + length * 0.6, length * 0.25)
    osc.connect(gain).connect(out)
    osc.start(at)
    osc.stop(at + length * 2 + 0.05)
  }

  const kick = (at: number) => {
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(140, at)
    osc.frequency.exponentialRampToValueAtTime(42, at + 0.12)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.9, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.32)
    osc.connect(gain).connect(master)
    osc.start(at)
    osc.stop(at + 0.34)
  }

  const hit = (at: number, cutoff: number, length: number, level: number) => {
    const source = ctx.createBufferSource()
    source.buffer = noise
    const filter = ctx.createBiquadFilter()
    filter.type = cutoff > 5000 ? "highpass" : "bandpass"
    filter.frequency.value = cutoff
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(level, at)
    gain.gain.exponentialRampToValueAtTime(0.001, at + length)
    source.connect(filter).connect(gain).connect(master)
    source.start(at, rand() * 0.5, length + 0.02)
  }

  let melody = 7
  for (let b = 0; b < song.bars; b++) {
    const start = b * bar
    const chord = song.progression[b % song.progression.length] ?? 0
    const tones = [chord, chord + 2, chord + 4]
    const intro = b < 2
    const full = b >= 4 && b < song.bars - 1

    for (const step of tones) {
      for (const cents of [-7, 7]) {
        note(song.pad, degree(song, step), start, bar, 0.035, tone, 0.35, cents)
      }
    }

    for (let i = 0; i < 4 * song.arpRate; i++) {
      const step = tones[i % tones.length] ?? 0
      const lift = i % (tones.length * 2) >= tones.length ? 7 : 0
      const at = start + (i * beat) / song.arpRate
      note(
        song.arp,
        degree(song, step + lift) + 12,
        at,
        beat / song.arpRate,
        intro ? 0.05 : 0.075,
        tone
      )
    }

    if (!intro) {
      for (let i = 0; i < 8; i++) {
        const at = start + (i * beat) / 2
        const octave = i % 4 === 3 ? 12 : 0
        note(
          song.bass,
          degree(song, chord) - 24 + octave,
          at,
          beat / 2,
          0.3,
          master
        )
      }
    }

    if (full) {
      let at = start
      while (at < start + bar - 0.01) {
        const length = rand() < 0.35 ? beat : beat / 2
        if (rand() > 0.28) {
          melody += Math.round(rand() * 4 - 2)
          melody = Math.max(4, Math.min(13, melody))
          note(song.lead, degree(song, melody) + 12, at, length, 0.09, tone, 0.01)
        }
        at += length
      }
    }

    if (song.drums !== "none" && !intro) {
      for (let i = 0; i < 4; i++) {
        const at = start + i * beat
        if (song.drums === "four" || i % 2 === 0) kick(at)
        if (i % 2 === 1) hit(at, 1800, 0.16, 0.28)
        hit(at + beat / 2, 8000, 0.05, 0.16)
        if (song.drums === "four") hit(at, 9000, 0.03, 0.08)
      }
    }
  }

  return ctx.startRendering()
}

export { renderSong, songDuration, songs }
export type { Song }
