import {
  Menu,
  MenuContent,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@ui-sdk/react/menu"
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider"
import { Toggle } from "@ui-sdk/react/toggle"
import { BANDS, bandLabel, bandShort, CUSTOM, presets } from "../audio/presets"
import { useEngine, usePlayer } from "./use-engine"

const decibels = (value: number) => `${value > 0 ? "+" : ""}${value} dB`

function curve(bands: number[]) {
  const points = bands.map((gain, index) => ({
    x: (index + 0.5) * (100 / bands.length),
    y: 50 - (gain / 12) * 50,
  }))
  const first = points[0]!
  const last = points.at(-1)!
  let path = `M0,${first.y} L${first.x},${first.y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = points[i + 2] ?? p2
    const clampY = (y: number) => Math.min(100, Math.max(0, y))
    path += ` C${p1.x + (p2.x - p0.x) / 6},${clampY(p1.y + (p2.y - p0.y) / 6)} ${
      p2.x - (p3.x - p1.x) / 6
    },${clampY(p2.y - (p3.y - p1.y) / 6)} ${p2.x},${p2.y}`
  }
  return `${path} L100,${last.y}`
}

function Band({
  label,
  short,
  value,
  onChange,
}: {
  label: string
  short: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="band">
      <Slider
        orientation="vertical"
        min={-12}
        max={12}
        step={1}
        largeStep={6}
        value={value}
        format={decibels}
        onValueChange={(next) => onChange(next as number)}
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
            <SliderThumb aria-label={label} />
          </SliderTrack>
        </SliderControl>
      </Slider>
      <span className="band-label" aria-hidden="true">
        {short}
      </span>
    </div>
  )
}

function PresetItems() {
  return Object.keys(presets).map((name) => (
    <MenuRadioItem key={name} value={name} closeOnSelect>
      <MenuItemIndicator keepMounted />
      {name}
    </MenuRadioItem>
  ))
}

function Equalizer() {
  const engine = useEngine()
  const eqOn = usePlayer((state) => state.eqOn)
  const autoEq = usePlayer((state) => state.autoEq)
  const preamp = usePlayer((state) => state.preamp)
  const bands = usePlayer((state) => state.bands)
  const preset = usePlayer((state) => state.preset)
  const line = curve(bands)

  return (
    <div className="eq" data-off={eqOn ? undefined : ""}>
      <div className="eq-actions">
        <Toggle
          aria-label="Equalizer on"
          pressed={eqOn}
          onPressedChange={engine.setEqOn}
        >
          On
        </Toggle>
        <Toggle pressed={autoEq} onPressedChange={engine.setAutoEq}>
          Auto
        </Toggle>
        <svg
          className="eq-graph"
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path className="graph-grid" d="M0,25 H100 M0,50 H100 M0,75 H100" />
          <path
            className="graph-preamp"
            d={`M0,${50 - (preamp / 12) * 46} H100`}
          />
          <path className="graph-line" d={line} />
        </svg>
        <Menu>
          <MenuTrigger>Presets</MenuTrigger>
          <MenuContent side="bottom" align="end" sideOffset={4}>
            <MenuRadioGroup
              value={preset === CUSTOM ? null : preset}
              onValueChange={engine.setPreset}
            >
              <PresetItems />
            </MenuRadioGroup>
          </MenuContent>
        </Menu>
        <span className="preset-name" aria-hidden="true">
          {preset}
        </span>
      </div>
      <div className="eq-bands">
        <Band
          label="Preamp"
          short="Pre"
          value={preamp}
          onChange={engine.setPreamp}
        />
        <div className="eq-scale" aria-hidden="true">
          <span>+12</span>
          <span>0</span>
          <span>−12</span>
        </div>
        <div className="bands">
          <svg
            className="curve"
            aria-hidden="true"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path className="curve-fill" d={`${line} L100,100 L0,100 Z`} />
            <path className="curve-line" d={line} />
          </svg>
          {BANDS.map((hz, index) => (
            <Band
              key={hz}
              label={bandLabel(hz)}
              short={bandShort(hz)}
              value={bands[index] ?? 0}
              onChange={(value) => engine.setBand(index, value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export { Equalizer, PresetItems }
