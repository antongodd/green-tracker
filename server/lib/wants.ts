import { wantsTriedBy, type TickingProduct, type Want } from '../../shared/domain/wants';

/**
 * D92: the wants a saved product ticks off (a strain with its name, a source it's from or was bought at), and the
 * statement that removes them, for the caller's D1 batch, so they go only if the product is saved.
 */
export async function tickOffWrites(db: D1Database, userId: string, product: TickingProduct): Promise<{ statements: D1PreparedStatement[]; ticked: Pick<Want, 'kind' | 'name'>[] }> {
  const { results } = await db.prepare('SELECT id, kind, name FROM wants WHERE user_id = ?1').bind(userId).all<Pick<Want, 'id' | 'kind' | 'name'>>();
  const ticked = wantsTriedBy(results, product);
  if (!ticked.length) return { statements: [], ticked: [] };
  return {
    statements: [db.prepare('DELETE FROM wants WHERE user_id = ?1 AND id IN (SELECT value FROM json_each(?2))').bind(userId, JSON.stringify(ticked.map((w) => w.id)))],
    ticked: ticked.map((w) => ({ kind: w.kind, name: w.name })),
  };
}
