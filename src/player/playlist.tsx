import { Button } from "@ui-sdk/react/button"
import { Listbox, ListboxItem } from "@ui-sdk/react/listbox"
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import { formatTime } from "../audio/engine"
import { Icon } from "./icons"
import { useEngine, usePlayer } from "./use-engine"

function Playlist({ onAddFiles }: { onAddFiles: () => void }) {
  const engine = useEngine()
  const tracks = usePlayer((state) => state.tracks)
  const current = usePlayer((state) => state.current)
  const position = usePlayer((state) => state.position)
  const index = tracks.findIndex((track) => track.id === current)
  const total = tracks.reduce((sum, track) => sum + track.duration, 0)
  const hasAdded = tracks.some((track) => track.added)

  return (
    <div className="playlist">
      <Listbox
        aria-label="Playlist"
        activation="manual"
        value={current}
        onValueChange={(id) => {
          if (typeof id === "string") engine.select(id, { play: true })
        }}
      >
        {tracks.map((track, order) => (
          <ListboxItem key={track.id} value={track.id} label={track.title}>
            <span className="track-index">{order + 1}.</span>{" "}
            <span className="track-title">{track.title}</span>{" "}
            <span className="track-artist">{track.artist}</span>{" "}
            <span className="track-length">{formatTime(track.duration)}</span>
          </ListboxItem>
        ))}
      </Listbox>
      <div className="playlist-bar">
        <Button className="push" aria-label="Add files" onClick={onAddFiles}>
          <Icon name="plus" />
          <span className="push-text" aria-hidden="true">
            Add
          </span>
        </Button>
        <Button
          className="push"
          aria-label="Remove track"
          disabled={tracks.length < 2}
          onClick={() => engine.removeTrack(current)}
        >
          <Icon name="minus" />
          <span className="push-text" aria-hidden="true">
            Remove
          </span>
        </Button>
        <Menu>
          <MenuTrigger className="push" aria-label="Sort playlist">
            <Icon name="sort" />
            <span className="push-text" aria-hidden="true">
              Sort
            </span>
          </MenuTrigger>
          <MenuContent side="top" align="start" sideOffset={4}>
            <MenuItem onSelect={() => engine.sortTracks("title")}>
              Sort by title
            </MenuItem>
            <MenuItem onSelect={() => engine.sortTracks("duration")}>
              Sort by length
            </MenuItem>
            <MenuItem onSelect={engine.reverseTracks}>Reverse order</MenuItem>
            <MenuSeparator />
            <MenuItem
              disabled={index <= 0}
              onSelect={() => engine.moveTrack(current, -1)}
            >
              Move track up
            </MenuItem>
            <MenuItem
              disabled={index >= tracks.length - 1}
              onSelect={() => engine.moveTrack(current, 1)}
            >
              Move track down
            </MenuItem>
          </MenuContent>
        </Menu>
        <Menu>
          <MenuTrigger className="push" aria-label="Playlist options">
            <Icon name="list" />
            <span className="push-text" aria-hidden="true">
              List
            </span>
          </MenuTrigger>
          <MenuContent side="top" align="start" sideOffset={4}>
            <MenuItem onSelect={onAddFiles}>Add files…</MenuItem>
            <MenuItem disabled={!hasAdded} onSelect={engine.clearFiles}>
              Remove added files
            </MenuItem>
            <MenuSeparator />
            <MenuItem onSelect={engine.resetTracks}>Reset playlist</MenuItem>
          </MenuContent>
        </Menu>
        <p className="playlist-status">
          <span className="status-count">
            Track {index + 1} of {tracks.length}
          </span>{" "}
          <span className="status-time">
            {formatTime(position)} / {formatTime(total)}
          </span>
        </p>
      </div>
    </div>
  )
}

export { Playlist }
