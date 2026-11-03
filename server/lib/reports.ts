import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { isReportReason, type ReportKind, type ReportReason } from '../../shared/domain/trust';
import { randomId } from './crypto';
import { fail, jsonBody } from './http';
import { hit } from './rateLimit';

// Reports (D84). The routes that take them (server/routes/posts.ts, people.ts) first check the reporter can see
// what's reported (D77's rule), with the same 404 as anything else they can't see. A report hides that post or
// comment for the reporter (Show it undoes the hiding, never the report). Nobody else is told, ever.

const HOUR = 60 * 60_000;
export const REPORT_LIMIT = { name: 'report', max: 60, windowMs: HOUR };

/** The reason from the request body, or a 400. */
export async function reasonOf(c: Context<AppEnv>): Promise<{ reason: ReportReason; block: boolean }> {
  const body = await jsonBody(c);
  if (!isReportReason(body.reason)) fail(400, 'bad_request', 'Pick a reason for the report.');
  return { reason: body.reason, block: body.block === true };
}

/** Saves (or updates) the viewer's report and hides the thing for them. */
export async function saveReport(
  c: Context<AppEnv>,
  r: { kind: ReportKind; ownerId: string; postId?: string | null; commentId?: string | null; reason: ReportReason },
): Promise<void> {
  const me = c.var.user!.id;
  await hit(c, REPORT_LIMIT, me);
  await c.env.DB.prepare(
    `INSERT INTO reports (id, reporter_id, kind, owner_id, post_id, comment_id, reason, hidden, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8)
     ON CONFLICT (reporter_id, kind, COALESCE(comment_id, post_id, owner_id)) DO UPDATE SET reason = excluded.reason, hidden = 1, created_at = excluded.created_at`,
  )
    .bind(randomId(), me, r.kind, r.ownerId, r.postId ?? null, r.commentId ?? null, r.reason, Date.now())
    .run();
}

/** Show it: the reported post or comment is shown to the reporter again. The report stays. */
export async function showReported(c: Context<AppEnv>, kind: 'post' | 'comment', id: string): Promise<void> {
  await c.env.DB.prepare(`UPDATE reports SET hidden = 0 WHERE reporter_id = ?1 AND kind = ?2 AND ${kind === 'post' ? 'post_id' : 'comment_id'} = ?3`)
    .bind(c.var.user!.id, kind, id)
    .run();
}

/** SQL: has the viewer (?1) reported this post (`p`) and not asked to see it again? */
export const hiddenPostSql = (p: string) => `EXISTS (SELECT 1 FROM reports hr WHERE hr.reporter_id = ?1 AND hr.kind = 'post' AND hr.post_id = ${p}.id AND hr.hidden = 1)`;
/** SQL: … this comment (`x`)? */
export const hiddenCommentSql = (x: string) => `EXISTS (SELECT 1 FROM reports hr WHERE hr.reporter_id = ?1 AND hr.kind = 'comment' AND hr.comment_id = ${x}.id AND hr.hidden = 1)`;
