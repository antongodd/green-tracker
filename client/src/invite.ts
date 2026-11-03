// Invite a friend (D82): the iPhone share sheet with "Follow me on Green Tracker: @name" and the
// website's address (Anton's pick; the one link from the app to the website, narrowing D63's "no link").
// Only shares when tapped; following still needs your approval. Nothing is stored or sent by the app.

/** The public website (D63), never the locked preview: a friend must be able to open it. */
export const WEBSITE = 'https://green-tracker-site.green-tracker.workers.dev';

export const inviteText = (username: string) => `Follow me on Green Tracker: @${username}`;

/**
 * Opens the share sheet; where there's none (a computer's browser), copies the message instead.
 * 'cancelled' when you close the sheet without sharing.
 */
export async function invite(username: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const text = inviteText(username);
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url: WEBSITE });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${WEBSITE}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}
