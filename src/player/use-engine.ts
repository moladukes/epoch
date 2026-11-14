import { createContext, useContext, useSyncExternalStore } from "react"
import type { Engine, PlayerState } from "../audio/engine"

const EngineContext = createContext<Engine | null>(null)

function useEngine() {
  const engine = useContext(EngineContext)
  if (!engine) throw new Error("Render inside an EngineContext provider")
  return engine
}

function usePlayer<T>(select: (state: PlayerState) => T) {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, () => select(engine.getState()))
}

export { EngineContext, useEngine, usePlayer }
