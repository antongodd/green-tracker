// Green Tracker: "Get it on your iPhone" explainer, in the Glassmorphism UI style.
// One frosted world: a glass iPhone in front of drifting green / teal / violet lights and blurred leaves;
// the camera glides to each part of the phone while a glass step card on the right says what to tap.
const DURATION = 24;
const GTX = (() => {
  // ---------- the reference's glass toolkit (unchanged) ----------
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  let NOISE = null;
  function noisePattern(ctx) {
    if (!NOISE) {
      NOISE = H.layer(160, 160);
      const nc = NOISE.getContext('2d'), id = nc.createImageData(160, 160), r = H.rng(99);
      for (let i = 0; i < id.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = r() * 60; }
      nc.putImageData(id, 0, 0);
    }
    return ctx.createPattern(NOISE, 'repeat');
  }
  // Frosted glass panel: shadow -> blurred backdrop (clipped) -> tint -> grain -> sheen -> 1px gradient border
  function glass(ctx, src, x, y, w, h, r, o = {}) {
    const tint = o.tint ?? 0.1;
    ctx.save();
    ctx.shadowColor = 'rgba(2,12,8,0.5)'; ctx.shadowBlur = o.shadow ?? 50; ctx.shadowOffsetY = (o.shadow ?? 50) * 0.4;
    ctx.fillStyle = 'rgba(6,24,16,1)'; rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.restore();
    ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
    { const M = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(src, 0, 0, ctx.canvas.width, ctx.canvas.height); ctx.setTransform(M); }
    const tg = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    tg.addColorStop(0, `rgba(255,255,255,${tint + 0.08})`); tg.addColorStop(1, `rgba(255,255,255,${tint * 0.5})`);
    ctx.fillStyle = tg; ctx.fillRect(x, y, w, h);
    if (o.dark) { ctx.fillStyle = `rgba(12,16,18,${o.dark})`; ctx.fillRect(x, y, w, h); }
    { const A = ctx.globalAlpha; ctx.globalAlpha = A * 0.22; ctx.fillStyle = noisePattern(ctx); ctx.fillRect(x, y, w, h); ctx.globalAlpha = A; }
    // diagonal specular sheen
    const sg = ctx.createLinearGradient(x, y, x + w * 0.55, y + h * 0.55);
    sg.addColorStop(0, 'rgba(255,255,255,0.16)'); sg.addColorStop(0.45, 'rgba(255,255,255,0.04)'); sg.addColorStop(0.46, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = sg; ctx.fillRect(x, y, w, h);
    ctx.restore();
    // 1px light border, brighter top-left
    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x + w, y + h);
    bg.addColorStop(0, 'rgba(255,255,255,0.65)'); bg.addColorStop(0.35, 'rgba(255,255,255,0.18)'); bg.addColorStop(0.7, 'rgba(255,255,255,0.08)'); bg.addColorStop(1, 'rgba(255,255,255,0.32)');
    ctx.strokeStyle = bg; ctx.lineWidth = 1; rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke();
    // inner top highlight
    const hg = ctx.createLinearGradient(x, 0, x + w, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.3, 'rgba(255,255,255,0.55)'); hg.addColorStop(0.7, 'rgba(255,255,255,0.15)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = hg; ctx.beginPath(); ctx.moveTo(x + r, y + 1.5); ctx.lineTo(x + w - r, y + 1.5); ctx.stroke();
    ctx.restore();
  }
  function blurOf(srcCanvas, W, Hh, px) {
    // blurred at half size (same look, a quarter of the work); glass() scales it back up
    const L = H.layer(W / 2, Hh / 2), c = L.getContext('2d');
    c.filter = `blur(${px / 2}px) saturate(150%)`;
    c.drawImage(srcCanvas, 0, 0, W / 2, Hh / 2);
    return L;
  }
  function chipPill(ctx, x, y, text, o = {}) {
    ctx.save(); ctx.font = o.font || '600 28px "Inter"';
    const w = ctx.measureText(text).width + (o.dot ? 56 : 40), h = o.h || 48, k = o.k ?? 1;
    ctx.globalAlpha *= Math.min(1, k * 1.5); ctx.translate(x, y); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    if (o.grad) { const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, o.grad[0]); g.addColorStop(1, o.grad[1]); ctx.fillStyle = g; ctx.shadowColor = o.glow || 'rgba(88,224,140,0.45)'; ctx.shadowBlur = 16; }
    else ctx.fillStyle = o.bg || 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, h / 2); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(-w / 2 + 0.5, -h / 2 + 0.5, w - 1, h - 1, h / 2); ctx.stroke();
    if (o.dot) { ctx.fillStyle = o.dot; ctx.beginPath(); ctx.arc(-w / 2 + 22, 0, 6, 0, 7); ctx.fill(); }
    ctx.fillStyle = o.col || '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, o.dot ? 10 : 0, 1);
    ctx.restore();
    return w;
  }
  function glowLine(ctx, a, c, b, prog, col1, col2, w = 3, dots = 0, t = 0) {
    if (prog <= 0) return null;
    const q = (u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]];
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, col1); g.addColorStop(1, col2);
    ctx.save(); ctx.strokeStyle = g; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.shadowColor = col2; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); for (let i = 1; i <= 40; i++) { const p = q(prog * i / 40); ctx.lineTo(p[0], p[1]); } ctx.stroke();
    const e = q(prog), e0 = q(Math.max(0, prog - 0.03)), ang = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
    ctx.translate(e[0], e[1]); ctx.rotate(ang); ctx.fillStyle = col2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-10, -9); ctx.lineTo(-6, 0); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
    for (let i = 0; i < dots; i++) { const uu = ((t * 0.7 + i / dots) % 1) * prog; const p = q(uu); ctx.fillStyle = '#ffffff'; ctx.shadowColor = col2; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p[0], p[1], 3.2, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
    return q;
  }

  // ---------- Green Tracker pieces ----------
  // The app's own leaf (site/public/favicon.svg), in its 24-unit box.
  const LEAF = new Path2D('M12 18.35C8.95 19.21 5.61 18.16 4.12 16.96C5.93 16.35 9.42 16.51 12 18.35Z M12 18.35C14.58 16.51 18.07 16.35 19.88 16.96C18.39 18.16 15.05 19.21 12 18.35Z M12 18.35C7.69 16.49 4.83 12.17 4.22 9.4C6.87 10.39 10.76 13.82 12 18.35Z M12 18.35C13.24 13.82 17.13 10.39 19.78 9.4C19.17 12.17 16.31 16.49 12 18.35Z M12 18.35C9.46 13.06 10.31 6.64 12 3.53C13.69 6.64 14.54 13.06 12 18.35Z M11.45 18.35H12.55V21.46H11.45Z');
  function leafFill(ctx, a = 1) {
    const g = ctx.createLinearGradient(0, 3, 0, 22); g.addColorStop(0, H.rgba('#b6ffd4', a)); g.addColorStop(0.55, H.rgba('#58e08c', a)); g.addColorStop(1, H.rgba('#2fb86a', a));
    ctx.fillStyle = g; ctx.fill(LEAF);
  }
  // The Home Screen icon (apple-touch-icon): dark green squircle, the leaf in the middle. x,y top-left, s size.
  function appIcon(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y);
    const g = ctx.createRadialGradient(s * 0.5, s * 0.38, 0, s * 0.5, s * 0.38, s * 0.75); g.addColorStop(0, '#14532f'); g.addColorStop(1, '#06200f');
    ctx.fillStyle = g; rr(ctx, 0, 0, s, s, s * 0.225); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = Math.max(1, s / 90); rr(ctx, 0.5, 0.5, s - 1, s - 1, s * 0.225); ctx.stroke();
    ctx.translate(s / 2, s * 0.5156); ctx.scale(s * 16.64 / 512, s * 16.64 / 512); ctx.translate(-12, -12.5);
    leafFill(ctx);
    ctx.restore();
  }
  const T = (ctx, str, x, y, font, col, align = 'left', base = 'alphabetic') => { ctx.font = font; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillText(str, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; };
  const line = (ctx, pts, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); };
  // Safari's Share glyph: an open-topped box with an arrow coming up out of it.
  function shareGlyph(ctx, x, y, s, col, lw = 2.4) {
    line(ctx, [[x - s * 0.22, y - s * 0.12], [x - s * 0.42, y - s * 0.12], [x - s * 0.42, y + s * 0.55], [x + s * 0.42, y + s * 0.55], [x + s * 0.42, y - s * 0.12], [x + s * 0.22, y - s * 0.12]], col, lw);
    line(ctx, [[x, y + s * 0.22], [x, y - s * 0.62]], col, lw);
    line(ctx, [[x - s * 0.22, y - s * 0.4], [x, y - s * 0.62], [x + s * 0.22, y - s * 0.4]], col, lw);
  }
  function plusSquare(ctx, x, y, s, col, lw = 2) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.25); ctx.stroke();
    line(ctx, [[x, y - s * 0.26], [x, y + s * 0.26]], col, lw); line(ctx, [[x - s * 0.26, y], [x + s * 0.26, y]], col, lw);
  }

  // ---------- world layout ----------
  const PX = 345, PY = 40, PW = 310, PH = 650;            // the phone
  const SX = 357, SY = 52, SW = 286, SH = 626, SR = 46;   // its screen
  const BLUE = '#0a84ff';
  const BAR_Y = SY + SH - 58;                             // Safari's compact bar (iOS 26)
  const DOTS = [SX + SW - 34, BAR_Y];                     // its ⋯ button
  const MENU = { x: SX + SW - 224, y: BAR_Y - 210, w: 210, h: 176 };   // the ⋯ menu; Share is its first row
  const SHEET_TOP = SY + 132, VM_SCROLL = 190;            // the share sheet, and how far View More scrolls it
  const VM = [SX + 241, SHEET_TOP + 318];                 // the View More button
  const LIST = ['Add Bookmark to…', 'Add to Favourites', 'Add to Quick Note', 'Find on Page', 'Add to Home Screen', 'Markup'];
  const HOMEROW = 4, HROW_Y = SHEET_TOP - VM_SCROLL + 392 + HOMEROW * 46 + 23;
  const ADD_BTN = [SX + SW - 44, SY + 88];
  const ICON = { s: 50, x: SX + 22 + 60.5 * 1 + 5, y: SY + 66 + 86 * 3 };   // Green Tracker's new slot
  const PRODUCTS = [['Lemon Cherry Gelato', 'Flower · Highland Greens', '9.6', '#b6ffd4'], ['Blue Zushi', 'Flower · The Green Room', '9.2', '#58e08c'], ['Gushers Rosin', 'Concentrate · Frosty Co.', '8.8', '#40c4c4'], ['Watermelon Gummies', 'Edible · Sweet Leaf', '8.3', '#a99bff'], ['Purple Punch', 'Flower · Highland Greens', '7.4', '#ffb35c']];
  // camera over the world: [t, centreX, centreY, zoom]
  const KF = [[0, 640, 360, 1], [5.0, 640, 360, 1], [5.9, 600, 520, 1.5], [7.7, 600, 520, 1.5], [8.5, 600, 430, 1.38], [12.4, 600, 430, 1.38], [13.2, 600, 250, 1.4], [14.9, 600, 250, 1.4], [15.8, 600, 365, 1.05], [18.3, 600, 365, 1.05], [19.1, 600, 365, 1.1], [20.9, 600, 365, 1.1], [21.8, 760, 365, 0.9], [99, 760, 365, 0.9]];
  function cam(t) {
    let k = 0; while (k < KF.length - 2 && t > KF[k + 1][0]) k++;
    const A = KF[k], B = KF[k + 1], u = H.ease.inOut(H.clamp((t - A[0]) / (B[0] - A[0])));
    return [H.lerp(A[1], B[1], u), H.lerp(A[2], B[2], u), H.lerp(A[3], B[3], u)];
  }
  // the step card's states: [start, badge, title lines, sub lines]
  const STEPS = [[2.5, '1', ['Open it in Safari'], ['Tap Sign up free', 'on our website']], [5.4, '2', ['Tap Share'], ['Tap ⋯ at the bottom,', 'then Share']], [8.3, '2', ['Tap View More'], ['The last round', 'button']], [10.0, '2', ['Add to', 'Home Screen'], ['In the list that', 'opens']], [12.8, '3', ['Tap Add'], ['Top right. Leave', 'Open as Web App on']], [15.9, '✓', ['It’s on your', 'Home Screen'], ['Look for the', 'green leaf']], [18.8, '✓', ['Opens full', 'screen'], ['No Safari bars.', 'Just your stash.']]];

  function explainer(ctx, W, H_, t, o = {}) {
    const ph = (a, b) => H.clamp((t - a) / (b - a));
    const E = (a, b) => H.ease.inOut(ph(a, b));
    const EO = (a, b) => H.ease.out(ph(a, b));
    const typed = (str, a, b) => str.slice(0, Math.round(str.length * ph(a, b)));
    const [camX, camY, z] = o.cam || cam(t);
    const S = (wx, wy) => [640 + (wx - camX) * z, 360 + (wy - camY) * z];   // world -> screen
    const d = (p, a) => Math.sin(t * 0.5 + p) * a;

    // ---------- background: lights + blurred leaves in screen space, drifting with a slow parallax ----------
    const BG = H.layer(W, H_), b = BG.getContext('2d');
    const base = b.createLinearGradient(0, 0, W, H_); base.addColorStop(0, '#03070a'); base.addColorStop(1, '#06170f');
    b.fillStyle = base; b.fillRect(0, 0, W, H_);
    const bloom = (i) => 0.35 + 0.65 * H.ease.out(ph(i * 0.12, 0.9 + i * 0.12));
    const blob = (x, y, r, col, a = 1) => { const hot = col === '#ffb35c', mid = hot ? '#ff8a3c' : col, tail = hot ? '#ff5a7a' : col; const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, H.rgba(col, a)); g.addColorStop(0.5, H.rgba(mid, a * 0.55)); g.addColorStop(1, H.rgba(tail, 0)); b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2); };
    const par = (wx) => 640 + (wx - camX) * 0.35 * Math.max(z, 0.6);
    const BL = [[180, 150, '#1fbf6a'], [760, 640, '#40c4c4'], [1180, 140, '#8b7bff'], [520, 330, '#58e08c'], [1320, 600, '#1fbf6a'], [-120, 620, '#8b7bff'], [980, 420, '#ffb35c']];
    BL.forEach(([x, y, c], i) => { const k = bloom(i % 4); blob(par(x) + d(i, 30), y + d(i + 2, 20), (c === '#ffb35c' ? 230 : i % 2 ? 330 : 370) * k, c, (c === '#ffb35c' ? 0.55 : 0.8) * k); });
    const pool = (x, y, r, a) => { const g = b.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(3,7,10,${a})`); g.addColorStop(0.55, `rgba(3,7,10,${a * 0.6})`); g.addColorStop(1, 'rgba(3,7,10,0)'); b.fillStyle = g; b.fillRect(x - r, y - r, r * 2, r * 2); };
    pool(0, H_, 480, 0.6); pool(W, 0, 400, 0.45);
    // two big leaves floating in the lights (the frost blurs them into soft green fans)
    const bigLeaf = (x, y, s, rot, a) => { b.save(); b.translate(x, y); b.rotate(rot); b.scale(s / 24, s / 24); b.translate(-12, -12.5); const g = b.createLinearGradient(0, 3, 0, 22); g.addColorStop(0, H.rgba('#b6ffd4', a)); g.addColorStop(0.55, H.rgba('#58e08c', a)); g.addColorStop(1, H.rgba('#1f8f50', a * 0.6)); b.fillStyle = g; b.fill(LEAF); b.restore(); };
    bigLeaf(par(1060) + d(1, 14), 300 + d(3, 12), 420 * bloom(1), -0.25 + d(4, 0.06), 0.42);
    bigLeaf(par(140) + d(2, 12), 560 + d(5, 10), 300 * bloom(2), 0.35 + d(6, 0.06), 0.32);
    const orb = (x, y, r, c1, c2, c3) => { const g = b.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.05, x, y, r); g.addColorStop(0, c1); g.addColorStop(0.55, c2); g.addColorStop(1, c3); b.fillStyle = g; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill(); };
    orb(par(-40) + d(5, 10), 650, 70, '#d6ffe6', '#58e08c', '#0d4a26');
    orb(par(120) + d(6, 10), 120, 56, '#e3dcff', '#8b7bff', '#2a1f7a');
    orb(par(1300), 660, 34, '#ffe3b8', '#ffb35c', '#8a3f12');
    b.strokeStyle = 'rgba(255,255,255,0.035)'; b.lineWidth = 1; b.beginPath();
    const gx = (-(camX * z) % 48 + 48) % 48;
    for (let x = gx; x <= W; x += 48 * z) { b.moveTo(x + 0.5, 0); b.lineTo(x + 0.5, H_); }
    for (let y = 0; y <= H_; y += 48 * z) { b.moveTo(0, y + 0.5); b.lineTo(W, y + 0.5); }
    b.stroke();
    b.globalAlpha = 0.05; b.fillStyle = noisePattern(b); b.fillRect(0, 0, W, H_); b.globalAlpha = 1;
    ctx.drawImage(BG, 0, 0);
    let SRC = blurOf(BG, W, H_, 26);

    // ---------- the phone (world) ----------
    ctx.save();
    ctx.translate(640, 360); ctx.scale(z, z); ctx.translate(-camX, -camY);
    const pin = EO(2.1, 2.8);
    if (pin > 0) {
      ctx.save(); ctx.globalAlpha = pin; ctx.translate(0, (1 - pin) * 60);
      glass(ctx, SRC, PX, PY, PW, PH, 58, { tint: 0.12, shadow: 60 });
      // side buttons
      ctx.fillStyle = 'rgba(255,255,255,0.28)'; rr(ctx, PX - 3, PY + 150, 3, 56, 2); ctx.fill(); rr(ctx, PX - 3, PY + 220, 3, 56, 2); ctx.fill(); rr(ctx, PX + PW, PY + 180, 3, 86, 2); ctx.fill();
      ctx.save(); rr(ctx, SX, SY, SW, SH, SR); ctx.clip();
      const home = E(15.25, 15.75);
      if (home < 1) safariScreen(ctx, t, ph, EO, E, typed);
      // frost wipe: the Safari screen frosts over, the Home Screen clears in under it
      const fw = E(14.8, 15.3) * (1 - E(15.5, 15.9));
      if (fw > 0.01) { const F = blurOf(ctx.canvas, W, H_, 4 + 22 * fw); ctx.save(); ctx.globalAlpha = fw; const M = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(F, 0, 0, ctx.canvas.width, ctx.canvas.height); ctx.setTransform(M); ctx.fillStyle = `rgba(255,255,255,${0.08 * fw})`; ctx.fillRect(SX, SY, SW, SH); ctx.restore(); }
      if (home > 0) { ctx.save(); ctx.globalAlpha = home; homeScreen(ctx, t, ph, EO); ctx.restore(); }
      // the app opens out of its icon
      const ao = EO(18.35, 18.95);
      if (ao > 0) {
        const x = H.lerp(ICON.x, SX, ao), y = H.lerp(ICON.y, SY, ao), w = H.lerp(ICON.s, SW, ao), h = H.lerp(ICON.s, SH, ao);
        ctx.save(); ctx.globalAlpha = Math.min(1, ao * 2.5); rr(ctx, x, y, w, h, H.lerp(11, SR, ao)); ctx.clip();
        ctx.translate(x, y); ctx.scale(w / SW, h / SH); appScreen(ctx, t, ph, EO); ctx.restore();
      }
      // a faint glass sheen across the screen
      const sg = ctx.createLinearGradient(SX, SY, SX + SW * 0.7, SY + SH * 0.5); sg.addColorStop(0, 'rgba(255,255,255,0.09)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.02)'); sg.addColorStop(0.51, 'rgba(255,255,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(SX, SY, SW, SH);
      // Dynamic Island
      ctx.fillStyle = '#000'; rr(ctx, SX + SW / 2 - 46, SY + 10, 92, 26, 13); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; rr(ctx, SX - 0.5, SY - 0.5, SW + 1, SH + 1, SR); ctx.stroke();
      ctx.restore();
    }
    ctx.restore(); // world

    // ---------- glass over glass: header, step card, pills, arrows (re-blur the frame) ----------
    SRC = blurOf(ctx.canvas, W, H_, 20);
    if (o.bare) return { SRC, S };
    // hook card -> header
    {
      const sh = E(1.5, 2.3), a = EO(0.1, 0.6);
      const w = H.lerp(880, 470, sh), h = H.lerp(270, 80, sh), x = H.lerp(640 - 440, 765, sh), y = H.lerp(230, 64, sh) + (1 - a) * 30;
      ctx.save(); ctx.globalAlpha = a; glass(ctx, SRC, x, y, w, h, H.lerp(40, 26, sh), { shadow: H.lerp(50, 22, sh), tint: 0.1 });
      const is = H.lerp(150, 52, sh); appIcon(ctx, x + H.lerp(48, 18, sh), y + (h - is) / 2, is);
      const tx = x + H.lerp(230, 88, sh), fs = H.lerp(64, 32, sh);
      const hg = ctx.createLinearGradient(tx, 0, tx + 420, 0); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#b6ffd4');
      ctx.font = `800 ${fs}px "Inter"`; ctx.fillStyle = hg; ctx.textBaseline = 'middle';
      ctx.fillText('Green Tracker', tx, y + h / 2 + H.lerp(-38, 2, sh));
      ctx.globalAlpha = a * (1 - ph(1.5, 1.9));
      ctx.fillStyle = '#ffffff'; ctx.fillText('on your iPhone', tx, y + h / 2 + 40);
      ctx.textBaseline = 'alphabetic';
      if (sh < 0.5) { ctx.globalAlpha = a * (1 - sh * 2) * EO(0.5, 0.9); chipPill(ctx, 640, y - 40, '20 seconds · in Safari', { dot: '#58e08c', bg: 'rgba(255,255,255,0.14)' }); }
      ctx.restore();
    }
    // the step card (morphs into the takeaway at the end)
    const tk = E(21, 21.8);
    const CX = H.lerp(770, 590, tk), CY = H.lerp(178, 160, tk), CW = H.lerp(460, 650, tk), CH = H.lerp(372, 480, tk);
    const cin = EO(2.5, 3.1);
    if (cin > 0) {
      ctx.save(); ctx.globalAlpha = cin; glass(ctx, SRC, CX, CY + (1 - cin) * 40, CW, CH, 32, { tint: 0.1, shadow: 44 }); ctx.restore();
      let si = -1; for (let i = 0; i < STEPS.length; i++) if (t >= STEPS[i][0]) si = i;
      const content = (st, alpha, dy) => {
        if (!st || alpha <= 0) return;
        ctx.save(); ctx.globalAlpha = cin * alpha * (1 - tk);
        st[2].forEach((s, i) => T(ctx, s, CX + 36, CY + 196 + i * 54 + dy + (1 - cin) * 40, '800 46px "Inter"', '#ffffff'));
        const sy = CY + 196 + st[2].length * 54 + 14;
        st[3].forEach((s, i) => T(ctx, s, CX + 36, sy + i * 38 + dy + (1 - cin) * 40, '400 28px "Inter"', 'rgba(255,255,255,0.82)'));
        ctx.restore();
      };
      if (si >= 0) {
        const cur = STEPS[si], prev = STEPS[si - 1], ts = cur[0];
        const outP = ph(ts, ts + 0.25), inP = EO(ts + 0.1, ts + 0.45);
        if (si > 0 && outP < 1) content(prev, 1 - outP, -24 * outP);
        content(cur, si === 0 ? 1 : inP, (1 - (si === 0 ? 1 : inP)) * 24);
        // badge: the number flips when it changes
        const bx = CX + 78, by = CY + 84 + (1 - cin) * 40;
        ctx.save(); ctx.globalAlpha = cin * (1 - tk);
        const done = cur[1] === '✓';
        const flip = prev && prev[1] !== cur[1] ? H.ease.back(ph(ts, ts + 0.4)) : 1;
        ctx.save(); ctx.translate(bx, by); ctx.scale(0.75 + 0.25 * flip, 0.75 + 0.25 * flip);
        const g = ctx.createLinearGradient(-50, -50, 50, 50); g.addColorStop(0, done ? '#b6ffd4' : '#7af0b0'); g.addColorStop(1, done ? '#1fbf6a' : '#40c4c4');
        ctx.shadowColor = 'rgba(88,224,140,0.6)'; ctx.shadowBlur = 24; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 52, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        if (done) line(ctx, [[-20, 2], [-6, 17], [22, -15]], '#03140a', 9);
        else T(ctx, cur[1], 0, 4, '800 72px "Inter"', '#03140a', 'center', 'middle');
        ctx.restore();
        T(ctx, done ? 'Done' : `Step ${cur[1]} of 3`, bx + 76, by + 10, '600 30px "Inter"', 'rgba(255,255,255,0.85)');
        ctx.restore();
      }
      // takeaway: the card grows and lists the three taps
      if (tk > 0) {
        ctx.save(); ctx.globalAlpha = tk;
        const hg = ctx.createLinearGradient(CX, 0, CX + 520, 0); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, '#b6ffd4');
        T(ctx, 'Get it in 3 steps', CX + 40, CY + 82, '800 52px "Inter"', hg);
        const rows = [['1', 'Open it in Safari'], ['2', 'Share → Add to Home Screen'], ['3', 'Tap Add']];
        rows.forEach(([n, s], i) => {
          const e = H.ease.back(ph(21.5 + i * 0.25, 21.85 + i * 0.25)); if (e <= 0) return;
          const ry = CY + 150 + i * 92;
          ctx.save(); ctx.globalAlpha = tk * Math.min(1, e); ctx.translate(CX + 74, ry + 30); ctx.scale(e, e);
          const g = ctx.createLinearGradient(-32, -32, 32, 32); g.addColorStop(0, '#7af0b0'); g.addColorStop(1, '#40c4c4');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 32, 0, 7); ctx.fill(); T(ctx, n, 0, 3, '800 38px "Inter"', '#03140a', 'center', 'middle'); ctx.restore();
          ctx.save(); ctx.globalAlpha = tk * Math.min(1, e); T(ctx, s, CX + 128, ry + 42, '600 34px "Inter"', '#ffffff'); ctx.restore();
        });
        ctx.restore();
        const fe = EO(22.2, 22.6);
        if (fe > 0) chipPill(ctx, CX + CW / 2, CY + CH - 50, 'Roll one up and rate it', { k: fe, grad: ['#58e08c', '#40c4c4'], col: '#03140a', font: '800 30px "Inter"', h: 56 });
      }
    }
    // ---------- arrows from the card to what to tap, fingertip taps, labels ----------
    const fromCard = [CX, CY + 220];
    const arrow = (a0, a1, target, fade, bend = 0) => {
      if (t < a0 || fade <= 0) return;
      ctx.save(); ctx.globalAlpha = fade;
      const c = [(fromCard[0] + target[0]) / 2 + 20, Math.min(fromCard[1], target[1]) - 60 + bend];
      glowLine(ctx, fromCard, c, target, E(a0, a1), '#58e08c', '#b6ffd4', 3.5, 3, t);
      ctx.restore();
    };
    const tap = (wx, wy, t0) => {
      if (t < t0 - 0.35 || t > t0 + 0.6) return;  // fingertip leaves quickly; the ripple carries on
      const [x, y] = S(wx, wy);
      const fin = EO(t0 - 0.35, t0 - 0.1) * (1 - ph(t0 + 0.12, t0 + 0.3)), press = t < t0 ? 1 - 0.18 * ph(t0 - 0.1, t0) : 0.82 + 0.18 * EO(t0, t0 + 0.2);
      if (fin > 0) { ctx.save(); ctx.globalAlpha = fin; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 18; ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.beginPath(); ctx.arc(x, y, 30 * press, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
      if (t >= t0) { const r = EO(t0, t0 + 0.55); ctx.save(); ctx.globalAlpha = 1 - r; ctx.strokeStyle = '#b6ffd4'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 16; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 26 + 46 * r, 0, 7); ctx.stroke(); ctx.restore(); }
    };
    arrow(5.9, 6.4, (() => { const p = S(DOTS[0], DOTS[1]); return [p[0] + 10, p[1] - 34]; })(), 1 - ph(6.8, 7.1), 60);
    tap(DOTS[0], DOTS[1], 6.8);
    tap(MENU.x + 80, MENU.y + 22, 7.5);
    if (t > 6.1 && t < 7.9) chipPill(ctx, CX + CW / 2, CY + CH + 52, 'Share button in the bar? Tap it', { k: EO(6.1, 6.4) * (1 - ph(7.6, 7.9)), bg: 'rgba(255,255,255,0.18)', dot: '#ffb35c' });
    arrow(8.7, 9.2, (() => { const p = S(VM[0], VM[1]); return [p[0] + 34, p[1] - 6]; })(), 1 - ph(9.6, 9.9), 0);
    tap(VM[0], VM[1], 9.5);
    arrow(10.4, 10.9, (() => { const p = S(SX + SW - 16, HROW_Y); return [p[0] + 12, p[1]]; })(), 1 - ph(11.6, 11.9), -20);
    tap(SX + 130, HROW_Y, 11.4);
    arrow(13.7, 14.2, (() => { const p = S(ADD_BTN[0], ADD_BTN[1]); return [p[0] + 20, p[1] + 26]; })(), 1 - ph(14.7, 15), 120);
    tap(ADD_BTN[0], ADD_BTN[1], 14.6);
    // the new icon: label pill on a glowing line
    if (t > 16.7 && t < 21.1) {
      const p = S(ICON.x + ICON.s / 2, ICON.y + ICON.s + 4), k = EO(16.7, 17) * (1 - ph(17.9, 18.2));
      if (k > 0) { ctx.save(); ctx.globalAlpha = k; glowLine(ctx, [p[0], p[1] + 70], [p[0], p[1] + 40], [p[0], p[1] + 6], E(16.7, 17), '#40c4c4', '#b6ffd4', 3); ctx.restore(); chipPill(ctx, p[0], p[1] + 100, 'Green Tracker', { k, grad: ['#58e08c', '#40c4c4'], col: '#03140a', font: '800 30px "Inter"', h: 54 }); }
    }
    tap(ICON.x + ICON.s / 2, ICON.y + ICON.s / 2, 18.1);
    if (t > 19.3 && t < 21.5) {
      const k = EO(19.3, 19.6) * (1 - ph(20.9, 21.3)), p = S(SX + 14, SY + 44), q = S(SX + 14, SY + SH - 54);
      ctx.save(); ctx.globalAlpha = k; glowLine(ctx, [190, 330], [210, 140], [p[0] - 6, p[1]], E(19.4, 19.8), '#8b7bff', '#b6ffd4', 3); glowLine(ctx, [190, 400], [210, 560], [q[0] - 6, q[1]], E(19.4, 19.8), '#8b7bff', '#b6ffd4', 3); ctx.restore();
      chipPill(ctx, 190, 365, 'No Safari bars', { k, grad: ['#8b7bff', '#40c4c4'], glow: 'rgba(139,123,255,0.5)', font: '800 30px "Inter"', h: 54 });
    }
  }

  // ---------- phone screens (world coordinates, clipped to the screen) ----------
  function statusBar(ctx, light = true) {
    T(ctx, '9:41', SX + 40, SY + 30, '600 17px "Inter"', light ? '#fff' : '#000');
    ctx.fillStyle = '#fff'; [0, 1, 2, 3].forEach((i) => { rr(ctx, SX + SW - 86 + i * 6, SY + 26 - 4 - i * 3, 4, 6 + i * 3, 1); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.2; rr(ctx, SX + SW - 54, SY + 15, 26, 13, 4); ctx.stroke(); rr(ctx, SX + SW - 52, SY + 17, 19, 9, 2); ctx.fill();
  }
  function auroraWall(ctx, ox, oy, w, h, t, k = 1) {
    ctx.fillStyle = '#03070a'; ctx.fillRect(ox, oy, w, h);
    const glow = (x, y, r, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, H.rgba(c, a)); g.addColorStop(1, H.rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(ox + w * 0.2 + Math.sin(t * 0.6) * 12, oy + h * 0.18, 200, '#1fbf6a', 0.45 * k);
    glow(ox + w * 0.9, oy + h * 0.45 + Math.cos(t * 0.5) * 14, 190, '#8b7bff', 0.35 * k);
    glow(ox + w * 0.3, oy + h * 0.85, 200, '#40c4c4', 0.3 * k);
  }
  // Safari on iOS 26, as on Anton's iPhone: the app's welcome page, the compact bar (‹, address, ⋯), the ⋯ menu,
  // the share sheet (people, apps, round buttons, View More), then the Add to Home Screen sheet with its keyboard.
  const leafAt = (ctx, cx, cy, s) => { ctx.save(); ctx.translate(cx, cy); ctx.scale(s / 24, s / 24); ctx.translate(-12, -12.5); leafFill(ctx); ctx.restore(); };
  const fitText = (ctx, s, w, font) => { ctx.font = font; if (ctx.measureText(s).width <= w) return s; while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1); return s + '…'; };
  const WELCOME = [['Wedding Cake', '9.7', 'holo'], ['Gelato 41', '9.2', '#8b7bff'], ['Zkittlez', '8.7', '#4f8dff']];
  function safariScreen(ctx, t, ph, EO, E, typed) {
    const loaded = EO(3.95, 4.4);
    ctx.fillStyle = '#0b0d0f'; ctx.fillRect(SX, SY, SW, SH);
    if (loaded > 0) {
      ctx.save(); ctx.globalAlpha = loaded;
      auroraWall(ctx, SX, SY, SW, SH, t);
      // the app's welcome page (client/src/screens/SignIn.tsx): the name, a headline, an example Leaderboard
      ctx.font = '800 19px "Inter"'; const bw = ctx.measureText('Green Tracker').width + 30;
      leafAt(ctx, SX + SW / 2 - bw / 2 + 11, SY + 76, 24); T(ctx, 'Green Tracker', SX + SW / 2 - bw / 2 + 30, SY + 83, '800 19px "Inter"', '#fff');
      const hg = ctx.createLinearGradient(SX + 60, 0, SX + 220, 0); hg.addColorStop(0, '#b6ffd4'); hg.addColorStop(1, '#40c4c4');
      T(ctx, 'Your stash,', SX + SW / 2, SY + 136, '800 34px "Inter"', '#fff', 'center'); T(ctx, 'ranked.', SX + SW / 2, SY + 176, '800 34px "Inter"', hg, 'center');
      T(ctx, 'Rate, rank and remember', SX + SW / 2, SY + 206, '400 14px "Inter"', 'rgba(255,255,255,0.72)', 'center');
      T(ctx, 'everything you’ve tried.', SX + SW / 2, SY + 224, '400 14px "Inter"', 'rgba(255,255,255,0.72)', 'center');
      WELCOME.forEach(([n, s, c], i) => {
        const y = SY + 250 + i * 72;
        ctx.save(); ctx.translate(SX + SW / 2, y + 30); ctx.rotate([-0.03, 0.02, -0.015][i]); ctx.translate(-(SX + SW / 2), -(y + 30));
        ctx.fillStyle = i === 0 ? 'rgba(30,40,48,0.9)' : 'rgba(26,24,52,0.9)'; rr(ctx, SX + 14 + i * 6, y, SW - 28 - i * 6, 60, 16); ctx.fill();
        let edge = c; if (c === 'holo') { edge = ctx.createLinearGradient(SX, y, SX + SW, y + 60); ['#ff9aa8', '#ffc996', '#fff2a8', '#a6f0c1', '#9fdcff', '#cdbdff'].forEach((h, k) => edge.addColorStop(k / 5, h)); }
        ctx.strokeStyle = edge; ctx.lineWidth = 1.6; ctx.shadowColor = c === 'holo' ? 'rgba(166,240,193,0.6)' : H.rgba(c, 0.5); ctx.shadowBlur = 10; ctx.stroke(); ctx.shadowBlur = 0;
        const x0 = SX + 14 + i * 6;
        T(ctx, String(i + 1), x0 + 18, y + 38, '800 15px "Inter"', i === 0 ? '#cdbdff' : '#e0dcff', 'center');
        ctx.fillStyle = 'rgba(255,255,255,0.07)'; rr(ctx, x0 + 32, y + 9, 42, 42, 10); ctx.fill(); leafAt(ctx, x0 + 53, y + 31, 22);
        T(ctx, n, x0 + 84, y + 36, '600 15px "Inter"', '#fff');
        const sg = ctx.createLinearGradient(0, y + 12, 0, y + 40); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, c === 'holo' ? '#a6f0c1' : c);
        T(ctx, s, SX + SW - 26, y + 34, '800 21px "Inter"', sg, 'right'); T(ctx, 'OVERALL', SX + SW - 26, y + 48, '600 8px "Inter"', 'rgba(255,255,255,0.7)', 'right');
        ctx.restore();
      });
      ctx.restore();
    }
    statusBar(ctx);
    // the compact bar, floating glass: back, the address, ⋯
    const by = BAR_Y;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(SX, by - 40, SW, SH);
    const pill = (x, w) => { ctx.fillStyle = 'rgba(58,58,62,0.82)'; rr(ctx, x, by - 22, w, 44, 22); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.stroke(); };
    pill(SX + 12, 44); line(ctx, [[SX + 38, by - 8], [SX + 30, by], [SX + 38, by + 8]], '#fff', 2.4);
    pill(SX + 62, SW - 124);
    const url = 'green-tracker.green-tracker.workers.dev', shown = fitText(ctx, t < 3.7 ? typed(url, 2.9, 3.6) : url, SW - 150, '400 14px "Inter"');
    T(ctx, shown, SX + SW / 2, by + 5, '400 14px "Inter"', '#f2f2f7', 'center');
    if (t > 2.9 && t < 3.7 && Math.sin(t * 14) > 0) { ctx.font = '400 14px "Inter"'; const w = ctx.measureText(shown).width; ctx.fillStyle = BLUE; ctx.fillRect(SX + SW / 2 + w / 2 + 2, by - 9, 2, 18); }
    const lb = ph(3.6, 4.1); if (lb > 0 && lb < 1) { ctx.fillStyle = BLUE; ctx.fillRect(SX + 72, by + 18, (SW - 144) * H.ease.out(lb), 2.5); }
    pill(SX + SW - 56, 44); [-8, 0, 8].forEach((dx) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(DOTS[0] + dx, by, 2.4, 0, 7); ctx.fill(); });
    const hl = H.clamp(ph(6.0, 6.3)) * (1 - ph(6.8, 7.0)) * (0.75 + 0.25 * Math.sin(t * 9));
    if (hl > 0) { ctx.save(); ctx.globalAlpha = hl; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 18; ctx.strokeStyle = '#b6ffd4'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(DOTS[0], DOTS[1], 27, 0, 7); ctx.stroke(); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(ctx, SX + SW / 2 - 60, SY + SH - 12, 120, 5, 3); ctx.fill();
    // ---- the ⋯ menu pops up from its button; Share is first
    const mk = H.ease.back(ph(6.88, 7.15)) * (1 - ph(7.6, 7.75));
    if (mk > 0.001) {
      ctx.save(); ctx.translate(MENU.x + MENU.w, MENU.y + MENU.h); ctx.scale(mk, mk); ctx.translate(-(MENU.x + MENU.w), -(MENU.y + MENU.h)); ctx.globalAlpha = Math.min(1, mk);
      ctx.fillStyle = 'rgba(44,44,48,0.96)'; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; rr(ctx, MENU.x, MENU.y, MENU.w, MENU.h, 22); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
      ['Share', 'Add to Bookmarks', 'Add to Favourites', 'Find on Page'].forEach((s, i) => {
        const ry = MENU.y + i * 44;
        if (i === 0) { const k = EO(7.15, 7.35); if (k > 0) { ctx.fillStyle = `rgba(88,224,140,${0.25 * k + (t > 7.5 && t < 7.65 ? 0.2 : 0)})`; rr(ctx, MENU.x + 6, ry + 5, MENU.w - 12, 36, 14); ctx.fill(); } }
        T(ctx, s, MENU.x + 44, ry + 29, `${i ? 400 : 600} 16px "Inter"`, '#fff');
        if (i === 0) shareGlyph(ctx, MENU.x + 22, ry + 22, 18, '#fff', 1.8);
        else { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6; rr(ctx, MENU.x + 15, ry + 15, 14, 14, 3); ctx.stroke(); }
        if (i < 3) { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(MENU.x + 14, ry + 43.5, MENU.w - 28, 1); }
      });
      ctx.restore();
    }
    // ---- the share sheet slides up; View More opens the list with Add to Home Screen
    const up = H.ease.out(ph(7.6, 8.15));
    if (up > 0) {
      ctx.fillStyle = `rgba(0,0,0,${0.3 * up})`; ctx.fillRect(SX, SY, SW, SH);
      const top = SHEET_TOP + (1 - up) * (SH - 80);
      const F = blurOf(ctx.canvas, ctx.canvas.width, ctx.canvas.height, 18);
      glass(ctx, F, SX + 4, top, SW - 8, SH + 40, 34, { tint: 0.04, shadow: 30, dark: 0.6 });
      ctx.save(); rr(ctx, SX + 4, top, SW - 8, SH + 40, 34); ctx.clip();
      const c = top - VM_SCROLL * E(9.6, 10.2), x0 = SX + 18;
      // header: the page's icon, name, address, Options, close
      ctx.fillStyle = '#ffffff'; rr(ctx, x0, c + 22, 58, 58, 14); ctx.fill(); appIcon(ctx, x0 + 11, c + 33, 36);
      T(ctx, 'Green Tracker', x0 + 72, c + 40, '600 16px "Inter"', '#fff');
      T(ctx, fitText(ctx, 'green-tracker.green-tracker.workers.dev', SW - 150, '400 12px "Inter"'), x0 + 72, c + 58, '400 12px "Inter"', 'rgba(255,255,255,0.6)');
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; rr(ctx, x0 + 72, c + 66, 86, 24, 12); ctx.stroke(); T(ctx, 'Options ›', x0 + 115, c + 83, '400 12px "Inter"', '#fff', 'center');
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(SX + SW - 34, c + 40, 16, 0, 7); ctx.stroke(); line(ctx, [[SX + SW - 40, c + 34], [SX + SW - 28, c + 46]], '#fff', 2); line(ctx, [[SX + SW - 28, c + 34], [SX + SW - 40, c + 46]], '#fff', 2);
      const div = (y) => { ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, y, SW - 36, 1); };
      div(c + 104);
      // people (plain figures, never real contacts)
      for (let i = 0; i < 4; i++) {
        const cx = x0 + 25 + i * 66, cy = c + 140;
        ctx.fillStyle = ['#5b6b7a', '#7a6b5b', '#5b7a6b', '#6b5b7a'][i]; ctx.beginPath(); ctx.arc(cx, cy, 24, 0, 7); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 24, 0, 7); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(cx, cy - 5, 8, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy + 18, 15, 11, 0, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, cx - 18, c + 172, 36, 5, 2.5); ctx.fill();
      }
      div(c + 190);
      // apps
      const apps = ['AirDrop', 'Messages', 'Mail', 'Notes'];
      apps.forEach((a, i) => {
        const ax = x0 + i * 66, ay = c + 202;
        ctx.fillStyle = i === 3 ? '#2c2c2e' : '#1f1f22'; rr(ctx, ax, ay, 50, 50, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
        if (i === 0) { ctx.strokeStyle = '#2f8cff'; ctx.lineWidth = 3; [16, 10].forEach((r) => { ctx.beginPath(); ctx.arc(ax + 25, ay + 30, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }); ctx.fillStyle = '#2f8cff'; ctx.beginPath(); ctx.arc(ax + 25, ay + 28, 4, 0, 7); ctx.fill(); }
        if (i === 1) { ctx.fillStyle = '#34c759'; ctx.beginPath(); ctx.ellipse(ax + 25, ay + 24, 16, 12, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(ax + 14, ay + 30); ctx.lineTo(ax + 11, ay + 38); ctx.lineTo(ax + 20, ay + 33); ctx.fill(); }
        if (i === 2) { ctx.fillStyle = '#3d7bff'; rr(ctx, ax + 9, ay + 14, 32, 22, 3); ctx.fill(); line(ctx, [[ax + 10, ay + 15], [ax + 25, ay + 27], [ax + 40, ay + 15]], '#0f2a6b', 1.6); }
        if (i === 3) { ctx.fillStyle = '#ffd60a'; rr(ctx, ax, ay, 50, 13, [12, 12, 0, 0]); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(ax + 8, ay + 26, 34, 1.5); ctx.fillRect(ax + 8, ay + 36, 34, 1.5); }
        T(ctx, a, ax + 25, ay + 66, '400 11px "Inter"', '#fff', 'center');
      });
      div(c + 282);
      // the round buttons; the last one is View More
      const expanded = t >= 9.6;
      [['Copy'], ['Add to', 'Bookmarks'], ['Add to Reading', 'List'], expanded ? ['View Less'] : ['View More']].forEach((lab, i) => {
        const cx = x0 + 25 + i * 66, cy = c + 318;
        const vm = i === 3, hk = vm ? H.clamp(ph(8.9, 9.2)) * (1 - ph(9.55, 9.8)) : 0, press = vm && t > 9.5 && t < 9.65;
        ctx.fillStyle = press ? 'rgba(88,224,140,0.45)' : 'rgba(255,255,255,0.13)'; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, 7); ctx.fill();
        if (hk > 0) { ctx.save(); ctx.globalAlpha = hk * (0.75 + 0.25 * Math.sin(t * 9)); ctx.strokeStyle = '#b6ffd4'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 16; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, 29, 0, 7); ctx.stroke(); ctx.restore(); }
        const w = '#fff';
        if (i === 0) { ctx.strokeStyle = w; ctx.lineWidth = 1.8; rr(ctx, cx - 5, cy - 9, 12, 15, 2); ctx.stroke(); rr(ctx, cx - 9, cy - 5, 12, 15, 2); ctx.stroke(); }
        if (i === 1) line(ctx, [[cx - 6, cy - 10], [cx + 6, cy - 10], [cx + 6, cy + 10], [cx, cy + 5], [cx - 6, cy + 10], [cx - 6, cy - 10]], w, 1.8);
        if (i === 2) { ctx.strokeStyle = w; ctx.lineWidth = 1.8; [-7, 7].forEach((dx) => { ctx.beginPath(); ctx.arc(cx + dx, cy, 5, 0, 7); ctx.stroke(); }); line(ctx, [[cx - 2, cy], [cx + 2, cy]], w, 1.8); }
        if (i === 3) line(ctx, expanded ? [[cx - 9, cy + 4], [cx, cy - 5], [cx + 9, cy + 4]] : [[cx - 9, cy - 4], [cx, cy + 5], [cx + 9, cy - 4]], w, 2.4);
        lab.forEach((s, k) => T(ctx, s, cx, c + 360 + k * 14, `${vm ? 600 : 400} 9.5px "Inter"`, '#fff', 'center'));
      });
      // the list View More opens
      const la = EO(9.65, 10.1);
      if (la > 0) {
        ctx.save(); ctx.globalAlpha = la; const ly = c + 392 + (1 - la) * 20;
        ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x0 - 4, ly, SW - 28, LIST.length * 46, 18); ctx.fill();
        LIST.forEach((s, i) => {
          const ry = ly + i * 46, isHome = i === HOMEROW;
          const hi = isHome ? EO(10.5, 10.8) : 0;
          if (hi > 0) { ctx.save(); const flash = t > 11.4 && t < 11.6 ? 0.25 : 0; ctx.fillStyle = `rgba(88,224,140,${0.24 * hi + flash})`; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 20 * hi; rr(ctx, x0 - 2, ry + 3, SW - 32, 40, 13); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = H.rgba('#b6ffd4', hi); ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
          if (isHome) plusSquare(ctx, x0 + 14, ry + 23, 18, '#fff', 1.8);
          else { ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6; rr(ctx, x0 + 7, ry + 16, 14, 14, 3); ctx.stroke(); }
          T(ctx, s, x0 + 34, ry + 29, `${isHome ? 600 : 400} ${isHome ? 19 : 16}px "Inter"`, '#fff');
          if (i < LIST.length - 1) { ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x0 + 34, ry + 45.5, SW - 66, 1); }
        });
        ctx.restore();
      }
      ctx.restore();
    }
    // ---- the Add to Home Screen sheet (as on iOS 26: close, title, a blue Add button; the name field has the keyboard up)
    const as = H.ease.out(ph(11.95, 12.5));
    if (as > 0) {
      ctx.fillStyle = `rgba(0,0,0,${0.3 * as})`; ctx.fillRect(SX, SY, SW, SH);
      const top = SY + 44 + (1 - as) * SH;
      ctx.fillStyle = '#1c1c1e'; rr(ctx, SX, top, SW, SH, 30); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
      const ny = top + 44;
      ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(SX + 34, ny, 19, 0, 7); ctx.fill(); line(ctx, [[SX + 28, ny - 6], [SX + 40, ny + 6]], '#fff', 2.2); line(ctx, [[SX + 40, ny - 6], [SX + 28, ny + 6]], '#fff', 2.2);
      T(ctx, 'Add to Home Screen', SX + SW / 2 - 12, ny + 5, '600 13px "Inter"', '#fff', 'center');
      const ab = t > 13.3 ? 0.5 + 0.5 * Math.sin((t - 13.3) * 7) : 0, pressed = t > 14.6 && t < 14.8;
      if (ab > 0 && t < 14.9) { ctx.save(); ctx.globalAlpha = 0.5 + 0.5 * ab; ctx.strokeStyle = '#b6ffd4'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 16; ctx.lineWidth = 2.5; rr(ctx, ADD_BTN[0] - 34, ny - 22, 68, 44, 22); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = pressed ? '#5aa9ff' : BLUE; rr(ctx, ADD_BTN[0] - 29, ny - 18, 58, 36, 18); ctx.fill();
      T(ctx, 'Add', ADD_BTN[0], ny + 6, '700 17px "Inter"', '#fff', 'center');
      ctx.fillStyle = '#2c2c2e'; ctx.fillRect(SX, top + 78, SW, 96);
      appIcon(ctx, SX + 14, top + 90, 62);
      T(ctx, 'Green Tracker', SX + 90, top + 114, '400 17px "Inter"', '#fff');
      if (Math.sin(t * 6) > 0) { ctx.fillStyle = BLUE; ctx.fillRect(SX + 207, top + 99, 2, 20); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(SX + SW - 20, top + 108, 8, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(SX + 90, top + 128, SW - 90, 1);
      T(ctx, fitText(ctx, 'https://green-tracker.green-tracker.workers.dev', SW - 104, '400 12px "Inter"'), SX + 90, top + 156, '400 12px "Inter"', 'rgba(255,255,255,0.45)');
      ctx.fillStyle = '#2c2c2e'; ctx.fillRect(SX, top + 196, SW, 50);
      T(ctx, 'Open as Web App', SX + 16, top + 227, '400 17px "Inter"', '#fff');
      const tx = SX + SW - 66, ty = top + 206; ctx.fillStyle = '#34c759'; rr(ctx, tx, ty, 52, 30, 15); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, tx + 20, ty + 3, 29, 24, 12); ctx.fill();
      const wl = EO(13.4, 13.7) * (1 - ph(14.4, 14.7)); if (wl > 0) { ctx.save(); ctx.globalAlpha = wl; ctx.strokeStyle = '#b6ffd4'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 14; ctx.lineWidth = 2; ctx.strokeRect(SX + 3, top + 197, SW - 6, 48); ctx.restore(); }
      ['An icon will be added to your Home Screen so', 'you can quickly access this website.'].forEach((s, i) => T(ctx, s, SX + 16, top + 266 + i * 16, '400 11px "Inter"', 'rgba(255,255,255,0.5)'));
      // the keyboard
      const ky = SY + SH - 236 + (1 - as) * 240;
      ctx.fillStyle = '#2b2b2e'; rr(ctx, SX, ky, SW, 260, [22, 22, 0, 0]); ctx.fill();
      ['“Tracker”', 'Trackers', 'Tracker’s'].forEach((s, i) => T(ctx, s, SX + SW / 6 + i * SW / 3, ky + 26, '400 13px "Inter"', 'rgba(255,255,255,0.8)', 'center'));
      const kw = (SW - 12) / 10, rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      rows.forEach((r, ri) => {
        const off = ri === 1 ? kw / 2 : ri === 2 ? kw * 1.5 : 0;
        [...r].forEach((ch, i) => { const kx = SX + 6 + off + i * kw, kyy = ky + 42 + ri * 44; ctx.fillStyle = '#4a4a4e'; rr(ctx, kx + 2, kyy, kw - 4, 36, 6); ctx.fill(); T(ctx, ch, kx + kw / 2, kyy + 24, '400 16px "Inter"', '#fff', 'center'); });
      });
      ctx.fillStyle = '#3a3a3e'; rr(ctx, SX + 8, ky + 130, kw * 1.3, 36, 6); ctx.fill(); rr(ctx, SX + SW - 8 - kw * 1.3, ky + 130, kw * 1.3, 36, 6); ctx.fill();
      rr(ctx, SX + 8, ky + 174, kw * 2.2, 36, 6); ctx.fill(); ctx.fillStyle = '#4a4a4e'; rr(ctx, SX + 14 + kw * 2.2, ky + 174, kw * 5.2, 36, 6); ctx.fill();
      ctx.fillStyle = BLUE; rr(ctx, SX + SW - 8 - kw * 2.3, ky + 174, kw * 2.3, 36, 6); ctx.fill(); line(ctx, [[SX + SW - 8 - kw * 1.45, ky + 192], [SX + SW - 8 - kw * 1.15, ky + 198], [SX + SW - 8 - kw * 0.75, ky + 184]], '#fff', 2);
    }
  }
  function chipPillSmall(ctx, x, y, s) { ctx.font = '600 13px "Inter"'; const w = ctx.measureText(s).width + 28; ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, x, y - 15, w, 28, 14); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#58e08c'; ctx.beginPath(); ctx.arc(x + 12, y - 1, 3.5, 0, 7); ctx.fill(); T(ctx, s, x + 21, y + 4, '600 13px "Inter"', 'rgba(255,255,255,0.88)'); }
  const ICOLS = ['#4a6fa5', '#c06c84', '#6c5b7b', '#355c7d', '#f67280', '#2a9d8f', '#e9c46a', '#8d99ae', '#457b9d', '#bc6c25', '#606c38', '#9d4edd', '#3a86ff'];
  function homeScreen(ctx, t, ph, EO) {
    // wallpaper: the same lights, deeper
    ctx.fillStyle = '#04110b'; ctx.fillRect(SX, SY, SW, SH);
    const glow = (x, y, r, c, a) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, H.rgba(c, a)); g.addColorStop(1, H.rgba(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(SX + 40, SY + 160, 260, '#1fbf6a', 0.55); glow(SX + SW, SY + 420, 240, '#8b7bff', 0.5); glow(SX + 120, SY + SH, 220, '#40c4c4', 0.4);
    statusBar(ctx);
    const slot = (c, r) => [SX + 22 + 60.5 * c + 5, SY + 66 + 86 * r];
    let n = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      if (r === 3 && c > 0) continue;
      const [x, y] = slot(c, r), col = ICOLS[n++ % ICOLS.length];
      const g = ctx.createLinearGradient(x, y, x, y + 50); g.addColorStop(0, H.rgba(H.mix(col, '#ffffff', 0.25), 0.85)); g.addColorStop(1, H.rgba(H.mix(col, '#000000', 0.25), 0.85));
      ctx.fillStyle = g; rr(ctx, x, y, 50, 50, 12); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, x + 10, y + 59, 30, 5, 2.5); ctx.fill();
    }
    // the dock
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, SX + 12, SY + SH - 100, SW - 24, 80, 30); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
    for (let c = 0; c < 4; c++) { const x = SX + 30 + c * 62, y = SY + SH - 85; const col = ICOLS[(c + 9) % ICOLS.length]; ctx.fillStyle = H.rgba(col, 0.85); rr(ctx, x, y, 50, 50, 12); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(ctx, SX + SW / 2 - 60, SY + SH - 12, 120, 5, 3); ctx.fill();
    // Green Tracker drops into its slot, then pulses (the key moment)
    const k = H.ease.back(ph(16.1, 16.6));
    if (k > 0.001) {
      const pulse = t > 16.6 ? 1 + 0.14 * Math.sin(Math.min(1, (t - 16.6) / 0.4) * Math.PI) : 1, s = ICON.s * k * pulse;
      ctx.save(); ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 26 * Math.min(1, k); appIcon(ctx, ICON.x + (ICON.s - s) / 2, ICON.y + (ICON.s - s) / 2 - (1 - Math.min(1, k)) * 40, s); ctx.restore();
      T(ctx, 'Green Tracker', ICON.x + ICON.s / 2, ICON.y + 66, '600 10px "Inter"', '#fff', 'center');
      if (t > 16.6) { const r = EO(16.6, 17.4); ctx.save(); ctx.globalAlpha = 1 - r; ctx.strokeStyle = '#b6ffd4'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 16; ctx.lineWidth = 2.5; rr(ctx, ICON.x - 40 * r, ICON.y - 40 * r, ICON.s + 80 * r, ICON.s + 80 * r, 12 + 30 * r); ctx.stroke(); ctx.restore(); }
      // little sparkles
      if (t > 16.55 && t < 17.7) { const R = H.rng(41); for (let i = 0; i < 9; i++) { const a = R() * 6.28, dist = 30 + 60 * EO(16.55, 17.5) * (0.6 + R() * 0.6), sx = ICON.x + ICON.s / 2 + Math.cos(a) * dist, sy = ICON.y + ICON.s / 2 + Math.sin(a) * dist, al = 1 - ph(16.9, 17.7); ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = i % 3 ? '#b6ffd4' : '#ffffff'; ctx.translate(sx, sy); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1.4, 0); ctx.lineTo(0, 5); ctx.lineTo(-1.4, 0); ctx.closePath(); ctx.fill(); ctx.restore(); } }
    }
  }
  // the app itself, full screen (local coords 0..SW, 0..SH; drawn into the screen rect)
  function appScreen(ctx, t, ph, EO) {
    ctx.save(); ctx.translate(-SX, -SY);
    auroraWall(ctx, SX, SY, SW, SH, t, 1.1);
    statusBar(ctx);
    T(ctx, 'Leaderboard', SX + 20, SY + 92, '800 30px "Inter"', '#fff');
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, SX + 20, SY + 108, 104, 30, 15); ctx.fill(); T(ctx, 'All · Score', SX + 72, SY + 128, '600 14px "Inter"', '#b6ffd4', 'center');
    PRODUCTS.forEach(([n, sub, s, c], i) => {
      const e = EO(18.8 + i * 0.08, 19.15 + i * 0.08), y = SY + 154 + i * 76 + (1 - e) * 20;
      ctx.save(); ctx.globalAlpha = e;
      ctx.fillStyle = i === 0 ? 'rgba(88,224,140,0.16)' : 'rgba(255,255,255,0.07)'; rr(ctx, SX + 14, y, SW - 28, 66, 16); ctx.fill(); ctx.strokeStyle = i === 0 ? 'rgba(182,255,212,0.5)' : 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke();
      T(ctx, String(i + 1), SX + 34, y + 40, '800 17px "Inter"', 'rgba(255,255,255,0.6)', 'center');
      T(ctx, n, SX + 52, y + 30, '600 15px "Inter"', '#fff'); T(ctx, sub, SX + 52, y + 51, '400 12px "Inter"', 'rgba(255,255,255,0.6)');
      ctx.save(); if (i === 0) { ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 14; } T(ctx, s, SX + SW - 26, y + 42, '800 23px "Inter"', c, 'right'); ctx.restore();
      ctx.restore();
    });
    // the app's own tab bar (no Safari bars)
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, SX + 14, SY + SH - 86, SW - 28, 64, 32); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i === 0 ? '#58e08c' : 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(SX + 50 + i * 62, SY + SH - 54, i === 0 ? 9 : 7, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; rr(ctx, SX + SW / 2 - 60, SY + SH - 12, 120, 5, 3); ctx.fill();
    ctx.restore();
  }

  // ---------- thumbnails for the website (the still shown before the video plays) ----------
  function poster(ctx, W, H_, v) {
    const hg = (x, w) => { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b6ffd4'); return g; };
    if (v === 'title') {
      const { SRC } = explainer(ctx, W, H_, 1.6, { bare: true, cam: [640, 360, 1] });
      glass(ctx, SRC, 150, 170, 980, 330, 44, { tint: 0.11, shadow: 60 });
      appIcon(ctx, 210, 250, 170);
      T(ctx, 'Add Green Tracker', 430, 320, '800 64px "Inter"', hg(430, 600));
      T(ctx, 'to your iPhone', 430, 398, '800 64px "Inter"', '#ffffff');
      T(ctx, 'Home Screen, in 20 seconds', 432, 450, '400 30px "Inter"', 'rgba(255,255,255,0.8)');
      chipPill(ctx, 900, 120, 'Video guide · Safari', { dot: '#58e08c', bg: 'rgba(255,255,255,0.14)' });
    } else if (v === 'phone') {
      const { SRC, S } = explainer(ctx, W, H_, 17.85, { bare: true, cam: [330, 360, 1.0] });
      glass(ctx, SRC, 56, 180, 560, 330, 40, { tint: 0.1, shadow: 50 });
      T(ctx, 'Put it on your', 96, 272, '800 56px "Inter"', '#ffffff');
      T(ctx, 'Home Screen', 96, 340, '800 56px "Inter"', hg(96, 420));
      T(ctx, 'Add Green Tracker in Safari.', 98, 398, '400 28px "Inter"', 'rgba(255,255,255,0.82)');
      T(ctx, 'Takes 20 seconds.', 98, 436, '400 28px "Inter"', 'rgba(255,255,255,0.82)');
      chipPill(ctx, 230, 130, 'Video guide', { dot: '#58e08c', bg: 'rgba(255,255,255,0.14)' });
      const p = S(ICON.x + ICON.s / 2, ICON.y + ICON.s + 4);
      ctx.save(); const r = 58; ctx.strokeStyle = 'rgba(182,255,212,0.8)'; ctx.shadowColor = '#58e08c'; ctx.shadowBlur = 22; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p[0], p[1] - 28, r, 0, 7); ctx.stroke(); ctx.restore();
      chipPill(ctx, p[0], p[1] + 72, 'Green Tracker', { grad: ['#58e08c', '#40c4c4'], col: '#03140a', font: '800 30px "Inter"', h: 54 });
    } else {
      const { SRC } = explainer(ctx, W, H_, 1.6, { bare: true, cam: [640, 360, 1] });
      glass(ctx, SRC, 250, 110, 780, 500, 40, { tint: 0.1, shadow: 60 });
      appIcon(ctx, 296, 150, 84);
      T(ctx, 'Green Tracker', 400, 200, '800 46px "Inter"', hg(400, 340));
      T(ctx, 'on your iPhone', 402, 234, '400 28px "Inter"', 'rgba(255,255,255,0.8)');
      [['1', 'Open it in Safari'], ['2', 'Share → Add to Home Screen'], ['3', 'Tap Add']].forEach(([n, s], i) => {
        const y = 320 + i * 90, g = ctx.createLinearGradient(296, y - 32, 360, y + 32); g.addColorStop(0, '#7af0b0'); g.addColorStop(1, '#40c4c4');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(330, y, 32, 0, 7); ctx.fill(); T(ctx, n, 330, y + 3, '800 38px "Inter"', '#03140a', 'center', 'middle');
        T(ctx, s, 386, y + 12, '600 36px "Inter"', '#ffffff');
      });
    }
  }

  return { explainer, poster, glass, blurOf, chipPill, glowLine, appIcon };
})();
const explainer = GTX.explainer;
