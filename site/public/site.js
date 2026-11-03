// Green Tracker's website (D63): blocks arriving as they scroll into view, the bar at the top, and
// the "Go on, rate it" slider. The page reads the same without this file.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Safari only shows :active (the press-in on buttons) on a page that listens for touches.
  document.addEventListener('touchstart', () => {}, { passive: true });

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
  }

  // The rate-it slider: the row takes the colours a score earns in the app (D48, D30).
  const slider = document.getElementById('rate');
  const row = document.getElementById('rate-row');
  const score = document.getElementById('rate-score');
  const verdict = document.getElementById('rate-verdict');
  if (!slider || !row || !score || !verdict) return;
  const verdicts = [[9.5, 'Top shelf. Holo unlocked.'], [9, 'Fire.'], [8, 'Now we’re talking.'], [6, 'Not bad. Not fire.'], [0, 'Mids. Straight to the bottom.']];
  // Below 8: amber at 4 and under, through yellow-green, to mint at 8 (the app's heat glow).
  const heat = (s) => {
    const t = Math.max(0, Math.min(1, (s - 4) / 4));
    const mix = (a, b) => Math.round(a + (b - a) * t);
    return `rgb(${mix(240, 120)}, ${mix(169, 230)}, ${mix(59, 150)})`;
  };
  let was = null;
  const show = () => {
    const s = Number(slider.value);
    score.textContent = s.toFixed(1);
    verdict.textContent = verdicts.find(([min]) => s >= min)[1];
    slider.setAttribute('aria-valuetext', `${s.toFixed(1)} out of 10: ${verdict.textContent}`);
    // The green part of the track runs up to the thumb.
    slider.style.setProperty('--fill', `${((s - 1) / 9) * 100}%`);
    const band = s >= 9.5 ? 'b4' : s >= 9 ? 'b3' : s >= 8.5 ? 'b2' : s >= 8 ? 'b1' : '';
    const popping = row.classList.contains('pop');
    row.className = band ? `lr holo ${band}` : 'lr heat';
    if (popping) row.classList.add('pop');
    row.style.setProperty('--heat', heat(s));
    // D85: crossing into new colours gives the row a small pop, so you feel it earn them.
    if (was !== null && band !== was && !still) {
      row.classList.add('pop');
      row.addEventListener('animationend', (e) => { if (e.animationName === 'pop') row.classList.remove('pop'); }, { once: true });
    }
    was = band;
  };
  slider.addEventListener('input', show);
  show();
})();
