type Note = [step: number, midi: number, length: number]

type Bus = {
  pan?: number
  level?: number
  lowpass?: number
  verb?: number
  echo?: number
  drive?: number
}

type Voice = {
  type?: OscillatorType
  level?: number
  attack?: number
  release?: number
  detune?: number
  glide?: number
  slide?: number
  vibrato?: number
  pluck?: boolean
}

type BassVoice = {
  type?: OscillatorType
  level?: number
  cutoff?: number
  q?: number
  glide?: number
  sub?: number
}

type Song = {
  id: string
  title: string
  artist: string
  bpm: number
  bars: number
  swing: number
  seed: number
  score: (kit: Kit) => void
}

const ARTIST = "Epoch House Band"
const TAIL = 2.5
// Songs render a few bars at a time. A context that holds every note of a
// song spends most of its time stepping over notes that are not sounding.
const SPAN = 2
const RING = 3
const VELOCITY: Record<string, number> = { X: 1, x: 0.7, o: 0.35 }

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

function createKit(
  ctx: OfflineAudioContext,
  song: Song,
  from: number,
  to: number
) {
  const rand = random(song.seed)
  const rate = ctx.sampleRate
  const beat = 60 / song.bpm
  const step = beat / 4
  const bar = beat * 4
  const end = song.bars * bar

  // Odd sixteenths land late by the song's swing amount.
  const at = (b: number, s = 0) =>
    b * bar + s * step + (Math.floor(s) % 2 === 1 ? song.swing * step : 0)

  const filter = (type: BiquadFilterType, hz: number, q = 0.7) => {
    const node = ctx.createBiquadFilter()
    node.type = type
    node.frequency.value = hz
    node.Q.value = q
    return node
  }

  const level = (value: number) => {
    const node = ctx.createGain()
    node.gain.value = value
    return node
  }

  // Only notes that start inside this span are scheduled, on the span's clock.
  const outside = (t: number) => t < from || t >= to

  const master = ctx.createGain()
  master.connect(ctx.destination)

  const room = ctx.createConvolver()
  const size = Math.floor(rate * 1.3)
  const impulse = ctx.createBuffer(2, size, rate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < size; i++) {
      data[i] = (rand() * 2 - 1) * (1 - i / size) ** 4
    }
  }
  room.buffer = impulse
  room.connect(filter("highpass", 260)).connect(level(0.55)).connect(master)

  const echo = ctx.createDelay(1.5)
  echo.delayTime.value = step * 3
  const damp = filter("lowpass", 2200)
  echo.connect(damp).connect(level(0.38)).connect(echo)
  damp.connect(master)

  const hiss = ctx.createBuffer(1, rate * 2, rate)
  const grains = hiss.getChannelData(0)
  for (let i = 0; i < grains.length; i++) grains[i] = rand() * 2 - 1

  const bus = (o: Bus = {}) => {
    const input = level(o.level ?? 1)
    let node: AudioNode = input
    if (o.drive) {
      const shaper = ctx.createWaveShaper()
      const curve = new Float32Array(1024)
      for (let i = 0; i < curve.length; i++) {
        const x = (i / (curve.length - 1)) * 2 - 1
        curve[i] = Math.tanh(x * o.drive) / Math.tanh(o.drive)
      }
      shaper.curve = curve
      shaper.oversample = "2x"
      node = node.connect(shaper)
    }
    if (o.lowpass) node = node.connect(filter("lowpass", o.lowpass))
    if (o.pan) {
      const panner = ctx.createStereoPanner()
      panner.pan.value = o.pan
      node = node.connect(panner)
    }
    node.connect(master)
    if (o.verb) node.connect(level(o.verb)).connect(room)
    if (o.echo) node.connect(level(o.echo)).connect(echo)
    return input
  }

  const pitch = (
    osc: OscillatorNode,
    midi: number,
    t: number,
    glide?: number,
    slide = 0.07
  ) => {
    if (glide === undefined || glide === midi) {
      osc.frequency.value = frequency(midi)
      return
    }
    osc.frequency.setValueAtTime(frequency(glide), t)
    osc.frequency.exponentialRampToValueAtTime(frequency(midi), t + slide)
  }

  const tone = (
    out: AudioNode,
    midi: number,
    start: number,
    length: number,
    o: Voice = {}
  ) => {
    if (outside(start)) return
    const t = start - from
    const osc = ctx.createOscillator()
    osc.type = o.type ?? "sine"
    osc.detune.value = o.detune ?? 0
    pitch(osc, midi, t, o.glide, o.slide)
    const attack = o.attack ?? 0.004
    const release = o.release ?? 0.03
    const stop = t + length + (o.pluck ? 0.02 : release * 6)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(o.level ?? 0.2, t + attack)
    if (o.pluck) gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
    else gain.gain.setTargetAtTime(0, t + Math.max(attack, length - 0.01), release)
    if (o.vibrato) {
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 5.6
      const depth = level(0)
      depth.gain.setValueAtTime(0, t + Math.min(0.15, length * 0.3))
      depth.gain.linearRampToValueAtTime(o.vibrato, t + Math.min(0.45, length))
      lfo.connect(depth).connect(osc.detune)
      lfo.start(t)
      lfo.stop(stop)
    }
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(stop)
  }

  const noise = (
    out: AudioNode,
    start: number,
    o: {
      type?: BiquadFilterType
      hz: number
      q?: number
      decay: number
      level: number
    }
  ) => {
    if (outside(start)) return
    const t = start - from
    const source = ctx.createBufferSource()
    source.buffer = hiss
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(o.level, t)
    gain.gain.exponentialRampToValueAtTime(0.0005, t + o.decay)
    source
      .connect(filter(o.type ?? "highpass", o.hz, o.q))
      .connect(gain)
      .connect(out)
    source.start(t, rand(), o.decay + 0.02)
  }

  const kick = (
    out: AudioNode,
    start: number,
    o: { level?: number; hz?: number; punch?: number; decay?: number } = {}
  ) => {
    if (outside(start)) return
    const t = start - from
    const hz = o.hz ?? 50
    const decay = o.decay ?? 0.28
    const peak = o.level ?? 0.9
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(hz * (o.punch ?? 3), t)
    osc.frequency.exponentialRampToValueAtTime(hz, t + 0.07)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(peak, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + decay)
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + decay + 0.02)
    noise(out, start, {
      type: "lowpass",
      hz: 2400,
      decay: 0.015,
      level: peak * 0.25,
    })
  }

  const snare = (out: AudioNode, t: number, peak = 0.5, fat = 1) => {
    tone(out, 55, t, 0.1 * fat, {
      type: "triangle",
      level: peak * 0.6,
      glide: 60,
      pluck: true,
    })
    noise(out, t, { type: "bandpass", hz: 1900, q: 0.6, decay: 0.17 * fat, level: peak })
    noise(out, t, { hz: 6500, decay: 0.1 * fat, level: peak * 0.35 })
  }

  const clap = (out: AudioNode, t: number, peak = 0.45) => {
    for (const delay of [0, 0.011, 0.023]) {
      noise(out, t + delay, {
        type: "bandpass",
        hz: 1400,
        q: 1.1,
        decay: 0.014,
        level: peak,
      })
    }
    noise(out, t + 0.032, {
      type: "bandpass",
      hz: 1400,
      q: 0.9,
      decay: 0.19,
      level: peak * 0.8,
    })
  }

  const hat = (out: AudioNode, t: number, peak = 0.15, open = 0) =>
    noise(out, t, { hz: 8500, decay: open || 0.04, level: peak })

  const rim = (out: AudioNode, t: number, peak = 0.2) => {
    tone(out, 91, t, 0.03, { type: "triangle", level: peak, pluck: true })
    noise(out, t, { type: "bandpass", hz: 3000, q: 2, decay: 0.02, level: peak * 0.6 })
  }

  const cowbell = (out: AudioNode, t: number, peak = 0.1) => {
    for (const midi of [72.55, 79.35]) {
      tone(out, midi, t, 0.22, { type: "square", level: peak, pluck: true })
    }
  }

  // An electric piano: a sine body, a soft triangle and a short bright tine.
  const keys = (out: AudioNode, midi: number, t: number, length: number, peak = 0.07) => {
    tone(out, midi, t, length * 2.2, { level: peak, pluck: true })
    tone(out, midi, t, length * 1.2, {
      type: "triangle",
      level: peak * 0.4,
      detune: 5,
      pluck: true,
    })
    tone(out, midi + 12, t, Math.min(length, 0.3), {
      level: peak * 0.25,
      pluck: true,
    })
  }

  const bass = (
    out: AudioNode,
    midi: number,
    start: number,
    length: number,
    o: BassVoice = {}
  ) => {
    if (outside(start)) return
    const t = start - from
    const cutoff = o.cutoff ?? 420
    const osc = ctx.createOscillator()
    osc.type = o.type ?? "sawtooth"
    pitch(osc, midi, t, o.glide)
    const sweep = filter("lowpass", cutoff, o.q ?? 3)
    sweep.frequency.setValueAtTime(cutoff * 3.5, t)
    sweep.frequency.exponentialRampToValueAtTime(cutoff, t + 0.12)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(o.level ?? 0.3, t + 0.006)
    gain.gain.setTargetAtTime(0, t + Math.max(0.02, length - 0.02), 0.025)
    osc.connect(sweep).connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + length + 0.2)
    if (o.sub) {
      tone(out, midi, start, length, {
        level: o.sub,
        glide: o.glide,
        attack: 0.008,
      })
    }
  }

  const pattern = (
    b: number,
    text: string,
    play: (t: number, velocity: number, index: number) => void
  ) => {
    for (let i = 0; i < text.length; i++) {
      const velocity = VELOCITY[text[i]!]
      if (velocity) play(at(b, i), velocity, i)
    }
  }

  const phrase = (
    b: number,
    notes: Note[],
    play: (midi: number, t: number, length: number) => void
  ) => {
    for (const [s, midi, length] of notes) play(midi, at(b, s), length * step)
  }

  // One turn of a worn record: hiss plus pops, looping every 1.8 seconds.
  const crackle = (peak: number) => {
    const length = Math.floor(rate * 1.8)
    const buffer = ctx.createBuffer(1, length, rate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (rand() * 2 - 1) * 0.02
    for (let n = 0; n < 70; n++) {
      const i = Math.floor(rand() * (length - 4))
      const pop = (rand() * 2 - 1) * rand() ** 2
      data[i] = pop
      data[i + 1] = -pop * 0.6
      data[i + 2] = pop * 0.2
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(filter("highpass", 900)).connect(level(peak)).connect(master)
    source.start(0, from % 1.8)
    source.stop(Math.min(to, end + TAIL) - from)
  }

  return {
    bars: song.bars,
    step,
    bar,
    at,
    bus,
    tone,
    noise,
    kick,
    snare,
    clap,
    hat,
    rim,
    cowbell,
    keys,
    bass,
    pattern,
    phrase,
    crackle,
  }
}

type Kit = ReturnType<typeof createKit>

// 1994, East Coast: swung drums, dusty electric piano, vibes on the hook.
function boomBap(k: Kit) {
  const drums = k.bus({ verb: 0.05 })
  const snares = k.bus({ verb: 0.2 })
  const hats = k.bus({ pan: 0.3 })
  const low = k.bus({ drive: 1.5 })
  const left = k.bus({ pan: -0.6, lowpass: 2300, verb: 0.25 })
  const right = k.bus({ pan: 0.6, lowpass: 2300, verb: 0.25 })
  const vibes = k.bus({ pan: -0.1, verb: 0.3, echo: 0.22 })
  k.crackle(0.6)

  const am9 = [57, 60, 64, 67, 71]
  const chords = [am9, am9, [53, 57, 60, 64], [52, 56, 62, 67]]
  const lines: Note[][] = [
    [[0, 45, 3], [7, 45, 1], [10, 45, 2], [14, 48, 1]],
    [[0, 45, 3], [6, 45, 1], [7, 52, 1], [10, 45, 2], [13, 43, 2]],
    [[0, 41, 3], [7, 41, 1], [10, 41, 2], [14, 43, 1]],
    [[0, 40, 3], [7, 40, 1], [10, 40, 2], [12, 43, 1], [14, 44, 1]],
  ]
  const melody: Note[][] = [
    [[0, 76, 2], [3, 74, 1], [4, 72, 3], [8, 69, 2], [11, 72, 1], [12, 74, 4]],
    [[0, 76, 2], [3, 79, 1], [4, 76, 3], [8, 74, 2], [10, 72, 2], [12, 69, 4]],
    [[0, 72, 3], [4, 69, 2], [6, 72, 2], [8, 76, 4], [14, 74, 2]],
    [[0, 71, 3], [4, 68, 2], [6, 71, 2], [8, 74, 3], [12, 76, 4]],
  ]
  const strike = (midi: number, t: number, length: number) => {
    k.tone(vibes, midi, t, length * 1.6, { level: 0.24, pluck: true })
    k.tone(vibes, midi + 12, t, 0.25, { level: 0.07, pluck: true })
  }
  const comp = (notes: number[], t: number, length: number, peak: number) =>
    notes.forEach((midi, i) => k.keys(i % 2 ? right : left, midi, t, length, peak))

  for (let b = 0; b < k.bars; b++) {
    const turn = b % 4
    const cut = b === k.bars - 1 ? 8 : 16
    const hook = (b >= 12 && b < 20) || b >= 24

    if (b !== 20 && b !== 21) {
      comp(chords[turn]!, k.at(b, 0), k.step * 9, 0.15)
      comp(chords[turn]!, k.at(b, 10), k.step * 5, 0.1)
    }
    if (b === 1) {
      k.pattern(b, "............x.xx", (t, v) => k.snare(snares, t, 0.4 * v, 1.2))
    }
    if (b >= 2) {
      const kicks = b % 2 ? "X.....x...xx...." : "X......x..x....."
      k.pattern(b, kicks.slice(0, cut), (t, v) =>
        k.kick(drums, t, { level: 0.7 * v, hz: 58, decay: 0.18, punch: 3.4 })
      )
      k.pattern(b, (turn === 3 ? "....X.......X..o" : "....X.......X...").slice(0, cut), (t, v) =>
        k.snare(snares, t, 0.7 * v, 1.2)
      )
      k.pattern(b, "x.x.x.xox.x.x.x.".slice(0, cut), (t, v, i) =>
        k.hat(hats, t, 0.28 * v, turn === 3 && i === 14 ? 0.2 : 0)
      )
    }
    if (b >= 4) {
      k.phrase(b, lines[turn]!, (midi, t, length) => {
        if (t < k.at(b, cut)) {
          k.bass(low, midi, t, length, {
            type: "triangle",
            level: 0.26,
            cutoff: 700,
            sub: 0.1,
          })
        }
      })
    }
    if (hook) k.phrase(b, melody[turn]!, strike)
  }

  const close = k.at(k.bars)
  k.kick(drums, close, { hz: 52, decay: 0.3 })
  comp(am9, close, 2.2, 0.16)
  k.bass(low, 45, close, 1.4, { type: "triangle", level: 0.26, cutoff: 700, sub: 0.1 })
  strike(81, close, 1.2)
}

// 1993, West Coast: a sliding sine lead, a fat synth bass and lazy claps.
function gFunk(k: Kit) {
  const drums = k.bus()
  const claps = k.bus({ verb: 0.18 })
  const hats = k.bus({ pan: -0.3 })
  const low = k.bus({ drive: 2 })
  const left = k.bus({ pan: -0.6, lowpass: 3000, verb: 0.2 })
  const right = k.bus({ pan: 0.6, lowpass: 3000, verb: 0.2 })
  const whine = k.bus({ pan: 0.08, verb: 0.25, echo: 0.3 })
  const pad = k.bus({ lowpass: 1500, verb: 0.3 })

  const cm9 = [60, 63, 67, 70, 74]
  const chords = [cm9, cm9, [56, 60, 63, 67], [55, 59, 62, 65]]
  const lines: Note[][] = [
    [[0, 36, 2], [3, 36, 1], [6, 39, 1], [7, 36, 1], [10, 34, 2], [12, 36, 1], [14, 31, 1], [15, 34, 1]],
    [[0, 36, 2], [3, 36, 1], [6, 39, 1], [7, 41, 1], [8, 43, 2], [11, 41, 1], [12, 39, 1], [14, 36, 2]],
    [[0, 32, 3], [3, 32, 1], [6, 36, 1], [8, 32, 2], [11, 39, 1], [12, 32, 1], [14, 34, 2]],
    [[0, 31, 3], [3, 31, 1], [6, 35, 1], [8, 38, 2], [10, 31, 1], [12, 41, 1], [13, 38, 1], [14, 35, 2]],
  ]
  const lead: Note[][] = [
    [[0, 79, 6], [6, 82, 2], [8, 84, 8]],
    [[0, 87, 4], [4, 86, 2], [6, 84, 2], [8, 82, 4], [12, 79, 4]],
    [[0, 80, 6], [6, 84, 2], [8, 87, 8]],
    [[0, 86, 4], [4, 83, 4], [8, 79, 4], [12, 83, 2], [14, 86, 2]],
  ]
  const comp = (notes: number[], t: number, length: number, peak: number) =>
    notes.forEach((midi, i) => k.keys(i % 2 ? right : left, midi, t, length, peak))

  let from = 79
  const sing = (midi: number, t: number, length: number) => {
    const voice = { glide: from, slide: 0.09, attack: 0.02, release: 0.05 }
    k.tone(whine, midi, t, length, { ...voice, level: 0.15, vibrato: 16 })
    k.tone(whine, midi, t, length, { ...voice, type: "sawtooth", level: 0.03 })
    from = midi
  }

  for (let b = 0; b < k.bars; b++) {
    const turn = b % 4
    const cut = b === k.bars - 1 ? 12 : 16
    const hook = b < 4 || (b >= 12 && b < 20) || b >= 22
    const breakdown = b === 20 || b === 21
    const groove = b >= 4 && !breakdown

    comp(chords[turn]!, k.at(b, 0), k.step * (breakdown ? 3 : 10), 0.1)
    if (!breakdown) comp(chords[turn]!, k.at(b, 10), k.step * 4, 0.07)

    k.pattern(b, "xoxoxoxoxoxoxoxo".slice(0, cut), (t, v, i) =>
      k.hat(hats, t, 0.4 * v, b % 2 && i === 14 ? 0.16 : 0)
    )
    if (b >= 2) {
      k.pattern(b, "....X.......X...".slice(0, cut), (t) => {
        k.clap(claps, t, 0.55)
        if (groove) k.snare(claps, t, 0.4)
      })
    }
    if (groove) {
      const kicks = b % 2 ? "X..x....x.x...x." : "X..x....x.x....."
      k.pattern(b, kicks.slice(0, cut), (t, v) =>
        k.kick(drums, t, { level: 0.8 * v, hz: 52, decay: 0.24 })
      )
    }
    if (b >= 4) {
      let last: number | undefined
      k.phrase(b, lines[turn]!, (midi, t, length) => {
        if (t >= k.at(b, cut)) return
        k.bass(low, midi, t, length, {
          level: 0.2,
          cutoff: 560,
          q: 6,
          sub: 0.1,
          glide: last,
        })
        last = midi
      })
    }
    if (hook) k.phrase(b, lead[turn]!, sing)
    if (b >= 12 && !breakdown) {
      for (const midi of chords[turn]!) {
        for (const detune of [-8, 8]) {
          k.tone(pad, midi + 12, k.at(b), k.bar, {
            type: "sawtooth",
            level: 0.03,
            attack: 0.5,
            release: 0.2,
            detune,
          })
        }
      }
    }
  }

  const close = k.at(k.bars)
  k.kick(drums, close, { hz: 48, decay: 0.32 })
  comp(cm9, close, 2.2, 0.11)
  k.bass(low, 36, close, 1.2, { level: 0.2, cutoff: 560, q: 6, sub: 0.1 })
  sing(84, close, 1.4)
}

// 2001, club: a dry syncopated beat, hard stabs and a plucked eastern riff.
function club(k: Kit) {
  const drums = k.bus()
  const claps = k.bus({ verb: 0.1 })
  const left = k.bus({ pan: -0.5, lowpass: 5000 })
  const right = k.bus({ pan: 0.5 })
  const low = k.bus({ drive: 2.5, lowpass: 1400 })
  const stabs = k.bus({ lowpass: 6000, verb: 0.1 })
  const riff = k.bus({ pan: 0.15, lowpass: 5200, verb: 0.12, echo: 0.28 })
  const siren = k.bus({ pan: -0.2, verb: 0.3, echo: 0.3 })

  const e = [52, 56, 59]
  const chords = [e, e, [53, 57, 60], e]
  const lines: Note[][] = [
    [[0, 40, 1.5], [3, 40, 1], [6, 40, 1.5], [10, 40, 1], [12, 41, 1.5]],
    [[0, 40, 1.5], [3, 40, 1], [6, 40, 1.5], [11, 43, 1], [14, 41, 1.5]],
  ]
  const plucks: Note[][] = [
    [[0, 76, 1], [2, 77, 1], [3, 76, 1], [6, 74, 1], [8, 76, 1], [10, 80, 1], [11, 77, 1], [14, 76, 2]],
    [[0, 76, 1], [2, 77, 1], [3, 76, 1], [6, 80, 1], [8, 83, 1], [10, 81, 1], [11, 80, 1], [12, 77, 1], [14, 76, 2]],
    [[0, 77, 1], [2, 81, 1], [3, 77, 1], [6, 76, 1], [8, 77, 2], [12, 72, 2]],
    [[0, 76, 1], [2, 80, 1], [3, 83, 1], [6, 80, 1], [8, 76, 3]],
  ]
  const stab = (notes: number[], t: number) => {
    for (const midi of notes) {
      k.tone(stabs, midi, t, 0.16, { type: "sawtooth", level: 0.1, pluck: true })
      k.tone(stabs, midi, t, 0.16, {
        type: "square",
        level: 0.06,
        detune: 7,
        pluck: true,
      })
    }
  }
  const pluck = (midi: number, t: number, length: number) => {
    k.tone(riff, midi, t, length * 1.3, { type: "triangle", level: 0.2, pluck: true })
    k.tone(riff, midi, t, length, { type: "square", level: 0.045, pluck: true })
  }

  for (let b = 0; b < k.bars; b++) {
    const turn = b % 4
    const odd = b % 2 === 1
    const cut = b === k.bars - 1 ? 12 : 16
    const breakdown = b >= 20 && b < 24
    const hook = (b >= 12 && b < 20) || b >= 22

    if (!breakdown) {
      k.pattern(b, (turn === 3 ? "x..x..x...x.x..." : "x..x..x.........").slice(0, cut), (t, _, i) =>
        stab(turn === 3 && i === 10 ? chords[2]! : chords[turn]!, t)
      )
    }
    k.pattern(b, "..x...x...x...x.".slice(0, cut), (t) => k.hat(right, t, 0.42))
    if (odd && cut === 16) {
      for (const [i, s] of [14.5, 15, 15.5].entries()) {
        k.hat(right, k.at(b, s), 0.16 + i * 0.05)
      }
    }
    k.pattern(b, (odd ? ".......x.....x.." : ".......x........").slice(0, cut), (t) =>
      k.rim(right, t, 0.28)
    )
    if (odd) k.pattern(b, "...x......x.....", (t) => k.cowbell(left, t))
    if (turn === 3 && cut === 16) {
      k.tone(left, 50, k.at(b, 14), 0.12, { level: 0.3, glide: 55, pluck: true })
      k.tone(left, 45, k.at(b, 15), 0.14, { level: 0.3, glide: 50, pluck: true })
    }
    if (b >= 2) {
      const kicks = odd ? "X..x..x....x..x." : "X..x..x...x.x..."
      k.pattern(b, kicks.slice(0, cut), (t, v) =>
        k.kick(drums, t, { level: 0.8 * v, hz: 58, decay: 0.18, punch: 3.5 })
      )
      k.pattern(b, "....X.......X...".slice(0, cut), (t) => k.clap(claps, t, 0.7))
    }
    if (b >= 4) {
      k.phrase(b, lines[b % 2]!, (midi, t, length) => {
        if (t >= k.at(b, cut)) return
        k.bass(low, midi, t, length, {
          type: "square",
          level: 0.24,
          cutoff: 420,
          q: 2,
          sub: 0.14,
        })
      })
    }
    if (hook) {
      k.phrase(b, plucks[turn]!, pluck)
      k.pattern(b, "xoxoxoxoxoxoxoxo".slice(0, cut), (t, v) =>
        k.noise(left, t, { hz: 6000, decay: 0.03, level: 0.22 * v })
      )
    }
    if (b === 11 || b === 21) {
      k.tone(siren, 88, k.at(b), k.bar, {
        level: 0.05,
        glide: 64,
        slide: k.bar,
        attack: 0.3,
      })
    }
  }

  const close = k.at(k.bars)
  k.kick(drums, close, { hz: 55, decay: 0.3 })
  k.clap(claps, close, 0.4)
  stab(e, close)
  pluck(76, close, 1)
}

// 2004, Dirty South: a tuned 808, rolling hats, brass hits and a chant-ready riff.
function crunk(k: Kit) {
  const sub = k.bus({ drive: 2.2 })
  const claps = k.bus({ verb: 0.22 })
  const hats = k.bus({ pan: 0.3 })
  const brass = k.bus({ lowpass: 2600, verb: 0.25 })
  const lead = k.bus({ lowpass: 4200, verb: 0.15, echo: 0.2 })
  const bells = k.bus({ pan: -0.3, verb: 0.35, echo: 0.3 })

  const roots = [31, 31, 39, 38]
  const gm = [55, 58, 62]
  const triads = [gm, gm, [51, 55, 58], [50, 54, 57]]
  const riffs: Note[][] = [
    [[0, 67, 1], [2, 67, 1], [3, 70, 1], [4, 67, 1], [6, 74, 2], [10, 72, 1], [12, 70, 2]],
    [[0, 67, 1], [2, 67, 1], [3, 70, 1], [4, 67, 1], [6, 75, 2], [10, 74, 1], [12, 72, 1], [14, 70, 1]],
    [[0, 75, 1], [2, 75, 1], [3, 79, 1], [4, 75, 1], [6, 82, 2], [10, 79, 1], [12, 77, 2]],
    [[0, 74, 1], [2, 74, 1], [3, 78, 1], [4, 74, 1], [6, 81, 2], [10, 78, 1], [12, 74, 2]],
  ]
  const hit = (notes: number[], root: number, t: number, length: number) => {
    for (const midi of [root + 12, ...notes]) {
      for (const detune of [-10, 10]) {
        k.tone(brass, midi, t, length, {
          type: "sawtooth",
          level: 0.07,
          attack: 0.012,
          release: 0.08,
          detune,
        })
      }
    }
  }
  const shout = (midi: number, t: number, length: number) => {
    for (const detune of [-9, 9]) {
      k.tone(lead, midi, t, length * 0.8, {
        type: "sawtooth",
        level: 0.09,
        release: 0.03,
        detune,
      })
    }
  }
  const ring = (midi: number, t: number) => {
    k.tone(bells, midi, t, 0.5, { level: 0.11, pluck: true })
    k.tone(bells, midi + 12, t, 0.2, { level: 0.04, pluck: true })
  }

  for (let b = 0; b < k.bars; b++) {
    const turn = b % 4
    const odd = b % 2 === 1
    const cut = b === k.bars - 1 ? 8 : 16
    const hook = b >= 12
    const quiet = b < 4

    hit(triads[turn]!, roots[turn]!, k.at(b, 0), k.step * 3)
    if (cut === 16) hit(triads[turn]!, roots[turn]!, k.at(b, 10), k.step * 1.5)

    if (b < 12 || b >= 20) {
      k.pattern(b, "x.x.x.x.x.x.x.x.".slice(0, cut), (_, __, i) => {
        const tones = triads[turn]!
        const order = [0, 1, 2, 1]
        ring(tones[order[(i / 2) % 4]!]! + 24, k.at(b, i))
      })
    }
    if (b >= 2) {
      k.pattern(b, "x.x.x.x.x.x.x.x.".slice(0, cut), (t, v, i) =>
        k.hat(hats, t, 0.3 * v, !odd && i === 10 ? 0.18 : 0)
      )
      if (cut === 16) {
        const roll = odd ? [14, 14.67, 15.33] : [6.5, 7, 7.5]
        for (const [i, s] of roll.entries()) {
          k.hat(hats, k.at(b, s), 0.16 + i * 0.05)
        }
      }
    }
    if (!quiet) {
      const hz = frequency(roots[turn]!)
      const kicks = odd ? "X..x..x...x.x.x." : "X.....x...x..x.."
      k.pattern(b, kicks.slice(0, cut), (t, v, i) =>
        k.kick(sub, t, {
          level: 0.7 * v,
          hz,
          punch: 2.6,
          decay: i === 0 ? 0.95 : 0.45,
        })
      )
      k.pattern(b, "....X.......X...".slice(0, cut), (t) => {
        k.clap(claps, t, 0.7)
        k.snare(claps, t, 0.4, 0.8)
      })
    }
    if (hook) k.phrase(b, riffs[turn]!, shout)
  }

  const close = k.at(k.bars)
  k.kick(sub, close, { hz: frequency(31), punch: 2.6, decay: 1.6 })
  k.clap(claps, close, 0.45)
  hit(gm, 31, close, 1)
  ring(91, close)
}

// 1999, UK garage: a skipping two-step beat, organ bass and chopped stabs.
function garage(k: Kit) {
  const drums = k.bus()
  const snares = k.bus({ verb: 0.15 })
  const hats = k.bus({ pan: 0.2 })
  const low = k.bus({ drive: 1.6 })
  const left = k.bus({ pan: -0.6, lowpass: 3400, verb: 0.2, echo: 0.22 })
  const right = k.bus({ pan: 0.6, lowpass: 3400, verb: 0.2, echo: 0.22 })
  const chirps = k.bus({ pan: 0.2, verb: 0.3, echo: 0.35 })
  const strings = k.bus({ lowpass: 3000, verb: 0.4 })

  const fm9 = [53, 56, 60, 63, 67]
  const chords = [fm9, [49, 53, 56, 60], [51, 55, 58, 65], [48, 51, 55, 58]]
  const roots = [41, 37, 39, 36]
  const motif: Note[][] = [
    [[0, 84, 1], [2, 87, 1], [4, 84, 2], [10, 82, 1], [12, 80, 2]],
    [[2, 79, 1], [4, 80, 1], [6, 84, 3], [12, 87, 1], [14, 84, 1]],
  ]
  const stab = (notes: number[], t: number, peak: number) =>
    notes.forEach((midi, i) => {
      const out = i % 2 ? right : left
      k.tone(out, midi, t, 0.18, { type: "sawtooth", level: peak, pluck: true })
      k.tone(out, midi, t, 0.18, {
        type: "square",
        level: peak * 0.5,
        detune: -6,
        pluck: true,
      })
    })
  const organ = (midi: number, t: number, length: number) => {
    const voice = { attack: 0.006, release: 0.02 }
    k.tone(low, midi, t, length, { ...voice, level: 0.2 })
    k.tone(low, midi + 12, t, length, { ...voice, level: 0.14 })
    k.tone(low, midi + 19, t, length, { ...voice, level: 0.07 })
  }
  const chirp = (midi: number, t: number, length: number) =>
    k.tone(chirps, midi, t, length * 1.4, {
      level: 0.17,
      glide: midi - 4,
      slide: 0.05,
      pluck: true,
    })
  const swell = (notes: number[], t: number, length: number) => {
    for (const midi of notes.slice(1)) {
      for (const detune of [-9, 9]) {
        k.tone(strings, midi + 12, t, length, {
          type: "sawtooth",
          level: 0.03,
          attack: 0.4,
          release: 0.25,
          detune,
        })
      }
    }
  }

  for (let b = 0; b < k.bars; b++) {
    const turn = b % 4
    const root = roots[turn]!
    const breakdown = b >= 24 && b < 28
    const beat = b >= 4 && !breakdown
    const cut = b === k.bars - 1 ? 12 : 16

    k.pattern(b, (b % 2 ? "...x..x....x..x." : "...x..x....x....").slice(0, cut), (t) =>
      stab(chords[turn]!, t, 0.1)
    )
    k.pattern(b, "..x...x...x...x.".slice(0, cut), (t) =>
      k.hat(hats, t, breakdown ? 0.16 : 0.3, 0.09)
    )
    if (!breakdown) {
      k.pattern(b, "...o...o...o...o".slice(0, cut), (t, v) => k.hat(hats, t, 0.4 * v))
    }
    if (beat) {
      const kicks = b % 2 ? "X......x..x....." : "X.........x....."
      k.pattern(b, kicks.slice(0, cut), (t, v) =>
        k.kick(drums, t, { level: 0.8 * v, hz: 58, decay: 0.18, punch: 3.2 })
      )
      k.pattern(b, (turn === 3 ? "....X..o....X..o" : "....X.......X...").slice(0, cut), (t, v) => {
        k.snare(snares, t, 0.55 * v, 0.8)
        if (v === 1) k.clap(snares, t, 0.4)
      })
    }
    if (b >= 8 && !breakdown) {
      const line: Note[] = [
        [0, root, 1.5],
        [3, root, 1],
        [6, root, 2],
        [10, root + 7, 1],
        [11, root + 12, 1],
        [14, root, 1.5],
      ]
      k.phrase(b, line, (midi, t, length) => {
        if (t < k.at(b, cut)) organ(midi, t, length)
      })
    }
    if ((b >= 16 && b < 36) || b < 4) k.phrase(b, motif[b % 2]!, chirp)
    if (b >= 24 && b < 36) swell(chords[turn]!, k.at(b), k.bar)
    if (b === 27) {
      k.pattern(b, "xxxxxxxxxxxxxxxx", (t, _, i) =>
        k.snare(snares, t, 0.12 + i * 0.03, 0.6)
      )
    }
  }

  const close = k.at(k.bars)
  k.kick(drums, close, { hz: 54, decay: 0.3 })
  stab(fm9, close, 0.1)
  swell(fm9, close, 1.6)
  organ(41, close, 1.2)
}

const songs: Song[] = [
  {
    id: "corner-store-cipher",
    title: "Corner Store Cipher",
    artist: ARTIST,
    bpm: 90,
    bars: 28,
    swing: 0.24,
    seed: 1994,
    score: boomBap,
  },
  {
    id: "six-four-sunday",
    title: "Six-Four Sunday",
    artist: ARTIST,
    bpm: 94,
    bars: 28,
    swing: 0.1,
    seed: 1993,
    score: gFunk,
  },
  {
    id: "two-way-pager",
    title: "Two-Way Pager",
    artist: ARTIST,
    bpm: 100,
    bars: 28,
    swing: 0.04,
    seed: 2001,
    score: club,
  },
  {
    id: "candy-paint",
    title: "Candy Paint",
    artist: ARTIST,
    bpm: 76,
    bars: 24,
    swing: 0,
    seed: 2004,
    score: crunk,
  },
  {
    id: "rewind-selecta",
    title: "Rewind Selecta",
    artist: ARTIST,
    bpm: 132,
    bars: 40,
    swing: 0.28,
    seed: 1999,
    score: garage,
  },
]

async function renderSpan(
  song: Song,
  from: number,
  to: number,
  mix: Float32Array[],
  rate: number
) {
  const last = to === Infinity
  const seconds = last ? songDuration(song) - from : to - from + RING
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate)
  song.score(createKit(ctx, song, from, to))
  const buffer = await ctx.startRendering()
  const offset = Math.round(from * rate)
  const fade = 2048
  mix.forEach((target, channel) => {
    const data = buffer.getChannelData(channel)
    const count = Math.min(data.length, target.length - offset)
    for (let i = 0; i < count; i++) {
      const left = data.length - i
      const gain = !last && left < fade ? left / fade : 1
      target[offset + i] = target[offset + i]! + data[i]! * gain
    }
  })
}

async function renderSong(song: Song, sampleRate = 44100) {
  const bar = 240 / song.bpm
  const end = song.bars * bar
  const total = Math.ceil(songDuration(song) * sampleRate)
  const mix = [new Float32Array(total), new Float32Array(total)]

  const spans: [number, number][] = []
  for (let b = 0; b < song.bars; b += SPAN) {
    spans.push([b * bar, Math.min(b + SPAN, song.bars) * bar])
  }
  spans.push([end, Infinity])
  const worker = async () => {
    for (let span = spans.shift(); span; span = spans.shift()) {
      await renderSpan(song, span[0], span[1], mix, sampleRate)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))

  // The spans are summed, then glued by one compressor and faded out.
  const ctx = new OfflineAudioContext(2, total, sampleRate)
  const source = ctx.createBufferSource()
  source.buffer = ctx.createBuffer(2, total, sampleRate)
  mix.forEach((data, channel) => source.buffer!.copyToChannel(data, channel))
  const glue = ctx.createDynamicsCompressor()
  glue.threshold.value = -18
  glue.knee.value = 10
  glue.ratio.value = 3.5
  glue.attack.value = 0.006
  glue.release.value = 0.16
  const fade = ctx.createGain()
  fade.gain.setValueAtTime(1, end + TAIL * 0.3)
  fade.gain.linearRampToValueAtTime(0, end + TAIL)
  source.connect(glue).connect(fade).connect(ctx.destination)
  source.start()
  const buffer = await ctx.startRendering()

  // Every track leaves at the same peak, whatever its arrangement.
  let peak = 0
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < data.length; i++) {
      const value = Math.abs(data[i]!)
      if (value > peak) peak = value
    }
  }
  if (peak > 0) {
    const scale = 0.85 / peak
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel)
      for (let i = 0; i < data.length; i++) data[i] = data[i]! * scale
    }
  }
  return buffer
}

export { renderSong, songDuration, songs }
export type { Song }
