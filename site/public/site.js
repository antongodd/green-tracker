// Green Tracker's website (D63): blocks arriving as they scroll into view, the bar at the top, and (D86) the
// things you can play with: the phone you can pick up, the scroll story, the Looks, Rate the stack and the install
// sheet. The page reads the same without this file; Reduce Motion makes everything jump straight to where it ends.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Safari only shows :active (the press-in on buttons) on a page that listens for touches.
  document.addEventListener('touchstart', () => {}, { passive: true });

  // ---- Motion helpers (the apple-design skill, D86) ----
  // A spring in Apple's terms: damping (1 = no overshoot) and response (seconds). It starts from wherever the thing
  // is now, at whatever speed it's moving now, so it can be grabbed and redirected at any moment.
  const spring = (from, set, { to, velocity = 0, damping = 1, response = 0.4, done }) => {
    const k = (2 * Math.PI / response) ** 2, c = (4 * Math.PI * damping) / response;
    let x = from, v = velocity, last = performance.now(), id = 0, live = true;
    const end = () => { live = false; set(to); if (done) done(); };
    if (still) { end(); return { stop() {} }; }
    const tick = (now) => {
      if (!live) return;
      const dt = Math.min(0.032, (now - last) / 1000) / 4; last = now;
      for (let i = 0; i < 4; i++) { v += (-k * (x - to) - c * v) * dt; x += v * dt; }
      if (Math.abs(v) < 2 && Math.abs(x - to) < 0.3) return end();
      set(x); id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return { stop() { live = false; cancelAnimationFrame(id); } };
  };
  // Where a flick would come to rest (Apple's own projection; 0.998 is a scroll's feel, 0.99 snappier).
  const project = (v, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);
  // Past an edge, things follow less and less instead of stopping dead.
  const rubber = (over, size, c = 0.55) => (over * size * c) / (size + c * Math.abs(over));
  // Speed from the last tenth of a second of moves.
  const tracker = () => {
    const h = [];
    return {
      add(x, y) { const t = performance.now(); h.push({ x, y, t }); while (h.length > 2 && t - h[0].t > 100) h.shift(); },
      speed() { if (h.length < 2) return { x: 0, y: 0 }; const a = h[0], b = h[h.length - 1], dt = (b.t - a.t) / 1000 || 1; return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt }; },
      reset() { h.length = 0; },
    };
  };
  // The colours a score earns in the app (D48), and the heat glow below 8 (D30).
  const bandOf = (s) => (s >= 9.5 ? 'b4' : s >= 9 ? 'b3' : s >= 8.5 ? 'b2' : s >= 8 ? 'b1' : '');
  const heat = (s) => {
    const t = Math.max(0, Math.min(1, (s - 4) / 4));
    const mix = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${mix(240, 120)}, ${mix(169, 230)}, ${mix(59, 150)})`;
  };
  const verdicts = [[9.5, 'Top shelf. Holo unlocked.'], [9, 'Fire.'], [8, 'Now we’re talking.'], [6, 'Not bad. Not fire.'], [0, 'Mids. Straight to the bottom.']];
  const verdictOf = (s) => verdicts.find(([min]) => s >= min)[1];

  if ('IntersectionObserver' in window) {
    // Each block is visible from the start; it plays its rise once, the first time it scrolls in from below.
    // A step's little picture shows its moment once, as it comes into view (.seen).
    const io = new IntersectionObserver((seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        if (!still && e.boundingClientRect.top > innerHeight * 0.4) e.target.classList.add('play');
        e.target.classList.add('seen');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const el of document.querySelectorAll('.reveal')) io.observe(el);

    // D85: the bar at the top gets its edge once something scrolls under it, and offers Sign up
    // once the hero's own buttons have scrolled away.
    const nav = document.querySelector('.nav');
    const ctas = document.querySelector('.hero .ctas');
    if (nav) {
      const edge = () => nav.classList.toggle('edge', scrollY > 4);
      addEventListener('scroll', edge, { passive: true });
      edge();
      if (ctas) new IntersectionObserver(([e]) => nav.classList.toggle('join', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(ctas);
    }

    // D86: the scroll story. Whichever feature's words cross the middle of the screen, the phone shows its screen.
    const story = document.querySelector('.story');
    if (story) {
      const screens = story.querySelectorAll('.s'), dots = story.querySelectorAll('.sdots i');
      const show = (n) => { screens.forEach((s, i) => s.classList.toggle('on', i === n)); dots.forEach((d, i) => d.classList.toggle('on', i === n)); story.dataset.on = String(n); };
      const middle = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) show(Number(e.target.dataset.screen)); }, { rootMargin: '-45% 0px -45% 0px' });
      for (const f of story.querySelectorAll('.feat')) middle.observe(f);
      story.dataset.on = '0';
    }
  }

  // ---- D86: the phone you can pick up ----
  // Drag the hero's phone and it turns with your finger (1:1), the light sliding across its glass; past a turn of
  // 28° it resists more and more; let go and it swings back at your speed (a little overshoot only after a flick).
  const stage = document.querySelector('.hero .stage'), mini = stage && stage.querySelector('.mini');
  if (stage && mini) {
    const MAX = 28, tr = tracker();
    let ty = 0, tx = 0, rawY = 0, rawX = 0, grab = null, springs = [];
    const soft = (v) => (Math.abs(v) <= MAX ? v : Math.sign(v) * (MAX + rubber(Math.abs(v) - MAX, 40)));
    const paint = () => {
      mini.style.setProperty('--ty', `${ty.toFixed(2)}deg`); mini.style.setProperty('--tx', `${tx.toFixed(2)}deg`);
      mini.style.setProperty('--gx', `${(30 - ty * 1.4).toFixed(1)}%`); mini.style.setProperty('--gy', `${(18 + tx * 1.4).toFixed(1)}%`);
    };
    stage.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      springs.forEach((s) => s.stop());
      grab = { x: e.clientX - rawY * 4, y: e.clientY + rawX * 4, touch: e.pointerType === 'touch' };
      tr.reset(); tr.add(e.clientX, e.clientY);
    });
    stage.addEventListener('pointermove', (e) => {
      if (!grab) return;
      // Only once it's clearly a sideways drag does the phone take the finger (a scroll stays a scroll).
      if (!stage.classList.contains('held')) {
        if (Math.abs(e.clientX - grab.x - rawY * 4) < 8) return;
        stage.classList.add('held'); stage.setPointerCapture(e.pointerId);
      }
      tr.add(e.clientX, e.clientY);
      rawY = (e.clientX - grab.x) / 4; rawX = grab.touch ? 0 : -(e.clientY - grab.y) / 4;
      ty = soft(rawY); tx = soft(rawX) * 0.6; paint();
    });
    const letGo = () => {
      if (!grab) return;
      grab = null; stage.classList.remove('held');
      const v = tr.speed(), flick = Math.abs(v.x) > 300;
      springs = [
        spring(ty, (n) => { ty = n; rawY = n; paint(); }, { to: 0, velocity: v.x / 4, damping: flick ? 0.6 : 1, response: 0.45 }),
        spring(tx, (n) => { tx = n; rawX = n / 0.6; paint(); }, { to: 0, velocity: -v.y / 6, damping: flick ? 0.7 : 1, response: 0.45 }),
      ];
    };
    stage.addEventListener('pointerup', letGo); stage.addEventListener('pointercancel', letGo);
  }

  // ---- D86: Make it yours ----
  // Swipe the row of Looks (it snaps to the nearest) or tap one: the page's lights slowly take its colours and the
  // little phone shows it. A light Look shows on the little phone only; the page stays dark (no flash of white).
  const LOOKS = {
    aurora: ['#58e08c', '#40c4c4', '#8b7bff'], neon: ['#b06bff', '#ff5ab4', '#3fdcf0'],
    forest: ['#3fa866', '#2f8a5a', '#7fc896'], sakura: ['#f58cba', '#ff9fc8', '#b48cff'], fireflies: ['#b6e85a', '#2f9a72', '#d4f78a'],
    deepsea: ['#3fd6c4', '#2a7fd6', '#5fe0d0'], frost: ['#7cc8f0', '#9fd6ff', '#8ea8ff'], nebula: ['#a99bff', '#ff8ad8', '#5a7bff'],
    outrun: ['#3fdcf0', '#ff4fd8', '#8b4fff'], lava: ['#ff9a40', '#ff5a6e', '#ffc04d'],
    daysky: ['#6fb4f0', '#ffc080', '#8fc8ff'],
  };
  const LIGHT = { daysky: ['#eef3fa', '#ffffff', '#10223a', '#2a6fc0'] };
  const row = document.querySelector('.looks'), about = document.getElementById('look-about'), pmini = document.querySelector('.pmini');
  if (row && about) {
    const buttons = [...row.querySelectorAll('.lk')];
    let current = 'aurora', raf = 0;
    const choose = (b) => {
      const key = b.dataset.look;
      if (key === current) return;
      current = key;
      for (const x of buttons) x.setAttribute('aria-pressed', String(x === b));
      const [a, c, d] = LOOKS[key], root = document.documentElement.style;
      root.setProperty('--lt1', a); root.setProperty('--lt2', c); root.setProperty('--lt3', d);
      const light = LIGHT[key];
      if (pmini) for (const [k, i] of [['--pm-bg', 0], ['--pm-card', 1], ['--pm-text', 2], ['--pm-score', 3]]) light ? pmini.style.setProperty(k, light[i]) : pmini.style.removeProperty(k);
      about.textContent = '';
      const name = document.createElement('b'); name.textContent = b.querySelector('.lkn').textContent;
      about.append(name, `: ${b.dataset.about.charAt(0).toLowerCase()}${b.dataset.about.slice(1)}.`);
      document.documentElement.dataset.sitelook = key;
    };
    const nearest = () => {
      const mid = row.scrollLeft + row.clientWidth / 2;
      let best = buttons[0], gap = Infinity;
      for (const b of buttons) { const d = Math.abs(b.offsetLeft + b.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = b; } }
      return best;
    };
    let tapped = 0;
    row.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (Date.now() - tapped > 700) choose(nearest()); }); }, { passive: true });
    for (const b of buttons) b.addEventListener('click', () => {
      tapped = Date.now();
      choose(b);
      row.scrollTo({ left: b.offsetLeft + b.offsetWidth / 2 - row.clientWidth / 2, behavior: still ? 'auto' : 'smooth' });
    });
  }

  // ---- D86: Rate the stack ----
  const stack = document.getElementById('stack');
  const now = document.getElementById('rate-now');
  const fireBtn = document.getElementById('b-fire'), midsBtn = document.getElementById('b-mids');
  if (stack && now && fireBtn && midsBtn) {
    const original = stack.innerHTML;
    let cards = [], rated = [], busy = false;
    const live = () => cards.filter((c) => !c.gone);
    // Distance across the card → score: the middle is 5.5, half a card's width either way is 10 or 1.
    const scoreAt = (x, w) => Math.max(1, Math.min(10, 5.5 + (x / (w * 0.5)) * 4.5));
    const say = (text) => { now.textContent = text; };
    const paint = (c, x) => {
      const el = c.el, w = el.offsetWidth, moved = Math.abs(x) > 8, s = scoreAt(x, w), band = moved ? bandOf(s) : '';
      const sc = el.querySelector('.cscore');
      sc.textContent = moved ? s.toFixed(1) : '–';
      el.classList.toggle('holo', !!band);
      for (const b of ['b1', 'b2', 'b3', 'b4']) el.classList.toggle(b, band === b);
      sc.style.color = moved && !band ? heat(s) : '';
      el.querySelector('.fire').style.opacity = String(Math.max(0, Math.min(1, (x - 30) / 80)));
      el.querySelector('.mids').style.opacity = String(Math.max(0, Math.min(1, (-x - 30) / 80)));
      el.style.transform = `translateX(${x.toFixed(1)}px) rotate(${(x / 18).toFixed(2)}deg)`;
    };
    // The cards under the top one sit a little lower and smaller, ready.
    const layout = () => {
      live().forEach((c, d) => {
        c.el.style.zIndex = String(10 - d);
        c.el.style.transition = still ? 'none' : 'transform 0.5s var(--settle), opacity 0.3s ease';
        c.el.style.transform = d ? `translateY(${d * 10}px) scale(${1 - d * 0.05})` : 'none';
        c.el.style.opacity = d > 2 ? '0' : '1';
        c.el.style.pointerEvents = d ? 'none' : 'auto';
      });
      const top = live()[0];
      if (top) arm(top);
    };
    const finish = () => {
      const sorted = rated.slice().sort((a, b) => b.s - a.s);
      stack.classList.add('done');
      stack.removeAttribute('aria-hidden');
      stack.textContent = '';
      const board = document.createElement('div'); board.className = 'board';
      const label = document.createElement('p'); label.className = 'label'; label.textContent = 'Your top shelf'; board.append(label);
      sorted.forEach((p, i) => {
        const band = bandOf(p.s), r = document.createElement('div');
        r.className = `lr${band ? ` holo ${band}` : ''}`; r.style.animationDelay = `${i * 70}ms`;
        r.innerHTML = `<span class="rk">${i + 1}</span><img class="nug" src="/media/nugs/${p.img}-s.webp" alt="" width="96" height="96" /><span class="nm"><b></b><small></small></span><span class="sc">${p.s.toFixed(1)}</span>`;
        r.querySelector('b').textContent = p.name; r.querySelector('small').textContent = p.sub;
        if (!band) r.querySelector('.sc').style.color = heat(p.s);
        board.append(r);
      });
      stack.append(board);
      fireBtn.hidden = true; midsBtn.textContent = 'Rate them again'; midsBtn.dataset.again = '1';
      say(`Your top shelf: ${sorted[0].name} first, with ${sorted[0].s.toFixed(1)}.`);
    };
    const commit = (c, x, v) => {
      if (c.gone) return;
      const w = c.el.offsetWidth, s = Math.round(scoreAt(x, w) * 10) / 10, dir = Math.sign(x) || 1;
      c.gone = true; c.el.style.pointerEvents = 'none'; c.el.style.transition = 'none';
      rated.push({ name: c.el.dataset.name, sub: c.el.dataset.sub, img: c.el.dataset.img, s });
      say(`${c.el.dataset.name}: ${s.toFixed(1)}. ${verdictOf(s)}`);
      if (c.spring) c.spring.stop();
      spring(x, (n) => { c.el.style.transform = `translateX(${n.toFixed(1)}px) rotate(${(n / 18).toFixed(2)}deg)`; c.el.style.opacity = String(Math.max(0, 1 - Math.abs(n) / (w * 1.6))); },
        { to: dir * w * 1.7, velocity: Math.abs(v) < 900 ? 900 * dir : v, damping: 1, response: 0.5, done: () => c.el.remove() });
      setTimeout(() => { if (live().length) layout(); else finish(); busy = false; }, still ? 0 : 160);
    };
    const arm = (c) => {
      if (c.armed) return;
      c.armed = true;
      const el = c.el, tr = tracker();
      let x = 0, from = 0, dragging = false;
      el.addEventListener('pointerdown', (e) => {
        if (c.gone || busy || e.button) return;
        if (c.spring) c.spring.stop();
        el.style.transition = 'none';
        dragging = true; from = e.clientX - x; tr.reset(); tr.add(e.clientX, 0);
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        if (!el.hasPointerCapture(e.pointerId)) { if (Math.abs(e.clientX - from - x) < 8) return; el.setPointerCapture(e.pointerId); }
        x = e.clientX - from; tr.add(e.clientX, 0); paint(c, x);
      });
      const up = () => {
        if (!dragging) return;
        dragging = false;
        const v = tr.speed().x, w = el.offsetWidth, rest = x + project(v, 0.99);
        // The score is where you let go, nudged a little by how hard you threw it.
        const at = Math.max(-w * 0.5, Math.min(w * 0.5, x + Math.max(-w * 0.15, Math.min(w * 0.15, project(v, 0.99) * 0.15))));
        if (Math.abs(rest) > w * 0.35) { paint(c, at); commit(c, at, v); }
        else c.spring = spring(x, (n) => { x = n; paint(c, n); }, { to: 0, velocity: v, damping: 0.8, response: 0.35 });
      };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    };
    // The buttons do the same, for anyone who can't or won't drag: Fire lands on 9.3, Mids on 3.1.
    const press = (dir) => {
      const c = live()[0];
      if (!c || busy) return;
      busy = true;
      const w = c.el.offsetWidth, target = dir > 0 ? w * 0.42 : -w * 0.27;
      c.el.style.transition = 'none';
      c.spring = spring(0, (n) => paint(c, n), { to: target, damping: 1, response: 0.25, done: () => commit(c, target, 1200 * dir) });
    };
    const deal = () => {
      cards = [...stack.querySelectorAll('.card')].reverse().map((el) => ({ el })); // top card first
      rated = []; busy = false;
      layout();
    };
    fireBtn.addEventListener('click', () => press(1));
    midsBtn.addEventListener('click', () => {
      if (midsBtn.dataset.again) {
        stack.innerHTML = original; stack.classList.remove('done'); stack.setAttribute('aria-hidden', 'true');
        fireBtn.hidden = false; midsBtn.textContent = 'Mids'; delete midsBtn.dataset.again;
        deal();
        say(`Rating 1 of 5: ${cards[0].el.dataset.name}.`);
        return;
      }
      press(-1);
    });
    deal();
  }

  // ---- D86: the install sheet ----
  // "Put it on my iPhone" slides up a sheet from the bottom over a dimmed page: drag it (1:1; past the top it
  // resists), flick it down or tap outside or Done to close it. The full steps and the video stay further down.
  const sheet = document.getElementById('sheet'), scrim = document.getElementById('scrim');
  const opener = document.querySelector('.hero a[href="#install"]');
  if (sheet && scrim && opener) {
    const outside = [document.querySelector('.nav'), document.querySelector('main'), document.querySelector('.foot')].filter(Boolean);
    const tr = tracker();
    let y = 0, h = 1, anim = null, grab = null, open = false;
    const paint = () => {
      sheet.style.transform = `translateY(${y.toFixed(1)}px)`;
      scrim.style.opacity = String(Math.max(0, Math.min(1, 1 - y / h)));
    };
    const move = (to, velocity, done, damping = 1) => { if (anim) anim.stop(); anim = spring(y, (n) => { y = n; paint(); }, { to, velocity, damping, response: 0.34, done }); };
    const show = () => {
      if (open) return;
      open = true;
      sheet.hidden = false; scrim.hidden = false;
      h = sheet.offsetHeight; y = h + 20; paint();
      document.documentElement.classList.add('sheet-open');
      for (const el of outside) el.inert = true;
      sheet.focus({ preventScroll: true });
      move(0, 0, () => sheet.classList.add('up'));
    };
    const hide = (velocity = 0, then) => {
      if (!open) return;
      open = false; sheet.classList.remove('up');
      for (const el of outside) el.inert = false;
      document.documentElement.classList.remove('sheet-open');
      move(h + 20, velocity, () => { sheet.hidden = true; scrim.hidden = true; if (then) then(); else opener.focus({ preventScroll: true }); });
    };
    opener.addEventListener('click', (e) => { e.preventDefault(); show(); });
    scrim.addEventListener('click', () => hide());
    sheet.querySelector('.sheet-done').addEventListener('click', () => hide());
    document.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') hide(); });
    sheet.querySelector('.sheet-more').addEventListener('click', (e) => {
      e.preventDefault();
      hide(0, () => document.getElementById('install').scrollIntoView({ behavior: still ? 'auto' : 'smooth' }));
    });
    sheet.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.pages, button, a') || e.button) return;
      if (anim) anim.stop();
      sheet.setPointerCapture(e.pointerId);
      grab = e.clientY - y; tr.reset(); tr.add(0, e.clientY);
    });
    sheet.addEventListener('pointermove', (e) => {
      if (grab === null) return;
      tr.add(0, e.clientY);
      const ny = e.clientY - grab;
      y = ny < 0 ? -rubber(-ny, 300) : ny; paint();
    });
    const letGo = () => {
      if (grab === null) return;
      grab = null;
      const v = tr.speed().y;
      if (y + project(v, 0.99) > h * 0.4) hide(v); else move(0, v, undefined, 0.85);
    };
    sheet.addEventListener('pointerup', letGo); sheet.addEventListener('pointercancel', letGo);
    const pages = document.getElementById('pages'), dots = sheet.querySelectorAll('.pdots i');
    pages.addEventListener('scroll', () => { const i = Math.round(pages.scrollLeft / pages.clientWidth); dots.forEach((d, j) => d.classList.toggle('on', i === j)); }, { passive: true });
  }
})();
