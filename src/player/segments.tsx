const DIGITS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgecd",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
}

const across = (y: number) =>
  `1.4,${y} 2.4,${y - 0.9} 7.6,${y - 0.9} 8.6,${y} 7.6,${y + 0.9} 2.4,${y + 0.9}`

const down = (x: number, top: number, bottom: number) =>
  `${x},${top} ${x + 0.9},${top + 1} ${x + 0.9},${bottom - 1} ${x},${bottom} ${x - 0.9},${bottom - 1} ${x - 0.9},${top + 1}`

const SHAPES: Record<string, string> = {
  a: across(0.9),
  b: down(9.1, 1.2, 8.7),
  c: down(9.1, 9.3, 16.8),
  d: across(17.1),
  e: down(0.9, 9.3, 16.8),
  f: down(0.9, 1.2, 8.7),
  g: across(9),
}

function Segments({ text }: { text: string }) {
  return (
    <span className="segments" aria-hidden="true">
      {[...text].map((char, index) =>
        char === ":" ? (
          <svg key={index} className="colon" viewBox="0 0 4 18">
            <circle cx="2" cy="5.5" r="1.1" />
            <circle cx="2" cy="12.5" r="1.1" />
          </svg>
        ) : (
          <svg key={index} className="digit" viewBox="0 0 10 18">
            {Object.entries(SHAPES).map(([name, points]) => (
              <polygon
                key={name}
                points={points}
                data-on={DIGITS[char]?.includes(name) ? "" : undefined}
              />
            ))}
          </svg>
        )
      )}
    </span>
  )
}

export { Segments }
