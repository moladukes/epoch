import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroupLabel,
  MenuItem,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { Menubar } from "@ui-sdk/react/menubar"
import { CUSTOM } from "../audio/presets"
import { eras } from "../eras"
import { PresetItems } from "./equalizer"
import { useEngine, usePlayer } from "./use-engine"
import { KINDS } from "./visualizer"

type Props = {
  era: string
  onEraChange: (era: string) => void
  showEq: boolean
  onShowEqChange: (show: boolean) => void
  showPl: boolean
  onShowPlChange: (show: boolean) => void
  remaining: boolean
  onRemainingChange: (remaining: boolean) => void
  onKeys: () => void
  viz: string
  onVizChange: (viz: string) => void
  compact: boolean
  onCompactChange: (compact: boolean) => void
  hotkeys: boolean
  onHotkeysChange: (hotkeys: boolean) => void
  onAddFiles: () => void
  onAbout: () => void
}

function PlayerMenubar(props: Props) {
  const engine = useEngine()
  const playing = usePlayer((state) => state.status === "playing")
  const shuffle = usePlayer((state) => state.shuffle)
  const repeat = usePlayer((state) => state.repeat)
  const eqOn = usePlayer((state) => state.eqOn)
  const autoEq = usePlayer((state) => state.autoEq)
  const muted = usePlayer((state) => state.muted)
  const preset = usePlayer((state) => state.preset)
  const hasAdded = usePlayer((state) => state.tracks.some((t) => t.added))

  return (
    <Menubar aria-label="Player menu">
      <Menu>
        <MenuTrigger>File</MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={props.onAddFiles}>Open files…</MenuItem>
          <MenuItem disabled={!hasAdded} onSelect={engine.clearFiles}>
            Remove added files
          </MenuItem>
          <MenuItem onSelect={engine.resetTracks}>Reset playlist</MenuItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger>Playback</MenuTrigger>
        <MenuContent>
          <MenuItem shortcut="k" onSelect={engine.toggle}>
            {playing ? "Pause" : "Play"}
          </MenuItem>
          <MenuItem shortcut="s" onSelect={engine.stop}>
            Stop
          </MenuItem>
          <MenuSeparator />
          <MenuItem shortcut="[" onSelect={engine.previous}>
            Previous track
          </MenuItem>
          <MenuItem shortcut="]" onSelect={engine.next}>
            Next track
          </MenuItem>
          <MenuSeparator />
          <MenuCheckboxItem
            value="shuffle"
            checked={shuffle}
            onCheckedChange={engine.setShuffle}
          >
            <MenuItemIndicator keepMounted />
            Shuffle
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="repeat"
            checked={repeat}
            onCheckedChange={engine.setRepeat}
          >
            <MenuItemIndicator keepMounted />
            Repeat
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="mute"
            checked={muted}
            onCheckedChange={engine.setMuted}
          >
            <MenuItemIndicator keepMounted />
            Mute
            <MenuShortcut>M</MenuShortcut>
          </MenuCheckboxItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger>Options</MenuTrigger>
        <MenuContent>
          <MenuCheckboxItem
            value="equalizer"
            checked={eqOn}
            onCheckedChange={engine.setEqOn}
          >
            <MenuItemIndicator keepMounted />
            Equalizer
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="auto"
            checked={autoEq}
            onCheckedChange={engine.setAutoEq}
          >
            <MenuItemIndicator keepMounted />
            Auto preset per track
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuRadioGroup
            value={preset === CUSTOM ? null : preset}
            onValueChange={engine.setPreset}
          >
            <MenuGroupLabel>Preset</MenuGroupLabel>
            <PresetItems />
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuCheckboxItem
            value="remaining"
            checked={props.remaining}
            onCheckedChange={props.onRemainingChange}
          >
            <MenuItemIndicator keepMounted />
            Show time remaining
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="hotkeys"
            checked={props.hotkeys}
            onCheckedChange={props.onHotkeysChange}
          >
            <MenuItemIndicator keepMounted />
            Single-key shortcuts
          </MenuCheckboxItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger>View</MenuTrigger>
        <MenuContent>
          <MenuRadioGroup value={props.era} onValueChange={props.onEraChange}>
            <MenuGroupLabel>Era</MenuGroupLabel>
            {eras.map((era, index) => (
              <MenuRadioItem
                key={era.id}
                value={era.id}
                closeOnSelect
              >
                <MenuItemIndicator keepMounted />
                {era.year} {era.name}
                <MenuShortcut>{index + 1}</MenuShortcut>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuRadioGroup value={props.viz} onValueChange={props.onVizChange}>
            <MenuGroupLabel>Visualizer</MenuGroupLabel>
            {KINDS.map((kind) => (
              <MenuRadioItem key={kind.value} value={kind.value} closeOnSelect>
                <MenuItemIndicator keepMounted />
                {kind.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuCheckboxItem
            value="eq-window"
            checked={props.showEq}
            onCheckedChange={props.onShowEqChange}
          >
            <MenuItemIndicator keepMounted />
            Equalizer window
            <MenuShortcut>E</MenuShortcut>
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="pl-window"
            checked={props.showPl}
            onCheckedChange={props.onShowPlChange}
          >
            <MenuItemIndicator keepMounted />
            Playlist window
            <MenuShortcut>P</MenuShortcut>
          </MenuCheckboxItem>
          <MenuCheckboxItem
            value="compact"
            checked={props.compact}
            onCheckedChange={props.onCompactChange}
          >
            <MenuItemIndicator keepMounted />
            Compact
          </MenuCheckboxItem>
        </MenuContent>
      </Menu>
      <Menu>
        <MenuTrigger>Help</MenuTrigger>
        <MenuContent>
          <MenuItem onSelect={props.onKeys}>Keyboard shortcuts</MenuItem>
          <MenuItem onSelect={props.onAbout}>About this demo</MenuItem>
        </MenuContent>
      </Menu>
    </Menubar>
  )
}

export { PlayerMenubar }
