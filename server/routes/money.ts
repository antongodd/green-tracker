import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { isCurrencyCode } from '../../shared/domain/currency';
import { isIsoDate } from '../../shared/domain/product';
import { fail, jsonBody } from '../lib/http';
import { fxDay, FxUnavailable, ratesFor, type RateNeed } from '../lib/fx';
import { loadMainCurrency, saveMainCurrencyStatement } from '../lib/money';
import { hit, LIMITS } from '../lib/rateLimit';
import { requireUser } from '../lib/session';

// Money (D66): exchange rates for the purchase form, and your main currency.

export const money = new Hono<AppEnv>();
money.use('*', requireUser());

export const RATE_UNAVAILABLE = 'Couldn’t get the exchange rate just now. Type it in instead.';

/** The rate for a purchase: 1 `from` in `to` on `date` (none → today). */
money.get('/rate', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  const date = c.req.query('date') || null;
  if (!isCurrencyCode(from) || !isCurrencyCode(to)) fail(400, 'bad_currency', 'Choose a currency from the list.');
  if (date !== null && !isIsoDate(date)) fail(400, 'bad_date', 'That isn’t a valid date.');
  await hit(c, LIMITS.fx, c.var.user!.id);
  try {
    const [rate] = await ratesFor(c.env, [{ from, to, day: date }]);
    return c.json({ rate, day: fxDay(date) });
  } catch (e) {
    if (e instanceof FxUnavailable) fail(503, 'rate_unavailable', RATE_UNAVAILABLE);
    throw e;
  }
});

/**
 * Changes your main currency. Every purchase is worked out again in it: its own currency's rate
 * on its day (a purchase in the new main currency is 1), replacing any rate you typed. All at
 * once, or nothing changes.
 */
money.put('/', async (c) => {
  const userId = c.var.user!.id;
  const db = c.env.DB;
  const currency = (await jsonBody(c)).currency;
  if (!isCurrencyCode(currency)) fail(400, 'bad_currency', 'Choose a currency from the list.');
  if ((await loadMainCurrency(db, userId)) === currency) return c.json({ currency });
  const { results } = await db.prepare('SELECT id, currency, date FROM purchases WHERE user_id = ?1').bind(userId).all<{ id: string; currency: string; date: string | null }>();
  const needs: RateNeed[] = results.map((p) => ({ from: p.currency, to: currency, day: p.date }));
  let rates: number[];
  try {
    rates = await ratesFor(c.env, needs);
  } catch (e) {
    if (e instanceof FxUnavailable) fail(503, 'rate_unavailable', 'Couldn’t get the exchange rates just now, so nothing has changed. Please try again later.');
    throw e;
  }
  const rows = results.map((p, i) => ({ id: p.id, r: rates[i] }));
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += 5000) {
    statements.push(
      db
        .prepare(
          `UPDATE purchases SET rate = (SELECT json_extract(value, '$.r') FROM json_each(?2) WHERE json_extract(value, '$.id') = purchases.id)
           WHERE user_id = ?1 AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?2))`,
        )
        .bind(userId, JSON.stringify(rows.slice(i, i + 5000))),
    );
  }
  statements.push(saveMainCurrencyStatement(db, userId, currency));
  await db.batch(statements);
  return c.json({ currency });
});
