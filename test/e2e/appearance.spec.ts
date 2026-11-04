import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { emptyProductInput } from '../../shared/domain/product';
import { contrastFailures, settled, shot, signUp, textBoxes, wholeScreenContrastFailures } from './helpers';

// D48 (0.41.0): Leaderboard colours by score. Each band, in each preset, on real rows; the
// Colours key beside Rank by; More → Appearance to choose the preset and the #1 mark, saved to
// your account. One account; its board (All · Overall): Peak 9.7 · High 9.2 · Good 8.7 ·
// Fine 8.2 · Okay 7.0.
test.describe.configure({ mode: 'serial' });

let page: Page;

const post = (path: string, body: unknown): Promise<any> =>
  page.evaluate(async ({ path, body }) => (await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json(), { path, body });
const appearance = (a: { preset: string; markFirst: boolean }) =>
  page.evaluate(async (a) => (await fetch('/api/appearance', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a) })).status, a);
const rows = () => page.locator('.rows .row');
const looks = () => rows().evaluateAll((els) => els.map((e) => [...e.classList].filter((c) => /^(band\d|pal-.+|first)$/.test(c)).join(' ')));
const axe = async () => {
  await settled(page);
  return (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`);
};

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
  await signUp(page, `look${Date.now().toString(36).slice(-6)}`);
  for (const [name, look, strain] of [['Peak', 9.7, 'hybrid'], ['High', 9.2, 'indica'], ['Good', 8.7, 'sativa'], ['Fine', 8.2, 'hybrid'], ['Okay', 7, 'indica']] as const) {
    await post('/api/products', { ...emptyProductInput(), name, strainType: strain, country: 'US', source: 'Shop', ratings: { look } });
  }
});
test.afterAll(() => page.context().close());

const PRESETS = [
  ['aurora', ['Aurora', 'Violet', 'Lagoon', 'Jade'], ['rgb(111, 232, 232)', 'rgb(139, 123, 255)', 'rgb(64, 196, 196)', 'rgb(63, 220, 142)']], // D64: made for the new look
  ['candy', ['Sugar rush', 'Lemon', 'Mint', 'Bubblegum'], ['rgb(255, 240, 160)', 'rgb(255, 224, 112)', 'rgb(138, 232, 192)', 'rgb(255, 176, 208)']], // D91
  ['cosmos', ['Supernova', 'Nebula', 'Stardust', 'Moonlight'], ['rgb(180, 140, 255)', 'rgb(176, 124, 255)', 'rgb(159, 176, 255)', 'rgb(188, 200, 240)']],
  ['deepsea', ['Glow', 'Abyss', 'Reef', 'Seafoam'], ['rgb(111, 214, 255)', 'rgb(106, 130, 244)', 'rgb(63, 184, 240)', 'rgb(126, 224, 196)']],
  ['ember', ['Inferno', 'Gold', 'Flame', 'Ember'], ['rgb(255, 154, 60)', 'rgb(242, 184, 75)', 'rgb(255, 154, 60)', 'rgb(232, 134, 78)']], // D91: Gold for the blue
  ['medals', ['24 carat', 'Gold', 'Silver', 'Bronze'], ['rgb(255, 211, 107)', 'rgb(242, 184, 75)', 'rgb(192, 204, 216)', 'rgb(208, 138, 90)']], // D91
  ['neon', ['Neon', 'Hot pink', 'Electric', 'Lime'], ['rgb(255, 211, 107)', 'rgb(255, 92, 200)', 'rgb(61, 168, 255)', 'rgb(184, 245, 60)']],
  ['prism', ['Prism', 'Prism', 'Prism', 'Prism'], ['rgb(255, 201, 150)', 'rgb(255, 201, 150)', 'rgb(255, 201, 150)', 'rgb(255, 201, 150)']],
  ['storm', ['Lightning', 'Thunder', 'Rain', 'Drizzle'], ['rgb(159, 200, 255)', 'rgb(143, 123, 240)', 'rgb(111, 168, 240)', 'rgb(160, 180, 216)']], // D91
  ['sunset', ['Golden hour', 'Magenta', 'Coral', 'Peach'], ['rgb(255, 154, 107)', 'rgb(240, 95, 180)', 'rgb(255, 122, 107)', 'rgb(255, 180, 138)']],
  ['synthwave', ['Synthwave', 'Chrome', 'Laser', 'Arcade'], ['rgb(255, 179, 107)', 'rgb(184, 192, 232)', 'rgb(224, 64, 192)', 'rgb(47, 216, 240)']],
  ['toxic', ['Toxic', 'Radioactive', 'Acid', 'Sour'], ['rgb(240, 255, 90)', 'rgb(212, 245, 60)', 'rgb(79, 232, 90)', 'rgb(182, 245, 90)']], // D91
] as const;

/** Each row's effect (D69; every set since D91, growing band by band), top row first: its kind and how many things it draws. */
const EFFECTS: Record<string, string[]> = {
  aurora: ['ribbons 9', 'ribbons 3', 'ribbons 2', 'ribbons 1'],
  candy: ['sprinkles 10', 'sprinkles 6', 'sprinkles 4', 'sprinkles 2'],
  cosmos: ['stars 14', 'stars 8', 'stars 5', 'stars 2'],
  deepsea: ['plankton 12', 'plankton 6', 'plankton 4', 'plankton 2'],
  ember: ['sparks 11', 'sparks 7', 'sparks 4', 'sparks 2'],
  medals: ['glitter 10', 'glitter 5', 'glitter 3', 'glitter 2'],
  neon: ['tubes 4', 'tubes 3', 'tubes 2', 'tubes 1'],
  prism: ['beams 7', 'beams 3', 'beams 2', 'beams 1'],
  storm: ['rain 14', 'rain 8', 'rain 5', 'rain 3'],
  sunset: ['sun 8', 'sun 5', 'sun 3', 'sun 2'],
  synthwave: ['grid 8', 'grid 5', 'grid 2', 'grid 1'],
  toxic: ['goo 12', 'goo 6', 'goo 4', 'goo 2'],
};
const effects = () => rows().evaluateAll((els) => els.slice(0, 4).map((e) => { const f = e.querySelector('.tfx'); return f ? `${f.classList[1]!.replace('tfx-', '')} ${f.children.length}` : ''; }));

test('each band on its row, in every preset: the right colours, each a little stronger than the one below', async () => {
  for (const [preset, , t2] of PRESETS) {
    expect(await appearance({ preset, markFirst: true })).toBe(200);
    await page.goto('/');
    await expect(rows()).toHaveCount(5);
    expect(await looks(), preset).toEqual([`band4 pal-${preset} first`, `band3 pal-${preset}`, `band2 pal-${preset}`, `band1 pal-${preset}`, '']);
    await expect(rows().nth(4)).toHaveAttribute('data-heat'); // 7.0: the green glow, as before (D30)
    const info = await rows().evaluateAll((els) =>
      els.slice(0, 4).map((el) => {
        const cs = getComputedStyle(el);
        const anims = el.getAnimations().map((a) => (a as CSSAnimation).animationName);
        const score = el.querySelector<HTMLElement>('.score b')!;
        return {
          t2: cs.getPropertyValue('--t2').trim(),
          holo: cs.backgroundImage.startsWith('linear-gradient(115deg, rgba('),
          // The dark layer over the colours: its tint and its two strengths (it thins as the score rises).
          layer: [...cs.backgroundImage.matchAll(/rgba\((\d+), (\d+), (\d+), ([\d.]+)\)/g)].slice(0, 2).map((m) => [m[1], m[2], m[3], m[4]].map(Number)),
          flows: anims.filter((n) => n.startsWith('tier-flow')),
          sheen: el.getAnimations({ subtree: true }).some((a) => (a as CSSAnimation).animationName === 'tier-sheen'),
          scoreFlows: score.getAnimations().length > 0,
          scoreColoured: getComputedStyle(score).backgroundClip === 'text',
        };
      }),
    );
    const hex = (rgb: string) => '#' + rgb.match(/\d+/g)!.map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    expect(info.map((i) => i.t2), preset).toEqual(t2.map(hex));
    // All four are cards of one kind (D49): 4 the full card with the shine, 3 and 2 fainter and flowing, 1 the faintest and still.
    expect(info.map((i) => [i.holo, i.flows.join(), i.sheen, i.scoreFlows, i.scoreColoured]), preset).toEqual([
      [true, 'tier-flow-holo', true, true, true],
      [true, 'tier-flow-holo', false, true, true],
      [true, 'tier-flow-holo', false, true, true],
      [true, '', false, false, true],
    ]);
    expect(info.map((i) => i.layer.map((l) => l[3])), preset).toEqual([[0.7, 0.86], [0.8, 0.9], [0.86, 0.93], [0.9, 0.95]]);
    // Every set draws its own effect, growing band by band (D91).
    expect(await effects(), preset).toEqual(EFFECTS[preset]);
    await shot(page, `150-colours-${preset}`);
  }
  expect(await appearance({ preset: 'aurora', markFirst: true })).toBe(200);
});

test('D69, D91: every set\'s effects stay clear of every word on a row, and Reduce Motion holds them still', async () => {
  for (const preset of Object.keys(EFFECTS)) {
    expect(await appearance({ preset, markFirst: true })).toBe(200);
    await page.goto('/');
    await expect(rows()).toHaveCount(5);
    // The small pieces keep to the strips along the edges and round the photo; the glows (sun, nebula, heat,
    // beams, rain, curtain, swirl…) are faint and judged by the readability test below.
    const overlaps = await rows().evaluateAll((els) =>
      els.slice(0, 4).flatMap((row) => {
        const texts = [...row.querySelectorAll<HTMLElement>('.rk, .name, .cluster, .meta, .score b, .score .cap')].map((t) => t.getBoundingClientRect());
        return [...row.querySelectorAll<HTMLElement>('.tfx i:not(.glow)')].flatMap((d) => {
          const r = d.getBoundingClientRect();
          return texts.filter((t) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top).map(() => `${row.querySelector('.name')!.textContent}: ${d.className || 'dot'}`);
        });
      }),
    );
    expect(overlaps, preset).toEqual([]);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const preset of Object.keys(EFFECTS)) {
    expect(await appearance({ preset, markFirst: true })).toBe(200);
    await page.goto('/');
    await expect(rows()).toHaveCount(5);
    expect(await effects(), preset).toEqual(EFFECTS[preset]);
    expect(await page.locator('.tfx').evaluateAll((els) => els.flatMap((e) => e.getAnimations({ subtree: true })).length), preset).toBe(0);
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await appearance({ preset: 'aurora', markFirst: true })).toBe(200);
});

test('#1 wears the crown above its number and a halo in its colour, gently breathing; Reduce Motion stills it', async () => {
  await page.goto('/');
  await expect(rows().first()).toHaveClass(/\bfirst\b/);
  const first = await rows().first().evaluate((el) => {
    const crown = el.querySelector('.rk .rank-crown')!.getBoundingClientRect();
    const number = el.querySelector('.rk')!;
    const range = document.createRange();
    range.selectNodeContents(number.lastChild!);
    const n = range.getBoundingClientRect();
    const row = el.getBoundingClientRect();
    return {
      above: crown.bottom <= n.top + 1 && Math.abs(crown.left + crown.width / 2 - (n.left + n.width / 2)) < 3,
      inside: crown.top >= row.top,
      halo: getComputedStyle(el).getPropertyValue('--halo').trim(),
      breathes: el.getAnimations().some((a) => (a as CSSAnimation).animationName === 'first-halo'),
      // …and its colour keeps flowing (the two motions share the row's animation list).
      flows: el.getAnimations().some((a) => (a as CSSAnimation).animationName === 'tier-flow-holo'),
      shadow: getComputedStyle(el).boxShadow.includes('px'),
    };
  });
  expect(first).toEqual({ above: true, inside: true, halo: '#6fe8e8', breathes: true, flows: true, shadow: true });
  await expect(page.locator('.rank-crown')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(rows().first()).toHaveClass(/\bfirst\b/);
  expect(await rows().first().evaluate((el) => ({ moving: el.getAnimations({ subtree: true }).length, shadow: getComputedStyle(el).boxShadow.includes('px') }))).toEqual({ moving: 0, shadow: true });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

// One test per preset: all ten in one (D69; twelve since D91) came near the time limit with workers sharing the machine.
for (const [preset] of PRESETS) {
  test(`the text on every band stays readable throughout the motion: ${preset}`, async () => {
    expect(await appearance({ preset, markFirst: true })).toBe(200);
    await page.goto('/');
    await expect(rows()).toHaveCount(5);
    await settled(page);
    const boxes = await textBoxes(page, '.row.tier .rk, .row.tier .name, .row.tier .meta, .row.tier .score b, .row.tier .score .cap');
    expect(boxes.length).toBe(20);
    const worst = await contrastFailures(page, boxes);
    expect(worst, `${preset}:\n${worst.join('\n')}`).toEqual([]);
    expect(await appearance({ preset: 'aurora', markFirst: true })).toBe(200);
  });
}

test('the Colours key: each colour and its scores, the glow below 8 and the #1 mark; axe finds nothing', async () => {
  await page.goto('/');
  await page.getByRole('button', { name: 'What the colours mean' }).click();
  const key = page.getByRole('dialog', { name: 'Leaderboard colours' });
  await expect(key).toBeVisible();
  await expect(key).toContainText('Yours are Aurora.');
  await expect(key.locator('.key-list li b')).toHaveText(['Aurora', 'Violet', 'Lagoon', 'Jade', 'Green glow', 'Crown and halo']);
  await expect(key.locator('.key-list li .range')).toHaveText(['9.5 – 10', '9.0 – 9.4', '8.5 – 8.9', '8.0 – 8.4', 'below 8.0', 'your #1']);
  await shot(page, '151-colours-key');
  expect(await axe()).toEqual([]);
  await key.getByRole('button', { name: 'Done' }).click();
  await expect(key).toHaveCount(0);
  // Tapping outside closes it too; its link goes to the colours page (D71).
  await page.getByRole('button', { name: 'What the colours mean' }).click();
  await page.locator('.scrim').click({ position: { x: 20, y: 120 } });
  await expect(key).toHaveCount(0);
  await page.getByRole('button', { name: 'What the colours mean' }).click();
  await key.getByRole('link', { name: 'Change colours' }).click();
  await expect(page).toHaveURL(/\/more\/colours$/);
  await expect(page.locator('.hdr .title')).toHaveText('Leaderboard colours');
});

test('More → Appearance: choose a preset and the #1 mark; each saves at once, to your account', async () => {
  await page.goto('/more');
  const row = page.getByRole('link', { name: /Leaderboard colours/ });
  await expect(page.locator('.lh', { hasText: 'Appearance' })).toBeVisible();
  await expect(row).toContainText('Aurora');
  await row.click();
  await expect(page).toHaveURL(/\/more\/colours$/);
  await expect(page.getByRole('radio', { name: /^Aurora/ })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Mark my #1' })).toBeChecked();
  // Each preset shows its four colours; Aurora first, then A to Z; D91's four marked New (Gems and Metals went).
  await expect(page.locator('.preset')).toHaveCount(12);
  await expect(page.locator('.preset .main > span:first-child')).toHaveText(['Aurora', 'CandyNew', 'Cosmos', 'Deep Sea', 'Ember', 'MedalsNew', 'Neon', 'Prism', 'StormNew', 'Sunset', 'Synthwave', 'ToxicNew']);
  // This page is only the colours and the #1 mark (D71): the looks and tops have pages of their own.
  await expect(page.locator('input[name="look"], input[name="top"]')).toHaveCount(0);
  await expect(page.locator('.preset').first().locator('.swatch')).toHaveCount(4);
  await expect(page.locator('.preset').first().locator('.strip-l')).toHaveText(['8.0+', '8.5+', '9.0+', '9.5+']);
  await shot(page, '152-appearance');
  expect(await axe()).toEqual([]);

  await page.getByRole('radio', { name: /Medals/ }).check();
  await expect.poll(() => page.evaluate(async () => ((await (await fetch('/api/appearance')).json()) as { appearance: unknown }).appearance)).toEqual({ look: 'aurora', top: 'strip', preset: 'medals', markFirst: true });
  await expect(page.locator('.ap-rows .row').first()).toHaveClass(/\bpal-medals\b/);
  await page.getByRole('switch', { name: 'Mark my #1' }).uncheck();
  await expect.poll(() => page.evaluate(async () => ((await (await fetch('/api/appearance')).json()) as { appearance: unknown }).appearance)).toEqual({ look: 'aurora', top: 'strip', preset: 'medals', markFirst: false });
  await expect(page.locator('.ap-rows .rank-crown')).toHaveCount(0);

  // The Leaderboard follows straight away, and after a reload (it's your account's, not this phone's).
  await page.getByRole('link', { name: 'Leaderboard', exact: true }).click();
  await expect(rows()).toHaveCount(5);
  expect(await looks()).toEqual(['band4 pal-medals', 'band3 pal-medals', 'band2 pal-medals', 'band1 pal-medals', '']);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(rows()).toHaveCount(5);
  expect(await looks()).toEqual(['band4 pal-medals', 'band3 pal-medals', 'band2 pal-medals', 'band1 pal-medals', '']);
  // The key follows too: Medals' names, no #1 line.
  await page.getByRole('button', { name: 'What the colours mean' }).click();
  await expect(page.locator('.key-list li b')).toHaveText(['24 carat', 'Gold', 'Silver', 'Bronze', 'Green glow']);
  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto('/more');
  await expect(page.getByRole('link', { name: /Leaderboard colours/ })).toContainText('Medals');

  expect(await appearance({ preset: 'aurora', markFirst: true })).toBe(200);
});

test('the Look, Leaderboard top and Leaderboard colours pages are readable from top to bottom', async () => {
  for (const [path, sel] of [
    ['/more/look', '.lh, .ap-name, .ap-sub, .new-tag, .priv-foot'],
    ['/more/top', '.lh, .ap-preview .tile b, .ap-preview .tile .cap, .ap-name, .ap-sub, .priv-foot'],
    ['/more/colours', '.lh, .ap-preview .tile b, .ap-preview .tile .cap, .preset .pl, .preset .sub, .preset .strip-l, .new-tag, .priv-row .main > span, .priv-foot'],
  ] as const) {
    const worst = await wholeScreenContrastFailures(page, path, sel);
    expect(worst, `${path}:\n${worst.join('\n')}`).toEqual([]);
  }
});

test('the footnotes say followers see your board in your look, top and colours (D74)', async () => {
  for (const path of ['/more/look', '/more/top', '/more/colours']) {
    await page.goto(path);
    await expect(page.locator('.priv-foot').last(), path).toContainText('Saved to your account, so it follows you to a new phone. Your followers see your board in it too.');
    await expect(page.locator('main'), path).not.toContainText('Friends’ boards');
  }
  await page.goto('/more/top');
  await expect(page.locator('.priv-foot').first()).toHaveText('The Log and brand pages use it too.');
});

test('the Colours button fits beside Rank by and Type at 375px', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await page.getByLabel('Rank by', { exact: true }).selectOption('look');
  const m = await page.locator('.controls').evaluate((el) => ({ overflow: el.scrollWidth > el.clientWidth + 1, key: el.querySelector('.pill.key')!.getBoundingClientRect().width }));
  expect(m).toEqual({ overflow: false, key: 38 });
  await page.getByLabel('Rank by', { exact: true }).selectOption('overall');
  await page.setViewportSize({ width: 390, height: 844 });
});
