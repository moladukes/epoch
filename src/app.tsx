import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from "@ui-sdk/react/segmented-control"
import { useEffect, useState } from "react"
import { flushSync } from "react-dom"
import type { Engine } from "./audio/engine"
import { eraFromHash, eras } from "./eras"
import { Player } from "./player/player"
import { EngineContext } from "./player/use-engine"

function App({ engine }: { engine: Engine }) {
  const [era, setEra] = useState(() => eraFromHash(location.hash))

  const changeEra = (next: string) => {
    if (next === era || !eras.some((item) => item.id === next)) return
    const apply = () => flushSync(() => setEra(next))
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

        <main className="stage">
          <Player era={era} onEraChange={changeEra} />
        </main>
      </div>
    </EngineContext>
  )
}

export { App }
