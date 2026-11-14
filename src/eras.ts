type Era = {
  id: string
  year: string
  name: string
  note: string
}

const eras: Era[] = [
  {
    id: "1997",
    year: "1997",
    name: "Bitmap",
    note: "Sixteen shades of grey and a bevel on everything. Each control had to look like a control, because nothing else on screen was going to explain it.",
  },
  {
    id: "2003",
    year: "2003",
    name: "Brushed",
    note: "Skins, brushed metal and a blue LCD. A music player was a piece of hi-fi you kept on your desktop, with the equalizer and playlist docked underneath.",
  },
  {
    id: "2007",
    year: "2007",
    name: "Gloss",
    note: "Glass, gloss and glow. Hardware could finally blur what was behind a window, so every surface became a reflection.",
  },
  {
    id: "2026",
    year: "2026",
    name: "Flat",
    note: "Quiet, legible and the same everywhere. The chrome left, and most of the personality went with it.",
  },
  {
    id: "next",
    year: "Next",
    name: "Signal",
    note: "Not a prediction, an invention. The window is the visualizer, and the equalizer is one curve you bend.",
  },
]

function eraFromHash(hash: string) {
  const id = hash.replace(/^#/, "")
  return eras.find((era) => era.id === id)?.id ?? "2003"
}

export { eraFromHash, eras }
export type { Era }
