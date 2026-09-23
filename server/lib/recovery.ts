import { RECOVERY_CODE_ALPHABET, RECOVERY_CODE_COUNT, formatRecoveryCode } from '../../shared/domain/account';
import { randomId, randomString, sha256Hex } from './crypto';

/** Hash is per user, so equal codes on two accounts never share a hash. Input must already be normalised. */
export function hashRecoveryCode(userId: string, normalisedCode: string): Promise<string> {
  return sha256Hex(`recovery:${userId}:${normalisedCode}`);
}

/**
 * Makes a fresh set of codes for `userId`. Returns the statements that replace
 * any existing set (so old codes stop working) and the formatted codes to show once.
 */
export async function newRecoveryCodes(db: D1Database, userId: string): Promise<{ statements: D1PreparedStatement[]; codes: string[] }> {
  const raw = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomString(RECOVERY_CODE_ALPHABET, 8));
  const statements = [db.prepare('DELETE FROM recovery_codes WHERE user_id = ?1').bind(userId)];
  for (const code of raw) {
    statements.push(
      db.prepare('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?1, ?2, ?3)').bind(randomId(), userId, await hashRecoveryCode(userId, code)),
    );
  }
  return { statements, codes: raw.map(formatRecoveryCode) };
}
