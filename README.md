# Epoch

**Live demo: https://moladukes.github.io/epoch/**

One working music player, drawn in five eras of interface design. It is an experiment in what Vercel's [UI SDK](https://github.com/vercel-labs/ui) makes possible when an AI agent builds the interface.

## The idea

UI SDK ships interface behaviors with no appearance. A menu bar, a toolbar, a slider, a listbox, a dialog: each one handles the keyboard, focus and accessibility, and renders no styles at all.

That split changes what is cheap. The behavior is the part that is slow to get right by hand, and it now comes finished. The look becomes a free variable, so an agent can draw anything on top without breaking what is underneath.

Epoch tests that with a deliberately awkward case: the dense media players of the late 90s and early 2000s. There is a running joke that neither designers nor coding agents can build those interfaces any more. So an agent built one player from UI SDK behaviors, then skinned it five times.

| Era | Open it | What it draws |
| --- | --- | --- |
| 1997 Bitmap | [#1997](https://moladukes.github.io/epoch/#1997) | Grey bevels, navy title bars, a green phosphor display, dithered pressed states |
| 2003 Brushed | [#2003](https://moladukes.github.io/epoch/#2003) | Three brushed-metal modules, a blue dot-matrix LCD, chrome transport discs, pill switches with LEDs |
| 2007 Gloss | [#2007](https://moladukes.github.io/epoch/#2007) | Blurred glass over an aurora wallpaper, piano black, an aqua orb that glows with the music |
| 2026 Flat | [#2026](https://moladukes.github.io/epoch/#2026) | Neutral surfaces, hairlines, system type, light and dark mode |
| Next: Signal | [#next](https://moladukes.github.io/epoch/#next) | An invented one. The window is the visualizer, and the ten equalizer sliders are drawn as a single curve |

The first four show that the past can be rebuilt. The fifth is the point: the same ten sliders that look like a 2003 equalizer can also be a curve nobody has shipped before, with the same keyboard support, because the behavior was never tied to the picture.

## What stays the same

Switching era changes one attribute, `data-era`, on the page. Nothing else.

- **Markup.** The player's DOM is the same 318 elements in every era. A test hashes it in all five and asserts the hashes match.
- **Keyboard.** The same 33 tab stops in every era. Arrow keys move inside the menu bar, the transport and the playlist. Sliders take arrows, Page Up and Down, Home and End. Closing a window hands focus back to the button that reopens it.
- **Accessibility.** Every control has a name. Sliders report readable values such as `0:42`, `5% left` and `+3 dB`. Track changes are announced.
- **Agents.** The same controls are exposed through UI SDK's agent bridge, so an agent can operate the player by name instead of clicking pixels. Try it in the browser console on the demo:

```js
await epochAgent.act({
  steps: [
    { ref: "Era", action: "setValue", args: ["next"] },
    { ref: "32 Hz", action: "setValue", args: [9] },
    { ref: "64 Hz", action: "setValue", args: [6] },
    { ref: "Transport", action: "press", args: ["Play"] },
  ],
})
```

## What the player does

It is a real player, not a picture of one.

- **Main window:** time elapsed or remaining, bitrate and sample-rate readouts, a scrolling title, and a visualizer with spectrum and oscilloscope modes. Seek, transport, open files, shuffle, repeat, mute, volume and balance.
- **Equalizer window:** a preamp and ten bands, six presets, Auto (a preset per track), and a graph of the response curve that follows the sliders.
- **Playlist window:** play, add your own files, remove, sort, reorder and reset.
- **Menus and keys:** everything is also in the menu bar, and most of it has a single-key shortcut. Help → Keyboard shortcuts lists them.

## How it is built

- **Behaviors:** `@ui-sdk/react` Menubar, Menu, Toolbar, Toggle, Slider (14 of them), Listbox, Dialog, Button and Segmented Control, plus its shortcuts hook and agent bridge.
- **Skins:** one stylesheet per era in [src/styles/](src/styles/), roughly 500 to 1,020 lines each. No images, no icon fonts, no web fonts. Icons and the seven-segment digits are inline SVG, and the visualizer is a canvas that takes its colors and drawing style from CSS variables the skin sets.
- **Audio:** Web Audio. The equalizer is ten real filters.
- **Music:** five original instrumentals in the styles of the period, written as code in [src/audio/synth.ts](src/audio/synth.ts) and synthesised in the browser in about a second each. The repo holds no audio files and no samples.

| Track | Style |
| --- | --- |
| Corner Store Cipher | 1994 boom bap: swung drums, dusty electric piano, vinyl crackle |
| Six-Four Sunday | 1993 G-funk: a sliding sine lead over a fat synth bass |
| Two-Way Pager | 2001 club rap: a dry syncopated beat, hard stabs, a plucked riff |
| Candy Paint | 2004 crunk: a tuned 808, rolling hats, brass hits |
| Rewind Selecta | 1999 UK garage: a two-step beat, organ bass, chopped chords |

One limit on the experiment: everything here is composed from components the SDK already ships. UI SDK also lets you define new primitives of your own with `@ui-sdk/core`, and this project does not do that yet. It is the obvious next step.

## Run it

```bash
pnpm install
pnpm dev        # local dev server
pnpm test       # 9 interface tests, including an agent test
pnpm build      # static site in dist/
```

The output is a static page. A workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) tests, builds and publishes it to GitHub Pages on every push to `main`.

## Limits

- Checked in Chrome only. Safari, Firefox, a screen reader pass and phone-width layouts have not been checked.
- Playback of your own dropped files has not been tested.
- UI SDK is in beta (`0.1.0-beta.1`), so its API may change.

## License

MIT. Epoch is an original design. It is not affiliated with Vercel or with any media player it resembles.
