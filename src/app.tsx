import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import type { Engine } from "./audio/engine"
import { eraFromHash, eras } from "./eras"
import { Player } from "./player/player"
import { EngineContext } from "./player/use-engine"
import { signature, type Signature } from "./signature"

type Proof = { from: string; to: string; before: Signature; after: Signature }

const label = (id: string) => {
  const era = eras.find((item) => item.id === id)
  return era ? `${era.year} ${era.name}` : id
}

function App({ engine }: { engine: Engine }) {
  const [era, setEra] = useState(() => eraFromHash(location.hash))
  const [proof, setProof] = useState<Proof | null>(null)
  const stage = useRef<HTMLElement>(null)
  const about = useRef<HTMLElement>(null)
  const current = eras.find((item) => item.id === era) ?? eras[0]!

  const changeEra = (next: string) => {
    if (next === era || !eras.some((item) => item.id === next)) return
    const before = stage.current ? signature(stage.current) : null
    const apply = () => {
      flushSync(() => setEra(next))
      if (stage.current && before) {
        setProof({ from: era, to: next, before, after: signature(stage.current) })
      }
    }
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (document.startViewTransition && !calm) document.startViewTransition(apply)
    else apply()
    history.replaceState(null, "", `#${next}`)
  }

  useEffect(() => {
    const sync = () => setEra(eraFromHash(location.hash))
    addEventListener("hashchange", sync)
    return () => removeEventListener("hashchange", sync)
  }, [])

  return (
    <EngineContext value={engine}>
      <div className="page" data-era={era}>
        <header className="masthead">
          <h1>Epoch</h1>
          <p>
            One music player, five eras of interface. The markup, the keyboard
            and the accessibility never change. Only the stylesheet does.
          </p>
          <SegmentedControl
            aria-label="Era"
            value={era}
            onValueChange={(value) => {
              if (value) changeEra(value)
            }}
          >
            <SegmentedControlIndicator />
            {eras.map((item) => (
              <SegmentedControlItem key={item.id} value={item.id}>
                <span className="era-year">{item.year}</span>{" "}
                <span className="era-name">{item.name}</span>
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </header>

        <main className="stage" ref={stage}>
          <Player
            era={era}
            onEraChange={changeEra}
            onAbout={() => about.current?.focus()}
          />
        </main>

        <footer className="about" ref={about} tabIndex={-1}>
          <section>
            <h2>
              {current.year} · {current.name}
            </h2>
            <p>{current.note}</p>
          </section>
          <section>
            <h2>What didn't change</h2>
            <p className="proof" role="status">
              {proof
                ? `${label(proof.from)} → ${label(proof.to)}: markup ${proof.before.hash} before, ${proof.after.hash} after. ${
                    proof.before.hash === proof.after.hash
                      ? "Identical"
                      : "Different"
                  } across ${proof.after.count} elements.`
                : "Switch era and this line compares the player's markup before and after."}
            </p>
            <p>
              Every control is a UI SDK behavior. Every pixel is CSS or inline
              SVG. Every note is synthesised in your browser, and the equalizer
              is ten real filters.
            </p>
          </section>
        </footer>
      </div>
    </EngineContext>
  )
}

export { App }
