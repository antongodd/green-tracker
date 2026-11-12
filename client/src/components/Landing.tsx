import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { bandName, type Band } from '../../../shared/domain/gems';
import type { RankedRow } from '../../../shared/domain/leaderboard';
import type { Product } from '../../../shared/domain/product';
import { landed } from '../landing';
import { linkTo } from '../router';
import { scrollPage } from '../scrollHold';
import { placedByScreen } from '../scrollReturn';
import { useAppearance } from './Gems';

/**
 * D99, the owner's idea #38 ("like a rocketship landing down… different for each leaderboard rank, with the 9.5 band
 * being the most special"); his pick A of three mockups. A new product lands in its place on the Leaderboard: the
 * rows below make room, it comes down from above on a flame, slows, touches down in a puff of dust. Its band adds
 * more, in its colour set's own colours (one landing for every set, the owner: "ur suggestion"):
 *   no band   the dust
 *   8.0–8.4   a glint of its colours across the row
 *   8.5–8.9   sparks
 *   9.0–9.4   a ring of light and a small shake
 *   9.5–10    the full show: the screen dims, a bigger flame, fireworks, a banner with its place
 * Reduce Motion: nothing flies; the row fades in and glows, and the 9.5 banner still shows. A tap anywhere skips it.
 * Everything drawn is in its own fixed layer after the screen (never inside a `.screen`, which moves while it fades
 * in); the rows themselves are only moved with the Web Animations API, so the screen's own markup is never touched.
 * Then a note, "<name> landed at #N · Open", for VoiceOver too.
 */
export function Landing(p: { id: string; rows: RankedRow<Product>[]; ready: boolean }) {
  const appearance = useAppearance();
  const fx = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [note, setNote] = useState<{ name: string; rank: number } | null>(null);

  useLayoutEffect(() => {
    if (started.current || !p.ready) return;
    started.current = true;
    const at = p.rows.find((r) => r.product.id === p.id);
    const row = at && document.querySelector<HTMLElement>(`.rows > a.row[href="/products/${CSS.escape(p.id)}"]`);
    const layer = fx.current;
    if (!at || !row || !layer) return landed();
    const show = new Show(layer, row, at.band, at.rank, at.band ? bandName(appearance.preset, at.band) : '');
    show.run().finally(() => {
      landed();
      setNote({ name: at.product.name, rank: at.rank });
    });
    return () => show.stop();
  }, [p.ready]);

  // The note stays a few seconds.
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(t);
  }, [note]);

  return (
    <>
      <div class="landing-fx" ref={fx} aria-hidden="true" />
      {note && (
        <p class="toast landed" role="status">
          <span>
            <b>{note.name}</b> landed at #{note.rank}
          </span>
          <a href={`/products/${p.id}`} onClick={linkTo(`/products/${p.id}`)}>
            Open
          </a>
        </p>
      )}
    </>
  );
}

type Spot = { x: number; y: number; w: number; h: number; cx: number; cy: number };
const spot = (el: Element): Spot => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
};
const DUST = ['rgba(220, 226, 232, 0.55)', 'rgba(180, 190, 200, 0.45)'];

/** One landing. `stop` (a tap, or leaving the screen) ends it at once, wherever it is. */
class Show {
  private all: Animation[] = [];
  private timers: number[] = [];
  private stopped = false;
  private wake: (() => void) | null = null;
  private readonly reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(
    private layer: HTMLElement,
    private row: HTMLElement,
    private band: Band | null,
    private rank: number,
    private bandLabel: string,
  ) {}

  stop = () => {
    if (this.stopped) return;
    this.stopped = true;
    this.all.forEach((a) => a.cancel());
    this.timers.forEach(clearTimeout);
    this.layer.replaceChildren();
    window.removeEventListener('pointerdown', this.stop, true);
    this.wake?.();
  };

  private anim(el: Element, frames: Keyframe[], o: KeyframeAnimationOptions): Animation {
    const a = el.animate(frames, o);
    this.all.push(a);
    return a;
  }
  private async done(a: Animation): Promise<void> {
    await Promise.race([a.finished.catch(() => {}), new Promise<void>((r) => (this.wake = r))]);
  }
  private wait(ms: number): Promise<void> {
    return new Promise((r) => {
      this.wake = r;
      this.timers.push(window.setTimeout(r, ms));
    });
  }
  private el(css: string, parent: HTMLElement = this.layer): HTMLElement {
    const d = document.createElement('i');
    d.style.cssText = css;
    parent.appendChild(d);
    return d;
  }

  /** The colour set's colours for this row (--t1…--t6), or the dust's greys without a band. */
  private colours(): string[] {
    const cs = getComputedStyle(this.row);
    const c = [1, 2, 3, 4, 5, 6].map((i) => cs.getPropertyValue(`--t${i}`).trim()).filter(Boolean);
    return c.length ? c : ['#e6e9ec', '#c4ccd4'];
  }

  async run(): Promise<void> {
    const hide = this.anim(this.row, [{ opacity: 0 }, { opacity: 0 }], { duration: 1, fill: 'forwards' });
    // Its place, a little above the middle of the screen.
    const r = this.row.getBoundingClientRect();
    placedByScreen();
    scrollPage(Math.max(0, r.top + window.scrollY - window.innerHeight * 0.42));
    window.addEventListener('pointerdown', this.stop, true);
    // Wait for the screen's own fade in.
    const screen = this.row.closest('.screen');
    await Promise.race([Promise.all((screen?.getAnimations() ?? []).map((a) => a.finished.catch(() => {}))), this.wait(800)]);
    if (this.stopped) return;
    const b = this.band ?? 0;
    const colours = this.colours();

    if (this.reduce) {
      hide.cancel();
      await this.done(this.anim(this.row, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 }));
      this.glow(colours[1]!);
      if (b === 4) {
        this.banner(colours, 2400);
        await this.wait(2400);
      } else await this.wait(600);
      this.stop();
      return;
    }

    // The rows below make room.
    const rows = [...(this.row.parentElement?.querySelectorAll<HTMLElement>(':scope > a.row') ?? [])];
    const below = rows.slice(rows.indexOf(this.row) + 1);
    const gap = this.row.offsetHeight + parseFloat(getComputedStyle(this.row.parentElement!).rowGap || '10');
    const room = below.map((x) => this.anim(x, [{ transform: `translateY(${-gap}px)` }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' }));
    if (room[0]) await this.done(room[0]);
    if (this.stopped) return;

    // Down it comes on a flame: fast, then the thrust slows it, a hover, touch down.
    if (b === 4) this.dim(true);
    const s = spot(this.row);
    const from = -(s.y + s.h + 60);
    const time = b === 4 ? 1500 : 1150;
    const path: Keyframe[] = [
      { transform: `translateY(${from}px)` },
      { transform: 'translateY(-26px)', offset: 0.6, easing: 'ease-out' },
      { transform: 'translateY(-8px)', offset: 0.85 },
      { transform: 'none' },
    ];
    // Two boosters, one under each side of the row.
    const fh = [56, 64, 76, 90, 120][b]!;
    const fw = b === 4 ? 40 : 30;
    const flames = [0.22, 0.78].map((at) => {
      const f = this.el(`left:${s.x + s.w * at - fw / 2}px;top:${s.y + s.h - 4}px;width:${fw}px;height:${fh}px`);
      f.className = 'flame';
      return f;
    });
    hide.cancel();
    for (const f of flames) {
      this.anim(f, path, { duration: time, easing: 'cubic-bezier(.35,0,.6,1)' });
      this.anim(f, [{ opacity: 1, scale: '1 1.3' }, { opacity: 1, scale: '0.9 0.8', offset: 0.55 }, { opacity: 1, scale: '1 1.1', offset: 0.8 }, { opacity: 0, scale: '0.6 0.05' }], { duration: time, fill: 'forwards' });
    }
    await this.done(this.anim(this.row, path, { duration: time, easing: 'cubic-bezier(.35,0,.6,1)' }));
    if (this.stopped) return;
    flames.forEach((f) => f.remove());

    // Touch down.
    this.anim(this.row, [{ transform: 'scale(1.03, 0.94)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });
    this.dust(s, b >= 3);
    if (b >= 1) this.glint(s);
    this.glow(colours[1]!);
    if (b >= 2) this.burst({ x: s.cx, y: s.cy, n: b >= 3 ? 26 : 16, colours, dist: b >= 3 ? 150 : 100, size: 6, time: 1000 });
    if (b >= 3) {
      this.ring(s, colours[1]!);
      const list = this.row.parentElement!;
      this.anim(list, [{ transform: 'none' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 320 });
    }
    if (b === 4) {
      this.anim(this.row.querySelector('.score b') ?? this.row, [{ scale: '1' }, { scale: '1.25' }, { scale: '1' }], { duration: 500, easing: 'ease-out' });
      this.banner(colours, 2600);
      for (let k = 0; k < 4 && !this.stopped; k++) {
        await this.wait(260);
        const w = window.innerWidth;
        this.burst({ x: w * (0.15 + Math.random() * 0.7), y: window.innerHeight * (0.18 + Math.random() * 0.35), n: 30, colours, dist: 110, size: 6, time: 1300, up: 40 });
      }
      await this.wait(900);
      this.dim(false);
      await this.wait(700);
    } else await this.wait(1000);
    this.stop();
  }

  /** The 9.5 show: every other row dims while it lands, then comes back. */
  private dim(on: boolean) {
    const others = [...(this.row.parentElement?.querySelectorAll<HTMLElement>(':scope > a.row') ?? [])].filter((x) => x !== this.row);
    const frames = on ? [{ filter: 'brightness(1)' }, { filter: 'brightness(0.45)' }] : [{ filter: 'brightness(0.45)' }, { filter: 'brightness(1)' }];
    others.forEach((x) => this.anim(x, frames, { duration: on ? 400 : 700, fill: on ? 'forwards' : 'none' }));
  }

  private glow(colour: string) {
    this.anim(this.row, [{ boxShadow: `0 0 0 1px ${colour}, 0 0 22px 2px ${colour}` }, { boxShadow: `0 0 0 1px transparent, 0 0 22px 2px transparent` }], { duration: 1800, easing: 'ease-out' });
  }

  private banner(colours: string[], time: number) {
    const b = this.el(`border-color:${colours[1]};box-shadow:0 0 30px ${colours[1]}`);
    b.className = 'banner';
    b.textContent = `#${this.rank} on your Leaderboard`;
    const small = document.createElement('small');
    small.textContent = this.bandLabel;
    b.appendChild(small);
    this.anim(b, [{ opacity: 0, transform: 'translate(-50%, -14px) scale(.9)' }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.12 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: 0.85 }, { opacity: 0, transform: 'translate(-50%, 0)' }], { duration: time, fill: 'forwards', easing: 'ease-out' });
  }

  private burst(o: { x: number; y: number; n: number; colours: string[]; dist: number; size: number; time: number; up?: number; spread?: number; from?: number }) {
    const spread = o.spread ?? Math.PI * 2;
    for (let i = 0; i < o.n; i++) {
      const s = o.size * (0.6 + Math.random() * 0.8);
      const c = o.colours[i % o.colours.length]!;
      const d = this.el(`left:${o.x - s / 2}px;top:${o.y - s / 2}px;width:${s}px;height:${s}px;background:${c};box-shadow:0 0 ${s * 1.5}px ${c}`);
      const a = (o.from ?? 0) + (spread === Math.PI * 2 ? Math.random() * spread : (Math.random() - 0.5) * spread);
      const r = o.dist * (0.5 + Math.random() * 0.6);
      this.anim(d, [{ transform: 'none', opacity: 1 }, { transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r + (o.up ?? 0)}px) scale(.3)`, opacity: 0 }], {
        duration: o.time * (0.7 + Math.random() * 0.5),
        easing: 'cubic-bezier(.15,.7,.3,1)',
        fill: 'forwards',
      });
    }
  }

  private dust(s: Spot, big: boolean) {
    for (const [x, from] of [[s.cx - s.w * 0.25, Math.PI], [s.cx + s.w * 0.25, 0]] as const) {
      this.burst({ x, y: s.y + s.h, n: big ? 14 : 8, colours: DUST, dist: big ? 70 : 45, size: big ? 16 : 12, time: 900, spread: 1.2, from });
    }
  }

  private glint(s: Spot) {
    const box = this.el(`left:${s.x}px;top:${s.y}px;width:${s.w}px;height:${s.h}px;border-radius:12px;overflow:hidden`);
    const g = this.el('position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.4) 48%,transparent 66%);background-size:250% 100%', box);
    this.anim(g, [{ backgroundPosition: '120% 0' }, { backgroundPosition: '-60% 0' }], { duration: 900, easing: 'ease-in-out', fill: 'forwards' });
  }

  private ring(s: Spot, colour: string) {
    const d = this.el(`left:${s.cx - 40}px;top:${s.cy - 40}px;width:80px;height:80px;border:3px solid ${colour};box-shadow:0 0 18px ${colour}`);
    this.anim(d, [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(7)', opacity: 0 }], { duration: 1000, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
  }
}
