import { useEffect, useRef, useState } from "preact/hooks";
import { holdPlace } from "../router";
import { Sheet } from "./chrome";
import type { PhotoDraft } from "./EditorPhotos";

/**
 * "Don't lose my work": the product, Log entry and post editors ask before throwing work away.
 * Cancel, or a swipe back from the edge, while `dirty()` opens the Keep editing / Discard sheet;
 * with nothing changed they just leave. `done()` is called once it's saved (or posted), so the
 * leaving that follows isn't asked about.
 */
export function useKeepEditing(p: { dirty: () => boolean; leave: () => void }) {
  const [asking, setAsking] = useState(false);
  const finished = useRef(false);
  const latest = useRef(p);
  latest.current = p;
  const dirty = () => !finished.current && latest.current.dirty();
  useEffect(() => holdPlace(dirty, () => setAsking(true)), []);
  const leave = () => {
    finished.current = true;
    setAsking(false);
    latest.current.leave();
  };
  return {
    asking,
    /** The Cancel button. */
    cancel: () => (dirty() ? setAsking(true) : leave()),
    /** Saved: leaving now loses nothing. */
    done: () => void (finished.current = true),
    keep: () => setAsking(false),
    discard: leave,
  };
}

/** The form and its photos as text, to tell whether anything has changed since it opened. */
export const snapshot = (form: unknown, drafts: PhotoDraft[]): string =>
  JSON.stringify([form, drafts.map((d) => [d.key, d.id ?? null, d.upload ?? null, d.status, d.crop ?? null, d.cutout ?? false])]);

/** The sheet itself: Keep editing (the bold one, focused) or Discard. */
export function DiscardSheet(p: { title: string; message: string; keeper: ReturnType<typeof useKeepEditing> }) {
  if (!p.keeper.asking) return null;
  return <Sheet title={p.title} message={p.message} cancelLabel="Keep editing" options={[{ label: 'Discard', danger: true, onSelect: p.keeper.discard }]} onCancel={p.keeper.keep} />;
}
