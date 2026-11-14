import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createAgent } from "@ui-sdk/react/agent"
import { checkPattern } from "@ui-sdk/core/testing"
import { afterEach, beforeEach, expect, test } from "vitest"
import { App } from "./app"
import { createEngine, type Engine } from "./audio/engine"
import { eras } from "./eras"
import { signature } from "./signature"

const agent = createAgent()
let engine: Engine

beforeEach(() => {
  location.hash = ""
  engine = createEngine()
})

afterEach(() => engine.destroy())

const settle = () => act(() => new Promise((r) => setTimeout(r, 0)))

const setup = async () => {
  const user = userEvent.setup()
  const view = render(<App engine={engine} />)
  await settle()
  const player = screen.getByRole("region", { name: "Epoch" })
  return { user, view, player }
}

test("every era renders the same player markup", async () => {
  const { user, player } = await setup()
  const page = player.closest<HTMLElement>("[data-era]")!
  const seen = new Set<string>()

  for (const era of eras) {
    await user.click(
      screen.getByRole("radio", { name: `${era.year} ${era.name}` })
    )
    expect(page.dataset.era).toBe(era.id)
    seen.add(signature(player).hash)
  }

  expect(seen.size).toBe(1)
})

test("the transport buttons and toggles drive the engine", async () => {
  const { user } = await setup()
  const transport = within(screen.getByRole("toolbar", { name: "Transport" }))

  for (const name of ["Previous track", "Play", "Pause", "Stop", "Next track"]) {
    expect(transport.getByRole("button", { name })).toBeTruthy()
  }

  await user.click(transport.getByRole("button", { name: "Play" }))
  expect(engine.getState().status).toBe("playing")
  await user.click(transport.getByRole("button", { name: "Pause" }))
  expect(engine.getState().status).toBe("paused")
  await user.click(transport.getByRole("button", { name: "Next track" }))
  expect(engine.getState().current).toBe("six-four-sunday")
  await user.click(transport.getByRole("button", { name: "Stop" }))
  expect(engine.getState().status).toBe("stopped")

  const shuffle = transport.getByRole("button", { name: "Shuffle" })
  expect(shuffle.getAttribute("aria-pressed")).toBe("false")
  shuffle.focus()
  await user.keyboard(" ")
  expect(engine.getState().shuffle).toBe(true)
  expect(shuffle.getAttribute("aria-pressed")).toBe("true")

  const repeat = transport.getByRole("button", { name: "Repeat" })
  repeat.focus()
  await user.keyboard(" ")
  expect(engine.getState().repeat).toBe(false)
})

test("the toolbar is one tab stop and arrows move inside it", async () => {
  const { user } = await setup()
  const toolbar = screen.getByRole("toolbar", { name: "Transport" })
  const buttons = within(toolbar).getAllByRole("button")

  expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1)
  buttons[0]!.focus()
  await user.keyboard("{ArrowRight}")
  expect(document.activeElement).toBe(buttons[1])
  await user.keyboard("{End}")
  expect(document.activeElement).toBe(buttons.at(-1))
  await user.keyboard("{ArrowLeft}")
  expect(document.activeElement).toBe(buttons.at(-2))
  await checkPattern(toolbar, "toolbar")
})

test("sliders are named, report readable values and move with keys", async () => {
  const { user } = await setup()

  const volume = screen.getByRole("slider", { name: "Volume" })
  expect(volume.getAttribute("aria-valuetext")).toBe("70%")
  volume.focus()
  await user.keyboard("{ArrowRight}{ArrowRight}")
  expect(engine.getState().volume).toBe(72)
  await user.keyboard("{Home}")
  expect(engine.getState().volume).toBe(0)

  const balance = screen.getByRole("slider", { name: "Balance" })
  expect(balance.getAttribute("aria-valuetext")).toBe("Centre")
  balance.focus()
  await user.keyboard("{ArrowLeft}")
  expect(engine.getState().balance).toBe(-5)
  expect(balance.getAttribute("aria-valuetext")).toBe("5% left")

  const bass = screen.getByRole("slider", { name: "64 Hz" })
  expect(bass.getAttribute("aria-orientation")).toBe("vertical")
  bass.focus()
  await user.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}")
  expect(engine.getState().bands[1]).toBe(3)
  expect(bass.getAttribute("aria-valuetext")).toBe("+3 dB")
  expect(engine.getState().preset).toBe("Custom")

  const seek = screen.getByRole("slider", { name: "Seek" })
  seek.focus()
  await user.keyboard("{PageUp}")
  expect(engine.getState().position).toBe(10)
  expect(seek.getAttribute("aria-valuetext")).toBe("0:10")
})

test("menus run their actions and return focus to the trigger", async () => {
  const { user, player } = await setup()
  const page = player.closest<HTMLElement>("[data-era]")!
  const bar = screen.getByRole("menubar", { name: "Player menu" })
  const view = within(bar).getByRole("menuitem", { name: "View" })

  await user.click(view)
  await user.click(screen.getByRole("menuitemradio", { name: /1997 Bitmap/ }))
  expect(page.dataset.era).toBe("1997")
  expect(document.activeElement).toBe(view)

  await user.click(within(bar).getByRole("menuitem", { name: "Options" }))
  await user.click(screen.getByRole("menuitemradio", { name: "Bass boost" }))
  expect(engine.getState().preset).toBe("Bass boost")
  expect(engine.getState().bands[0]).toBe(8)

  const playback = within(bar).getByRole("menuitem", { name: "Playback" })
  playback.focus()
  await user.keyboard("{ArrowDown}")
  expect(screen.getByRole("menuitem", { name: /^Play( |$)/ })).toBeTruthy()
  await user.keyboard("{Escape}")
  expect(document.activeElement).toBe(playback)
  expect(engine.getState().status).toBe("stopped")

  const help = within(bar).getByRole("menuitem", { name: "Help" })
  await user.click(help)
  await user.click(screen.getByRole("menuitem", { name: "Keyboard shortcuts" }))
  await settle()
  const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" })
  expect(within(dialog).getByText("Play or pause")).toBeTruthy()
  await user.click(within(dialog).getByRole("button", { name: "Close" }))
  await settle()
  expect(screen.queryByRole("dialog")).toBeNull()
})

test("the equalizer and playlist windows open, close and edit the list", async () => {
  const { user } = await setup()

  const eq = screen.getByRole("region", { name: "Equalizer" })
  expect(eq.querySelector(".graph-line")?.getAttribute("d")).toMatch(/^M0,50 /)
  const bass = screen.getByRole("slider", { name: "32 Hz" })
  bass.focus()
  await user.keyboard("{End}")
  expect(eq.querySelector(".graph-line")?.getAttribute("d")).toMatch(/^M0,0 /)

  await user.click(screen.getByRole("button", { name: "Sort playlist" }))
  await user.click(screen.getByRole("menuitem", { name: "Sort by title" }))
  expect(engine.getState().tracks[0]!.id).toBe("candy-paint")
  await user.click(screen.getByRole("button", { name: "Sort playlist" }))
  await user.click(screen.getByRole("menuitem", { name: "Move track down" }))
  expect(engine.getState().tracks[2]!.id).toBe("corner-store-cipher")
  await user.click(screen.getByRole("button", { name: "Playlist options" }))
  await user.click(screen.getByRole("menuitem", { name: "Reset playlist" }))
  expect(engine.getState().tracks.map((track) => track.id)).toEqual([
    "corner-store-cipher",
    "six-four-sunday",
    "two-way-pager",
    "candy-paint",
    "rewind-selecta",
  ])

  const list = screen.getByRole("listbox", { name: "Playlist" })
  const options = within(list).getAllByRole("option")
  expect(options).toHaveLength(5)
  expect(options[0]!.getAttribute("aria-selected")).toBe("true")

  options[0]!.focus()
  await user.keyboard("{ArrowDown}{ArrowDown}")
  expect(engine.getState().current).toBe("corner-store-cipher")
  await user.keyboard("{Enter}")
  expect(engine.getState().current).toBe("two-way-pager")
  expect(engine.getState().status).toBe("playing")
  expect(screen.getByText("Track 3 of 5")).toBeTruthy()

  await user.click(screen.getByRole("button", { name: "Remove track" }))
  expect(engine.getState().tracks.map((track) => track.id)).not.toContain(
    "two-way-pager"
  )
  expect(engine.getState().current).toBe("candy-paint")
  expect(engine.getState().status).toBe("playing")

  const toggle = screen.getByRole("button", { name: "Playlist window" })
  expect(toggle.getAttribute("aria-pressed")).toBe("true")
  await user.click(screen.getByRole("button", { name: "Close playlist" }))
  expect(screen.queryByRole("listbox")).toBeNull()
  expect(toggle.getAttribute("aria-pressed")).toBe("false")
  expect(document.activeElement).toBe(toggle)
  toggle.blur()
  await user.keyboard("p")
  expect(screen.getByRole("listbox", { name: "Playlist" })).toBeTruthy()
  await user.click(screen.getByRole("button", { name: "Equalizer window" }))
  expect(screen.queryByRole("region", { name: "Equalizer" })).toBeNull()

  const compact = screen.getByRole("button", { name: "Compact" })
  await user.click(compact)
  expect(compact.getAttribute("aria-pressed")).toBe("true")
  expect(screen.queryByRole("listbox")).toBeNull()
  await user.click(compact)
  expect(screen.getByRole("listbox", { name: "Playlist" })).toBeTruthy()

  const time = screen.getByRole("button", { name: "Time elapsed" })
  await user.click(time)
  expect(screen.getByRole("button", { name: "Time remaining" })).toBeTruthy()
  expect(time.textContent).toMatch(/^-\d:\d\d/)
})

test("single-key shortcuts work and can be switched off", async () => {
  const { user, player } = await setup()
  const page = player.closest<HTMLElement>("[data-era]")!

  await user.keyboard("k")
  expect(engine.getState().status).toBe("playing")
  await user.keyboard("]")
  expect(engine.getState().current).toBe("six-four-sunday")
  await user.keyboard("5")
  expect(page.dataset.era).toBe("next")

  await user.click(screen.getByRole("menuitem", { name: "Options" }))
  await user.click(
    screen.getByRole("menuitemcheckbox", { name: "Single-key shortcuts" })
  )
  await user.keyboard("{Escape}")
  await user.keyboard("s")
  expect(engine.getState().status).toBe("playing")
})

test("mute, the visualizer and auto presets are wired", async () => {
  const { user } = await setup()

  const mute = screen.getByRole("button", { name: "Mute" })
  const volume = screen.getByRole("slider", { name: "Volume" })
  await user.click(mute)
  expect(engine.getState().muted).toBe(true)
  expect(mute.getAttribute("aria-pressed")).toBe("true")
  expect(volume.getAttribute("aria-valuetext")).toBe("Muted")
  await user.keyboard("m")
  expect(engine.getState().muted).toBe(false)
  await user.keyboard("m")
  volume.focus()
  await user.keyboard("{ArrowRight}")
  expect(engine.getState()).toMatchObject({ muted: false, volume: 71 })

  await user.click(screen.getByRole("button", { name: "Visualizer: Spectrum" }))
  const scope = screen.getByRole("button", { name: "Visualizer: Oscilloscope" })
  scope.blur()
  await user.keyboard("v")
  expect(screen.getByRole("button", { name: "Visualizer: Off" })).toBeTruthy()
  await user.click(screen.getByRole("menuitem", { name: "View" }))
  const wave = screen.getByRole("menuitemradio", { name: "Oscilloscope" })
  expect(wave.getAttribute("aria-checked")).toBe("false")
  await user.click(wave)
  expect(
    screen.getByRole("button", { name: "Visualizer: Oscilloscope" })
  ).toBeTruthy()

  const auto = screen.getByRole("button", { name: "Auto" })
  await user.click(auto)
  expect(auto.getAttribute("aria-pressed")).toBe("true")
  expect(engine.getState().preset).toBe("Loudness")
  await user.click(screen.getByRole("button", { name: "Next track" }))
  expect(engine.getState().preset).toBe("Bass boost")
  expect(engine.getState().bands[0]).toBe(8)
})

test("an agent can find and operate every control", async () => {
  await setup()

  const components = agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== "more")
  for (const entry of components) {
    expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy()
  }
  const labels = components.map((entry) => entry.label)
  for (const label of [
    "Era",
    "Compact",
    "Player menu",
    "Seek",
    "Transport",
    "Shuffle",
    "Repeat",
    "Mute",
    "Volume",
    "Balance",
    "Visualizer: Spectrum",
    "Time elapsed",
    "Equalizer window",
    "Playlist window",
    "Close equalizer",
    "Close playlist",
    "Equalizer on",
    "Auto",
    "Add files",
    "Remove track",
    "Sort playlist",
    "Playlist options",
    "Presets",
    "Preamp",
    "32 Hz",
    "1 kHz",
    "16 kHz",
  ]) {
    expect(labels, `${label} is missing from the snapshot`).toContain(label)
  }

  const result = await agent.act({
    steps: [
      { ref: "Era", action: "setValue", args: ["next"] },
      { ref: "Volume", action: "setValue", args: [40] },
      { ref: "Balance", action: "setValue", args: [-25] },
      { ref: "32 Hz", action: "setValue", args: [9] },
      { ref: "1 kHz", action: "setValue", args: [-4] },
      { ref: "16 kHz", action: "setValue", args: [6] },
      { ref: "Preamp", action: "setValue", args: [-3] },
      { ref: "Shuffle", action: "setPressed", args: [true] },
      { ref: "Equalizer on", action: "setPressed", args: [false] },
      { ref: "Seek", action: "setValue", args: [20] },
      { ref: "Transport", action: "press", args: ["Play"] },
      { ref: "Equalizer window", action: "setPressed", args: [false] },
    ],
  })
  expect(result.ok, result.error?.message).toBe(true)
  await settle()

  const state = engine.getState()
  expect(state).toMatchObject({
    volume: 40,
    balance: -25,
    preamp: -3,
    shuffle: true,
    eqOn: false,
    status: "playing",
  })
  expect([state.bands[0], state.bands[5], state.bands[9]]).toEqual([9, -4, 6])
  expect(Math.floor(state.position)).toBeGreaterThanOrEqual(20)
  expect(
    screen
      .getByRole("region", { name: "Epoch" })
      .closest<HTMLElement>("[data-era]")!.dataset.era
  ).toBe("next")
  expect(screen.queryByRole("region", { name: "Equalizer" })).toBeNull()

  const playlist = agent
    .snapshot()
    .find((entry) => entry.label === "Playlist" && !entry.offPage)
  const items = (playlist?.items ?? []) as { value: string; label: string }[]
  const track = items.find((item) => item.label.includes("Candy Paint"))
  expect(track, "Candy Paint is missing from the playlist's items").toBeTruthy()
  const pick = await agent.act({
    steps: [{ ref: "Playlist", action: "setValue", args: [track!.value] }],
  })
  expect(pick.ok, pick.error?.message).toBe(true)
  expect(engine.getState().current).toBe("candy-paint")
})
