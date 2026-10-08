import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayLabel,
  groupByDay,
  recentTargets,
  smokeAmountText,
  smokesOf,
  smokeTotals,
  smokeVerb,
  timesCaption,
  timesText,
  validateSmokeInput,
  weekdayShort,
  weekStrip,
  whenText,
  type Smoke,
} from '../../shared/domain/smoke';

const base = { productId: 'p1', logEntryId: null, date: '2026-10-08', time: '21:40', amount: 0.3, effect: 'Relaxed' };
let n = 0;
const smoke = (over: Partial<Smoke>): Smoke => ({ id: `s${++n}`, ...base, createdAt: n, updatedAt: n, ...over });

describe('checking a smoke (D43)', () => {
  it('accepts a whole smoke and tidies the effect', () => {
    expect(validateSmokeInput({ ...base, effect: '  Lifted  ' })).toEqual({ ok: true, value: { ...base, effect: 'Lifted' } });
    expect(validateSmokeInput({ ...base, amount: null, effect: '   ' })).toMatchObject({ ok: true, value: { amount: null, effect: null } });
  });

  it('is exactly one product or one Log entry', () => {
    expect(validateSmokeInput({ ...base, productId: null })).toEqual({ ok: false, message: 'Choose what you had.' });
    expect(validateSmokeInput({ ...base, logEntryId: 'e1' })).toEqual({ ok: false, message: 'Choose what you had.' });
    expect(validateSmokeInput({ ...base, productId: null, logEntryId: 'e1' }).ok).toBe(true);
  });

  it('needs a real date and a 24-hour time; never after the last day allowed', () => {
    expect(validateSmokeInput({ ...base, date: '2026-02-30' })).toEqual({ ok: false, message: 'Choose a date.' });
    expect(validateSmokeInput({ ...base, date: '' })).toEqual({ ok: false, message: 'Choose a date.' });
    expect(validateSmokeInput({ ...base, time: '24:00' })).toEqual({ ok: false, message: 'Choose a time.' });
    expect(validateSmokeInput({ ...base, time: '9:05' })).toEqual({ ok: false, message: 'Choose a time.' });
    expect(validateSmokeInput({ ...base, time: '00:00' }).ok).toBe(true);
    expect(validateSmokeInput({ ...base, date: '2026-10-09' }, '2026-10-08')).toEqual({ ok: false, message: 'The date can’t be in the future.' });
    expect(validateSmokeInput({ ...base, date: '2026-10-08' }, '2026-10-08').ok).toBe(true);
  });

  it('How much is more than 0 or empty; the effect stays under 500 characters', () => {
    expect(validateSmokeInput({ ...base, amount: 0 })).toEqual({ ok: false, message: 'How much must be more than 0.' });
    expect(validateSmokeInput({ ...base, amount: '0.3' })).toEqual({ ok: false, message: 'How much must be more than 0.' });
    expect(validateSmokeInput({ ...base, effect: 'x'.repeat(501) })).toEqual({ ok: false, message: 'Keep the effect to 500 characters.' });
    expect(validateSmokeInput({ ...base, effect: 'x'.repeat(500) }).ok).toBe(true);
  });
});

describe('wording', () => {
  it('edibles are taken; everything else is smoked', () => {
    expect(smokeVerb('edibles')).toBe('taken');
    for (const t of ['flower', 'concentrate', 'pre_roll', 'other', 'not_set']) expect(smokeVerb(t)).toBe('smoked');
    expect([0, 1, 2, 14].map((n) => timesText('flower', n))).toEqual(['Not smoked yet', 'Smoked once', 'Smoked twice', 'Smoked 14 times']);
    expect(timesText('edibles', 3)).toBe('Taken 3 times');
    expect([timesCaption('flower', 1), timesCaption('edibles', 6), timesCaption('flower', 0)]).toEqual(['time smoked', 'times taken', 'times smoked']);
  });

  it('amounts in the type’s unit, trimmed', () => {
    expect(smokeAmountText('flower', 0.3)).toBe('0.3 g');
    expect(smokeAmountText('flower', 1)).toBe('1 g');
    expect(smokeAmountText('edibles', 10)).toBe('10 mg');
    expect(smokeAmountText('flower', 0.125)).toBe('0.13 g');
  });

  it('day headings: Today, Yesterday, then the weekday and date, with the year only when it differs', () => {
    expect(dayLabel('2026-10-08', '2026-10-08')).toBe('Today');
    expect(dayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
    expect(dayLabel('2026-10-06', '2026-10-08')).toBe('Tue 6 Oct');
    expect(dayLabel('2025-12-31', '2026-01-02')).toBe('Wed 31 Dec 2025');
    expect(dayLabel('2026-03-01', '2026-03-02')).toBe('Yesterday'); // across a month end
    expect(weekdayShort('2026-10-08')).toBe('Thu');
    expect(whenText({ date: '2026-10-08', time: '21:40' }, '2026-10-08')).toBe('Today, 21:40');
  });
});

describe('days and counts', () => {
  const list = [
    smoke({ date: '2026-10-08', time: '13:10' }),
    smoke({ date: '2026-10-07', time: '22:40', productId: 'p2' }),
    smoke({ date: '2026-10-07', time: '19:05' }),
    smoke({ date: '2026-10-07', time: '19:05', productId: null, logEntryId: 'e1' }), // same minute: added later comes first
    smoke({ date: '2026-10-01', time: '09:00' }),
    smoke({ date: '2026-09-30', time: '23:59' }),
  ];

  it('groups by day, newest day first, each day newest first (same minute: the later one added first)', () => {
    const g = groupByDay(list);
    expect(g.map((d) => [d.date, d.smokes.map((s) => s.time)])).toEqual([
      ['2026-10-08', ['13:10']],
      ['2026-10-07', ['22:40', '19:05', '19:05']],
      ['2026-10-01', ['09:00']],
      ['2026-09-30', ['23:59']],
    ]);
    expect(g[1]!.smokes[1]!.logEntryId).toBe('e1');
  });

  it('the strip is the 7 days ending today; the totals are those days and this month', () => {
    const strip = weekStrip(list, '2026-10-08');
    expect(strip.map((d) => d.date)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(strip.map((d) => d.count)).toEqual([0, 0, 0, 0, 0, 3, 1]);
    expect(smokeTotals(list, '2026-10-08')).toEqual({ week: 4, month: 5 });
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
  });

  it('Recent: what you had, most recent first, each once; a product’s own smokes', () => {
    expect(recentTargets(list)).toEqual(['p:p1', 'p:p2', 'e:e1']);
    expect(smokesOf(list, 'p:p1').map((s) => s.date)).toEqual(['2026-10-08', '2026-10-07', '2026-10-01', '2026-09-30']);
    expect(smokesOf(list, 'e:e1')).toHaveLength(1);
  });
});
