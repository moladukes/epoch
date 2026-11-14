type Era = {
  id: string
  year: string
  name: string
}

const eras: Era[] = [
  {
    id: "1997",
    year: "1997",
    name: "Bitmap",
  },
  {
    id: "2003",
    year: "2003",
    name: "Brushed",
  },
  {
    id: "2007",
    year: "2007",
    name: "Gloss",
  },
  {
    id: "2026",
    year: "2026",
    name: "Flat",
  },
  {
    id: "next",
    year: "Next",
    name: "Signal",
  },
]

function eraFromHash(hash: string) {
  const id = hash.replace(/^#/, "")
  return eras.find((era) => era.id === id)?.id ?? "2003"
}

export { eraFromHash, eras }
export type { Era }
