import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CUTOUT_MODEL, CUTOUT_SIZE, edgeShare, findPieces, insideLoops, keepInside, loopRegion, normaliseMask, pieceAt, realLoops, ZOOM_EDGE, ZOOM_GROW, ZOOM_START, ZOOM_TRIES, zoomSquare, type Point } from '../../../shared/domain/cutout';
import { canvasOf, composite, modelPixels, renderCutout, type Analysis, type Region } from '../cutout/compose';
import { aiOnDevice, createEngine, type Engine } from '../cutout/engine';
import { errorText } from '../api';
import { loadImage } from '../images';
import { Sheet } from './chrome';
import { useLockScroll } from './PhotoViewer';
import { useAppearance } from './Gems';
import { DrawLoops } from './DrawLoops';
import { PencilIcon } from '../icons';

export interface CutoutResult {
  cropped: Blob;
  thumb: Blob;
}

type Stage = 'start' | 'choose' | 'draw' | 'ask' | 'loading' | 'cutting' | 'pick' | 'zoom' | 'preview' | 'failed';

const TITLES: Record<Stage, string> = {
  start: 'Remove background',
  choose: 'Remove background',
  draw: 'Draw round it',
  ask: 'Remove background',
  loading: 'Remove background',
  cutting: 'Cutting out',
  pick: 'Tap the bud',
  zoom: 'Tap the bud',
  preview: 'Preview',
  failed: 'Remove background',
};
const MB = (n: number) => Math.round(n / 1e6);

/** Where a tap landed, in 0–1 of the element (which is drawn at exactly the image's shape). */
function tapAt(e: MouseEvent): { x: number; y: number } {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
}

/**
 * Remove background (D26), full-screen like the cropper. The first time on a phone it
 * asks before downloading the AI; then it cuts out the photo (about 4 seconds on an
 * iPhone). Several separate things → Tap the bud. A bud lying on something the AI keeps
 * (a tray, a bag) → "Or tap the bud in your photo" zooms in around the tap and
 * cuts again. Preview shows the framed cut-out; Apply hands it to the caller, which
 * saves it the way it saves a crop. `source` is the photo's current cropped image.
 * D54 (0.46.0): it opens on a choice, Find the bud for me (the AI on the whole photo, as
 * before) or Draw round it: loops drawn round the buds (DrawLoops); the AI is shown just
 * the part round them and anything outside them is dropped. Draw round it is offered again
 * after the AI's own try; from its preview, Draw again goes back to the loops.
 */
export function CutoutFlow(p: { source: string | Blob; name?: string; onCancel: () => void; onApply: (r: CutoutResult) => Promise<void> }) {
  const appearance = useAppearance();
  useLockScroll();
  const [stage, setStage] = useState<Stage>('start');
  const [progress, setProgress] = useState<{ got: number; total: number } | null>(null);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
  const [count, setCount] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [preview, setPreview] = useState<{ url: string; result: CutoutResult } | null>(null);
  const [photo, setPhoto] = useState('');
  const [saving, setSaving] = useState(false);
  const [loops, setLoops] = useState<Point[][]>([]);
  /** What to do once the AI is ready: cut out the whole photo, or inside the loops. */
  const want = useRef<'whole' | 'loops'>('whole');
  const [fromLoops, setFromLoops] = useState(false);
  const loaded = useRef(false);
  const src = useRef<HTMLCanvasElement | null>(null);
  const engine = useRef<Engine | null>(null);
  const analysis = useRef<Analysis | null>(null);
  const everything = useRef<HTMLCanvasElement | null>(null);
  const pick = useRef<HTMLCanvasElement>(null);
  const alive = useRef(true);
  const urls = useRef<string[]>([]);
  const own = (b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.current.push(u);
    return u;
  };

  useEffect(() => {
    (async () => {
      try {
        const img = await loadImage(p.source);
        if (!alive.current) return;
        src.current = canvasOf(img);
        setPhoto(typeof p.source === 'string' ? p.source : own(p.source));
        setStage('choose');
      } catch (e) {
        fail(errorText(e), null);
      }
    })();
    return () => {
      alive.current = false;
      engine.current?.close();
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      for (const c of [src.current, everything.current]) if (c) c.width = c.height = 0;
    };
  }, []);

  function fail(text: string, again: (() => void) | null) {
    if (!alive.current) return;
    setMessage(text);
    setRetry(() => again);
    setStage('failed');
  }

  /** Find the bud for me, or Cut out from the loops: the AI first (asking before its one-off download). */
  async function runAi(what: 'whole' | 'loops') {
    want.current = what;
    if (loaded.current) return what === 'whole' ? cutWhole() : cutLoops();
    if (await aiOnDevice()) start();
    else if (alive.current) setStage('ask');
  }

  async function start() {
    setStage('loading');
    setProgress(null);
    engine.current?.close();
    const e = createEngine();
    engine.current = e;
    try {
      await e.load((got, total) => alive.current && setProgress({ got, total }));
    } catch {
      return fail('The background remover couldn’t be downloaded. Check your connection and try again.', start);
    }
    loaded.current = true;
    if (alive.current) (want.current === 'loops' ? cutLoops : cutWhole)();
  }

  async function analyse(r: Region): Promise<Analysis> {
    const raw = await engine.current!.run(modelPixels(src.current!, r), CUTOUT_SIZE);
    const alpha = normaliseMask(raw);
    const a = { region: r, alpha, pieces: findPieces(alpha, CUTOUT_SIZE) };
    analysis.current = a;
    return a;
  }

  /** Draw round it: the AI on the part round the loops; what's outside them is dropped. */
  async function cutLoops() {
    const s = src.current!;
    const ls = realLoops(loops);
    const region = loopRegion(ls, s.width, s.height);
    if (!region) return setStage('draw');
    setZooming(false);
    setFromLoops(true);
    setMessage('');
    setStage('cutting');
    try {
      const a = await analyse(region);
      if (!alive.current) return;
      const alpha = keepInside(a.alpha, insideLoops(ls, region, CUTOUT_SIZE));
      const pieces = findPieces(alpha, CUTOUT_SIZE);
      analysis.current = { region, alpha, pieces };
      if (!pieces.ids.length) {
        setMessage('No bud found inside your loop. Draw round the bud again.');
        setStage('draw');
        return;
      }
      await showPreview(new Set(pieces.ids));
    } catch {
      fail('The background couldn’t be removed from this photo.', () => runAi('loops'));
    }
  }

  async function cutWhole() {
    setFromLoops(false);
    setZooming(false);
    setMessage('');
    setStage('cutting');
    try {
      const s = src.current!;
      const a = await analyse({ x: 0, y: 0, w: s.width, h: s.height });
      if (!alive.current) return;
      const ids = a.pieces.ids;
      setCount(ids.length);
      if (ids.length === 0) {
        setMessage('No bud found. Draw round it, or tap the bud in your photo and the app will zoom in on it.');
        setStage('zoom');
      } else if (ids.length === 1) {
        await showPreview(new Set(ids));
      } else {
        if (everything.current) everything.current.width = everything.current.height = 0;
        everything.current = composite(s, a, new Set(ids));
        setKept(new Set());
        setStage('pick');
      }
    } catch {
      fail('The background couldn’t be removed from this photo.', start);
    }
  }

  async function showPreview(k: ReadonlySet<number>) {
    const result = await renderCutout(src.current!, analysis.current!, k);
    if (!alive.current) return;
    setPreview({ url: own(result.cropped), result });
    setMessage('');
    setStage('preview');
  }

  // Tap the bud: every thing found, faint; the ones you keep, clear.
  useLayoutEffect(() => {
    const c = pick.current;
    const all = everything.current;
    if (stage !== 'pick' || !c || !all) return;
    const scale = Math.min(1, 900 / Math.max(all.width, all.height));
    c.width = Math.round(all.width * scale);
    c.height = Math.round(all.height * scale);
    const x = c.getContext('2d')!;
    x.globalAlpha = 0.3;
    x.drawImage(all, 0, 0, c.width, c.height);
    x.globalAlpha = 1;
    if (kept.size) {
      const k = composite(src.current!, analysis.current!, kept);
      x.drawImage(k, 0, 0, c.width, c.height);
      k.width = k.height = 0;
    }
  }, [stage, kept]);

  function onPick(e: MouseEvent) {
    const a = analysis.current;
    if (!a) return;
    const t = tapAt(e);
    const id = pieceAt(a.pieces, t.x, t.y);
    if (!id) return;
    setKept((k) => {
      const next = new Set(k);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function next() {
    try {
      await showPreview(kept);
    } catch {
      fail('The background couldn’t be removed from this photo.', start);
    }
  }

  /** Zoom in on a tap: a square around it, widened while the bud still reaches its edge. */
  async function onZoom(e: MouseEvent) {
    const t = tapAt(e);
    const s = src.current!;
    const tx = t.x * s.width;
    const ty = t.y * s.height;
    const short = Math.min(s.width, s.height);
    setZooming(true);
    setMessage('');
    setStage('cutting');
    try {
      let side = short * ZOOM_START;
      let found = 0;
      for (let i = 0; i < ZOOM_TRIES; i++) {
        const z = zoomSquare(s.width, s.height, tx, ty, side);
        const a = await analyse({ x: z.x, y: z.y, w: z.side, h: z.side });
        if (!alive.current) return;
        found = pieceAt(a.pieces, (tx - z.x) / z.side, (ty - z.y) / z.side);
        if (!found || edgeShare(a.pieces, found) < ZOOM_EDGE || z.side >= short) break;
        side = z.side * ZOOM_GROW;
      }
      if (!found) {
        setMessage('No bud found where you tapped. Tap right on the bud.');
        setStage('zoom');
        return;
      }
      await showPreview(new Set([found]));
    } catch {
      fail('The background couldn’t be removed from this photo.', start);
    }
  }

  async function apply() {
    if (!preview) return;
    setSaving(true);
    setMessage('');
    try {
      await p.onApply(preview.result);
    } catch (e) {
      if (alive.current) setMessage(errorText(e));
    }
    if (alive.current) setSaving(false);
  }

  const toDraw = () => {
    setMessage('');
    setStage('draw');
  };
  const toZoom = () => {
    setMessage('');
    setStage('zoom');
  };
  const scanning = stage === 'start' || stage === 'ask' || stage === 'loading' || stage === 'cutting' || stage === 'failed';
  const marked = realLoops(loops).length;

  return (
    <div class="viewer cutflow" role="dialog" aria-modal="true" aria-label="Remove background" data-stage={stage}>
      <div class="cut-top">
        <button type="button" class="hbtn" onClick={p.onCancel} disabled={saving}>
          Cancel
        </button>
        <h2 class="cut-title">{TITLES[stage]}</h2>
        <span class="cut-act">
          {stage === 'pick' && (
            <button type="button" class="btn primary sm" disabled={!kept.size} onClick={next}>
              Next
            </button>
          )}
          {stage === 'draw' && (
            <button type="button" class="btn primary sm" disabled={!realLoops(loops).length} onClick={() => runAi('loops')}>
              Cut out
            </button>
          )}
          {stage === 'preview' && (
            <button type="button" class="btn primary sm" disabled={saving} onClick={apply}>
              {saving ? 'Saving…' : 'Apply'}
            </button>
          )}
        </span>
      </div>

      <div class="cut-stage">
        {stage === 'choose' && photo && <img class="cut-tap cut-still" src={photo} alt="Your photo" />}
        {stage === 'draw' && src.current && <DrawLoops photo={src.current} loops={loops} onLoop={(l) => realLoops([l]).length && setLoops((ls) => [...ls, l])} />}
        {scanning && photo && (
          <div class={`cut-scan${stage === 'cutting' ? ' go' : ''}`}>
            <img src={photo} alt="Your photo" />
            <span class="cut-line" aria-hidden="true" />
          </div>
        )}
        {stage === 'pick' && <canvas ref={pick} class="cut-tap" onClick={onPick} role="img" aria-label="The things found in your photo. Tap the bud to keep it." />}
        {stage === 'zoom' && photo && <img class="cut-tap" src={photo} alt="Your photo. Tap the bud to zoom in on it." onClick={onZoom} />}
        {stage === 'preview' && preview && (
          <div class="cut-preview">
            <img src={preview.url} alt="The cut-out" />
          </div>
        )}
      </div>

      <div class="cut-bottom">
        {stage === 'choose' && (
          <>
            <p class="cut-hint">Cut the bud out of its background.</p>
            <button type="button" class="btn primary" onClick={() => runAi('whole')}>
              Find the bud for me
            </button>
            <button type="button" class="btn secondary" onClick={toDraw}>
              <PencilIcon /> Draw round it
            </button>
          </>
        )}
        {stage === 'draw' && (
          <>
            {message ? (
              <p class="error" role="alert">
                {message}
              </p>
            ) : (
              <p class="cut-hint" aria-live="polite">
                {marked ? (
                  <>
                    <b>
                      {marked} {marked === 1 ? 'bud' : 'buds'}
                    </b>{' '}
                    marked. Tap Cut out, or draw round another.
                  </>
                ) : (
                  'Draw a loop round each bud you want. Pinch with two fingers to zoom in.'
                )}
              </p>
            )}
            <div class="cut-tools">
              <button type="button" class="btn secondary" disabled={!loops.length} onClick={() => (setMessage(''), setLoops((ls) => ls.slice(0, -1)))}>
                Undo
              </button>
              <button type="button" class="btn secondary" disabled={!loops.length} onClick={() => (setMessage(''), setLoops([]))}>
                Clear
              </button>
            </div>
          </>
        )}
        {stage === 'loading' && (
          <>
            <div class="cut-bar" role="progressbar" aria-label="Downloading" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ? Math.round((progress.got / progress.total) * 100) : 0}>
              <i style={{ width: `${progress ? (progress.got / progress.total) * 100 : 0}%` }} />
            </div>
            <p class="cut-hint" aria-live="polite">
              {progress && progress.got >= progress.total ? 'Starting…' : `Downloading the background remover (once only)… ${progress ? MB(progress.got) : 0} of ${MB(CUTOUT_MODEL.bytes)} MB`}
            </p>
          </>
        )}
        {stage === 'cutting' && (
          <p class="cut-hint" aria-live="polite">
            {zooming ? 'Zooming in on the bud…' : 'Cutting out…'} about 5 seconds
          </p>
        )}
        {stage === 'pick' && (
          <>
            <p class="cut-hint" aria-live="polite">
              {kept.size ? (
                <>
                  <b>
                    {kept.size} of {count}
                  </b>{' '}
                  kept. Tap Next, or tap another bud to add it.
                </>
              ) : (
                <>
                  Found <b>{count} separate things</b>. Tap the bud to keep it, or more than one if there are several buds.
                </>
              )}
            </p>
            <button type="button" class="btn text" onClick={toDraw}>
              Not right? Draw round it
            </button>
            <button type="button" class="btn text" onClick={toZoom}>
              Or tap the bud in your photo
            </button>
          </>
        )}
        {stage === 'zoom' && (
          <>
            <p class="cut-hint" aria-live="polite">
              {message || 'For a bud lying on a tray or bag: tap it and the app zooms in and cuts out again.'}
            </p>
            <button type="button" class="btn text" onClick={toDraw}>
              Or draw round it
            </button>
          </>
        )}
        {stage === 'preview' && (
          <>
            {p.name && preview && (
              // The cut-out on a top row, in the top colour of your preset (D48).
              <div class={`row tier band4 pal-${appearance.preset} cut-row`} aria-hidden="true">
                <span class="rk">1</span>
                <div class="thumb cut">
                  <img src={preview.url} alt="" />
                </div>
                <div class="mid">
                  <div class="name">{p.name}</div>
                </div>
                <span />
              </div>
            )}
            {message && (
              <p class="error" role="alert">
                {message}
              </p>
            )}
            {fromLoops ? (
              <button type="button" class="btn text" onClick={toDraw} disabled={saving}>
                Not right? Draw again
              </button>
            ) : (
              <>
                <button type="button" class="btn text" onClick={toDraw} disabled={saving}>
                  Not right? Draw round it
                </button>
                <button type="button" class="btn text" onClick={toZoom} disabled={saving}>
                  Or tap the bud in your photo
                </button>
              </>
            )}
          </>
        )}
        {stage === 'failed' && (
          <>
            <p class="error" role="alert">
              {message}
            </p>
            {retry && (
              <button type="button" class="btn secondary" onClick={retry}>
                Try again
              </button>
            )}
          </>
        )}
      </div>

      {stage === 'ask' && (
        <Sheet
          title="Download the background remover?"
          message={`It runs on this phone, so your photos never leave it. It’s a one-off download of ${MB(CUTOUT_MODEL.bytes)} MB; Wi-Fi recommended.`}
          options={[{ label: 'Download and continue', onSelect: start }]}
          cancelLabel="Not now"
          onCancel={p.onCancel}
        />
      )}
    </div>
  );
}
