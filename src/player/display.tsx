import { Button } from "@ui-sdk/react/button"
import { formatTime } from "../audio/engine"
import { Segments } from "./segments"
import { usePlayer } from "./use-engine"
import { KINDS, Visualizer } from "./visualizer"

type Props = {
  viz: string
  onVizNext: () => void
  remaining: boolean
  onRemainingChange: (remaining: boolean) => void
}

function Display({ viz, onVizNext, remaining, onRemainingChange }: Props) {
  const status = usePlayer((state) => state.status)
  const loading = usePlayer((state) => state.loading)
  const position = usePlayer((state) => state.position)
  const current = usePlayer((state) => state.current)
  const tracks = usePlayer((state) => state.tracks)
  const eqOn = usePlayer((state) => state.eqOn)
  const shuffle = usePlayer((state) => state.shuffle)
  const repeat = usePlayer((state) => state.repeat)

  const track = tracks.find((item) => item.id === current) ?? tracks[0]!
  const time = remaining
    ? `-${formatTime(Math.max(0, track.duration - position))}`
    : formatTime(position)
  const title = loading
    ? "Synthesising audio…"
    : `${track.artist} — ${track.title}`
  const lamp = (on: boolean) => (on ? "" : undefined)
  const kind = KINDS.find((item) => item.value === viz) ?? KINDS[0]!

  return (
    <div className="display" data-loading={lamp(loading)}>
      <span className="glyph" data-status={status} aria-hidden="true" />
      <Button
        className="time"
        aria-label={remaining ? "Time remaining" : "Time elapsed"}
        onClick={() => onRemainingChange(!remaining)}
      >
        <span className="time-text">{time}</span>
        <Segments text={time} />
      </Button>
      <div className="meta">
        <p className="format">
          <span className="format-item">
            <span className="format-key">kbps</span>{" "}
            <span className="format-value">{track.kbps}</span>
          </span>{" "}
          <span className="format-item">
            <span className="format-key">kHz</span>{" "}
            <span className="format-value">{track.khz}</span>
          </span>{" "}
          <span className="format-mode">
            {track.channels > 1 ? "Stereo" : "Mono"}
          </span>
        </p>
        <div className="lamps" aria-hidden="true">
          <span data-on="">{track.added ? "File" : "Synth"}</span>
          <span data-on={lamp(eqOn)}>EQ</span>
          <span data-on={lamp(shuffle)}>Shuf</span>
          <span data-on={lamp(repeat)}>Rep</span>
        </div>
      </div>
      <Button
        className="viz"
        aria-label={`Visualizer: ${kind.label}`}
        data-kind={kind.value}
        onClick={onVizNext}
      >
        <Visualizer kind={kind.value} />
        <span className="viz-name" aria-hidden="true">
          {kind.label}
        </span>
      </Button>
      <div className="title">
        <span className="marquee" key={title}>
          <span>{title}</span>
          <span aria-hidden="true">{title}</span>
        </span>
      </div>
    </div>
  )
}

export { Display }
