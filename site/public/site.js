// Green Tracker's website (D63): blocks rising in as they scroll into view, and the
// "Go on, rate it" slider. The page reads the same without this file.
(() => {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Each block is visible from the start; it plays its rise once, the first time it scrolls in from below.
  if (!still && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((seen) => {
      for (const e of seen) {
        if (!e.isIntersecting) continue;
        if (e.boundingClientRect.top > innerHeight * 0.4) e.target.classList.add('play');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const el of document.querySelectorAll('.reveal')) io.observe(el);
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
  const show = () => {
    const s = Number(slider.value);
    score.textContent = s.toFixed(1);
    verdict.textContent = verdicts.find(([min]) => s >= min)[1];
    slider.setAttribute('aria-valuetext', `${s.toFixed(1)} out of 10: ${verdict.textContent}`);
    const band = s >= 9.5 ? 'b4' : s >= 9 ? 'b3' : s >= 8.5 ? 'b2' : s >= 8 ? 'b1' : '';
    row.className = band ? `lr holo ${band}` : 'lr heat';
    row.style.setProperty('--heat', heat(s));
  };
  slider.addEventListener('input', show);
  show();
})();
