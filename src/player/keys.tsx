const KEYS: [string[], string][] = [
  [["K"], "Play or pause"],
  [["S"], "Stop"],
  [["J", "L"], "Back or forward 5 seconds"],
  [["[", "]"], "Previous or next track"],
  [["M"], "Mute"],
  [["V"], "Change the visualizer"],
  [["E", "P"], "Show or hide the equalizer or playlist"],
  [["1", "–", "5"], "Switch era"],
  [["Tab"], "Move between controls"],
  [["←", "→"], "Move along the menu bar and the transport"],
  [["↑", "↓"], "Move through a menu or the playlist, or adjust a slider"],
  [["Home", "End"], "Jump to either end of a slider or list"],
  [["Enter"], "Open a menu, press a button or play the focused track"],
  [["Esc"], "Close a menu"],
]

function Keys() {
  return (
    <dl className="keys">
      {KEYS.map(([keys, action]) => (
        <div key={action}>
          <dt>
            {keys.map((key) =>
              key === "–" ? (
                <span key={key}>–</span>
              ) : (
                <kbd key={key}>{key}</kbd>
              )
            )}
          </dt>
          <dd>{action}</dd>
        </div>
      ))}
    </dl>
  )
}

export { Keys }
