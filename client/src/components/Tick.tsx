// A light tick as you tap a button (D56). Only a real tap on an iPhone switch, or on a label of
// it, ticks; a switch flipped from code doesn't. So the button carries an invisible label that
// fills it (`.has-tick` gives the button `position: relative`), and the label points at one
// hidden switch outside every button (<TickSwitch />, once, in main.tsx). A control inside a
// button would be a control inside a control; a label isn't one, so screen readers and the
// keyboard only ever meet the button. Renders nothing when Ticks is off or the phone can't tick.
//
// The label flips the switch only after its click has finished, and by then the button's own
// handler would already have redrawn the screen ("Saving…", a closing menu), taking the label
// away first: no flip, no tick. So the label keeps its click to itself and presses the button a
// moment later.
import { ticks } from '../sounds';

const ID = 'gt-tick';

export function Tick() {
  if (!ticks()) return null;
  return (
    <label
      class="tick"
      for={ID}
      aria-hidden="true"
      onClick={(e) => {
        e.stopPropagation();
        const button = e.currentTarget.closest('button');
        setTimeout(() => button?.click());
      }}
    />
  );
}

/** The one hidden switch the buttons' labels flip. Its own click never reaches a button. */
export function TickSwitch() {
  return <input id={ID} class="tick-switch" type="checkbox" tabIndex={-1} aria-hidden="true" {...{ switch: true }} />;
}
