import { createAgent, registerTools } from "@ui-sdk/react/agent"

const agent = createAgent()

registerTools(agent, { allow: () => true })

declare global {
  interface Window {
    epochAgent: typeof agent
  }
}

window.epochAgent = agent

export { agent }
