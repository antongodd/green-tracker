// A light tick as you tap a button (D56): a hidden iPhone switch inside a label that fills
// the button, so your finger lands on it. Put it inside the button (`.has-tick` gives the
// button `position: relative`). Renders nothing when Ticks is off or the phone can't tick.
import { ticks } from '../sounds';

export function Tick() {
  if (!ticks()) return null;
  return (
    <label class="tick" aria-hidden="true">
      {/* The label's own click reaches the button; the switch's copy of it mustn't, or the button would act twice. */}
      <input type="checkbox" tabIndex={-1} {...{ switch: true }} onClick={(e) => e.stopPropagation()} />
    </label>
  );
}
