---
name: new-look
description: Adding a new Green Tracker Look (the whole app's background and colours) or Leaderboard colour set, or changing an existing one. Lists every place that must agree and the tests that guard them. Use together with big-change (a new Look or set is a big change).
---

# A new Look or Leaderboard colour set

A new Look or colour set is a **big change** (mockups first; use **big-change** for the stops). This recipe is the
building part. Since D76 neither needs a migration.

## The rules that never bend

- **A Look changes only colours and the background** (D70, Anton's rule): never a font, size, shape or position.
  `looks.spec.ts` compares every position and font with Aurora Glass.
- **Readability:** whatever drifts behind words must pass the readability tests at every moment; keep it about as
  bright as Aurora's lights. Never loosen a readability or accessibility test: change the colours.
- The background moves only in `steps()`; name every keyframe `bg-…`; still with Reduce Motion; hidden under the
  viewer and the editors (copy how an existing look does it).
- Everyone starts on Aurora Glass, the Slim strip and Gems (D71); a light look is only ever chosen (D72).

## A new Look: every place

| Where | What |
|---|---|
| `shared/domain/gems.ts` | `Look` type; `LOOK_KEYS` (dark looks: Aurora first, then A to Z by label; light looks last, A to Z); `NEW_LOOKS`; `LOOK_BG`; `LOOKS` (label, description); `LIGHT_LOOKS` if it's light |
| `client/public/look.js` | the same name and background in `bgs` (and `light` if it's light) |
| `client/src/styles.css` | the tokens under `html[data-look="<key>"]` (copy the nearest existing look's block and change only colours); the background: `.bg-layer::before` / `::after`, its `bg-…` keyframes (inside `@media (prefers-reduced-motion: no-preference)`), the viewer rules; a light look also needs everything under `html[data-tone="light"]` to work for it |
| `test/domain/gems.test.ts` | the count and order of looks; New marks; `look.js` agrees (it fails until you update it) |
| `test/api/appearance.test.ts` | the new key can be saved and read back |
| `test/e2e/looks.spec.ts` | an entry `{ look, name, bg, hex }`: positions, fonts, readability over every screen |
| `test/e2e/daylight.spec.ts` | a light look joins its sweep |
| `test/e2e/timings.json` | refresh after (the looks' sweeps are slow: `scripts/e2e-timings.mjs`) |

## A new colour set: every place

| Where | What |
|---|---|
| `shared/domain/gems.ts` | `Preset` type; `PRESET_KEYS` (Gems first, then A to Z by label); `NEW_PRESETS`; `PRESETS` (label, description, four band names); `EFFECTS` if it has its own effect (and the `Effect` type for a new one) |
| `client/src/styles.css` | `.pal-<key>.band1` … `band4` (`--t1`…`--t6`, `--dark`), and their light versions under `html[data-tone="light"]` |
| `client/src/components/Gems.tsx` | a new effect is drawn by `Effects` (`span.tfx`, never `.fx`), always clear of the words |
| `test/domain/gems.test.ts` | order, New marks, band names, the effect's bands |
| `test/api/appearance.test.ts` | the new key can be saved |
| `test/e2e/appearance.spec.ts` | its band names and colours; its effect, band by band (no dot overlaps a row's words) |
| `test/e2e/gems.spec.ts` | an effect on a product page, if it has one |
| `test/e2e/daylight.spec.ts` | `PRESETS` list: its light cards |

## Then

1. `grep -rn "<a neighbouring key>" client server shared test` to catch any list you missed (a count in a test name,
   "fifteen looks").
2. Check the Look page or the colours page shows it in the right place, marked New, and that a friend sees their
   board in it (D74; `theirlook.spec.ts`).
3. Run the specs above plus the core set; the full looks sweep is long, so run it in the background.
4. Notes as in **big-change**: SPEC decision and changelog, §4 *The new look* (or the colour sets'), CLAUDE.md's
   Testing notes if the count of looks or sets is named there.
