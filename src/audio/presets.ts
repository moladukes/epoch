const BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]

const CUSTOM = "Custom"

const presets: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass boost": [8, 7, 5, 2, 0, 0, 0, 0, 0, 0],
  "Treble boost": [0, 0, 0, 0, 0, 1, 3, 5, 7, 8],
  Loudness: [7, 5, 2, 0, -2, -2, 0, 2, 5, 7],
  Vocal: [-4, -3, -1, 2, 5, 6, 5, 2, 0, -2],
  "Lo-fi": [-10, -6, 0, 4, 6, 6, 3, -4, -9, -12],
}

function bandLabel(hz: number) {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`
}

function bandShort(hz: number) {
  return hz >= 1000 ? `${hz / 1000}K` : `${hz}`
}

export { BANDS, bandLabel, bandShort, CUSTOM, presets }
