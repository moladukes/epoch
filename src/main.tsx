import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles/index.css"
import { App } from "./app"
import { createEngine } from "./audio/engine"
import "./agent"

const engine = createEngine()
setTimeout(engine.warm, 300)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App engine={engine} />
  </StrictMode>
)
