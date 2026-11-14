import { useShortcut } from "@ui-sdk/react/shortcuts"
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider"
import { Button } from "@ui-sdk/react/button"
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@ui-sdk/react/dialog"
import { Toggle, ToggleIcon } from "@ui-sdk/react/toggle"
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@ui-sdk/react/toolbar"
import { useRef, useState } from "react"
import { formatTime } from "../audio/engine"
import { eras } from "../eras"
import { Display } from "./display"
import { Equalizer } from "./equalizer"
import { Icon } from "./icons"
import { Keys } from "./keys"
import { PlayerMenubar } from "./menus"
import { Playlist } from "./playlist"
import { useEngine, usePlayer } from "./use-engine"
import { KINDS } from "./visualizer"

type Props = {
  era: string
  onEraChange: (era: string) => void
}

const balanceText = (value: number) =>
  value === 0 ? "Centre" : `${Math.abs(value)}% ${value < 0 ? "left" : "right"}`

function Shortcut(props: {
  keys: string
  description: string
  when: () => boolean
  run: () => void
}) {
  useShortcut(props.keys, props.run, {
    description: props.description,
    when: props.when,
  })
  return null
}

function Player({ era, onEraChange }: Props) {
  const engine = useEngine()
  const status = usePlayer((state) => state.status)
  const position = usePlayer((state) => state.position)
  const volume = usePlayer((state) => state.volume)
  const balance = usePlayer((state) => state.balance)
  const muted = usePlayer((state) => state.muted)
  const shuffle = usePlayer((state) => state.shuffle)
  const repeat = usePlayer((state) => state.repeat)
  const track = usePlayer(
    (state) => state.tracks.find((item) => item.id === state.current)!
  )

  const [showEq, setShowEq] = useState(true)
  const [showPl, setShowPl] = useState(true)
  const [remaining, setRemaining] = useState(false)
  const [keysOpen, setKeysOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [viz, setViz] = useState("spectrum")
  const [hotkeys, setHotkeys] = useState(true)
  const [scrub, setScrub] = useState<number | null>(null)
  const [notice, setNotice] = useState("")
  const files = useRef<HTMLInputElement>(null)

  const addFiles = async (list: FileList | null) => {
    const picked = [...(list ?? [])].filter((file) =>
      file.type.startsWith("audio/")
    )
    if (picked.length === 0) return
    const added = await engine.addFiles(picked)
    setNotice(
      added > 0
        ? `Added ${added} ${added === 1 ? "file" : "files"} to the playlist`
        : "Those files couldn't be read as audio"
    )
    if (added > 0) openWindow(setShowPl)
  }

  const nextViz = () =>
    setViz((value) => {
      const index = KINDS.findIndex((item) => item.value === value)
      return KINDS[(index + 1) % KINDS.length]!.value
    })

  const openWindow = (show: (value: boolean) => void) => {
    setCompact(false)
    show(true)
  }

  const closeWindow = (show: (value: boolean) => void, toggle: string) => {
    show(false)
    document.querySelector<HTMLElement>(`[data-window="${toggle}"]`)?.focus()
  }

  const free = () =>
    hotkeys &&
    !document.activeElement?.closest(
      '[role="menu"], [role="menubar"], [role="listbox"]'
    )

  const announcement =
    status === "playing"
      ? `Playing ${track.title}`
      : status === "paused"
        ? "Paused"
        : ""

  return (
    <section
      className="player"
      aria-labelledby="player-title"
      data-status={status}
      data-compact={compact ? "" : undefined}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        void addFiles(event.dataTransfer.files)
      }}
    >
      <Shortcut keys="k" description="Play or pause" when={free} run={engine.toggle} />
      <Shortcut keys="s" description="Stop" when={free} run={engine.stop} />
      <Shortcut keys="j" description="Back 5 seconds" when={free} run={() => engine.skip(-5)} />
      <Shortcut keys="l" description="Forward 5 seconds" when={free} run={() => engine.skip(5)} />
      <Shortcut
        keys="m"
        description="Mute"
        when={free}
        run={() => engine.setMuted(!engine.getState().muted)}
      />
      <Shortcut keys="v" description="Change the visualizer" when={free} run={nextViz} />
      <Shortcut
        keys="e"
        description="Show or hide the equalizer"
        when={free}
        run={() => (showEq && !compact ? setShowEq(false) : openWindow(setShowEq))}
      />
      <Shortcut
        keys="p"
        description="Show or hide the playlist"
        when={free}
        run={() => (showPl && !compact ? setShowPl(false) : openWindow(setShowPl))}
      />
      <Shortcut keys="[" description="Previous track" when={free} run={engine.previous} />
      <Shortcut keys="]" description="Next track" when={free} run={engine.next} />
      {eras.map((item, index) => (
        <Shortcut
          key={item.id}
          keys={String(index + 1)}
          description={`Switch to ${item.year} ${item.name}`}
          when={free}
          run={() => onEraChange(item.id)}
        />
      ))}

      <div className="deck">
        <div className="titlebar">
          <span className="grip" aria-hidden="true" />
          <h2 id="player-title" className="wordmark">
            Epoch
          </h2>
          <span className="grip" aria-hidden="true" />
          <Toggle
            className="shade"
            aria-label="Compact"
            pressed={compact}
            onPressedChange={setCompact}
          >
            <ToggleIcon>
              <Icon name="compact" />
            </ToggleIcon>
          </Toggle>
        </div>

        <PlayerMenubar
          era={era}
          onEraChange={onEraChange}
          showEq={showEq && !compact}
          onShowEqChange={(show) => (show ? openWindow(setShowEq) : setShowEq(false))}
          showPl={showPl && !compact}
          onShowPlChange={(show) => (show ? openWindow(setShowPl) : setShowPl(false))}
          remaining={remaining}
          onRemainingChange={setRemaining}
          onKeys={() => setKeysOpen(true)}
          viz={viz}
          onVizChange={setViz}
          compact={compact}
          onCompactChange={setCompact}
          hotkeys={hotkeys}
          onHotkeysChange={setHotkeys}
          onAddFiles={() => files.current?.click()}
        />

        <Display
          viz={viz}
          onVizNext={nextViz}
          remaining={remaining}
          onRemainingChange={setRemaining}
        />

        <Slider
          className="seek"
          min={0}
          max={track.duration}
          step={1}
          largeStep={10}
          value={scrub ?? Math.min(position, track.duration)}
          format={formatTime}
          onValueChange={(value, details) => {
            const seconds = value as number
            if (details.reason === "drag" || details.reason === "track-press") {
              setScrub(seconds)
            } else {
              engine.seek(seconds)
            }
          }}
          onValueCommit={(value) => {
            if (scrub !== null) engine.seek(value as number)
            setScrub(null)
          }}
        >
          <SliderControl>
            <SliderTrack>
              <SliderIndicator />
              <SliderThumb aria-label="Seek" />
            </SliderTrack>
          </SliderControl>
        </Slider>

        <div className="controls">
          <Toolbar aria-label="Transport">
            <ToolbarButton aria-label="Previous track" onClick={engine.previous}>
              <Icon name="previous" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Play"
              data-action="play"
              onClick={engine.play}
            >
              <Icon name="play" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Pause"
              data-action="pause"
              onClick={engine.pause}
            >
              <Icon name="pause" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Stop"
              data-action="stop"
              onClick={engine.stop}
            >
              <Icon name="stop" />
            </ToolbarButton>
            <ToolbarButton aria-label="Next track" onClick={engine.next}>
              <Icon name="next" />
            </ToolbarButton>
            <ToolbarButton
              aria-label="Open files"
              data-action="open"
              onClick={() => files.current?.click()}
            >
              <Icon name="eject" />
            </ToolbarButton>
            <ToolbarSeparator />
            <Toggle
              aria-label="Shuffle"
              pressed={shuffle}
              onPressedChange={engine.setShuffle}
            >
              <ToggleIcon>
                <Icon name="shuffle" />
              </ToggleIcon>
            </Toggle>
            <Toggle
              aria-label="Repeat"
              pressed={repeat}
              onPressedChange={engine.setRepeat}
            >
              <ToggleIcon>
                <Icon name="repeat" />
              </ToggleIcon>
            </Toggle>
          </Toolbar>

          <div className="levels">
            <Toggle
              className="mute"
              aria-label="Mute"
              pressed={muted}
              onPressedChange={engine.setMuted}
            >
              <ToggleIcon>
                <Icon name={muted ? "muted" : "volume"} />
              </ToggleIcon>
            </Toggle>
            <Slider
              className="volume"
              min={0}
              max={100}
              step={1}
              value={volume}
              format={(value) => (muted ? "Muted" : `${value}%`)}
              onValueChange={(value) => engine.setVolume(value as number)}
            >
              <SliderControl>
                <SliderTrack>
                  <SliderIndicator />
                  <SliderThumb aria-label="Volume" />
                </SliderTrack>
              </SliderControl>
            </Slider>
            <span className="level-label" aria-hidden="true">
              Bal
            </span>
            <Slider
              className="balance"
              min={-100}
              max={100}
              step={5}
              largeStep={25}
              value={balance}
              format={balanceText}
              onValueChange={(value) => engine.setBalance(value as number)}
            >
              <SliderControl>
                <SliderTrack>
                  <SliderThumb aria-label="Balance" />
                </SliderTrack>
              </SliderControl>
            </Slider>
          </div>

          <div className="windows">
            <Toggle
              aria-label="Equalizer window"
              data-window="eq"
              pressed={showEq && !compact}
              onPressedChange={(show) =>
                show ? openWindow(setShowEq) : setShowEq(false)
              }
            >
              EQ
            </Toggle>
            <Toggle
              aria-label="Playlist window"
              data-window="pl"
              pressed={showPl && !compact}
              onPressedChange={(show) =>
                show ? openWindow(setShowPl) : setShowPl(false)
              }
            >
              PL
            </Toggle>
          </div>
        </div>
      </div>

      <section
        className="window eq-window"
        aria-labelledby="eq-title"
        hidden={compact || !showEq}
      >
        <div className="window-bar">
          <span className="grip" aria-hidden="true" />
          <h3 id="eq-title" className="window-title">
            Equalizer
          </h3>
          <span className="grip" aria-hidden="true" />
          <Button
            className="window-close"
            aria-label="Close equalizer"
            onClick={() => closeWindow(setShowEq, "eq")}
          >
            <Icon name="close" />
          </Button>
        </div>
        <Equalizer />
      </section>

      <section
        className="window pl-window"
        aria-labelledby="pl-title"
        hidden={compact || !showPl}
      >
        <div className="window-bar">
          <span className="grip" aria-hidden="true" />
          <h3 id="pl-title" className="window-title">
            Playlist
          </h3>
          <span className="grip" aria-hidden="true" />
          <Button
            className="window-close"
            aria-label="Close playlist"
            onClick={() => closeWindow(setShowPl, "pl")}
          >
            <Icon name="close" />
          </Button>
        </div>
        <Playlist onAddFiles={() => files.current?.click()} />
      </section>

      <Dialog open={keysOpen} onOpenChange={(open) => setKeysOpen(open)}>
        <DialogBackdrop />
        <DialogContent>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <Keys />
          <DialogClose className="push">Close</DialogClose>
        </DialogContent>
      </Dialog>

      <input
        ref={files}
        type="file"
        accept="audio/*"
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void addFiles(event.target.files)
          event.target.value = ""
        }}
      />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <p className="sr-only" aria-live="polite">
        {notice}
      </p>
    </section>
  )
}

export { Player }
