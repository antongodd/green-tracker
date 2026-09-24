import { browserSupportsWebAuthn, startAuthentication, startRegistration, WebAuthnError } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api, ApiError, type Passkey } from './api';

export const passkeysSupported = () => browserSupportsWebAuthn();

/** Turns the browser's WebAuthn errors into something a person can act on. */
function friendly(e: unknown): never {
  if (e instanceof ApiError) throw e;
  const name = e instanceof WebAuthnError ? (e.cause as Error | undefined)?.name ?? e.name : (e as Error)?.name;
  const code = e instanceof WebAuthnError ? e.code : '';
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError') {
    throw new ApiError(0, 'passkey_exists', 'This device already has a passkey for your account.');
  }
  if (name === 'NotAllowedError' || name === 'AbortError') {
    throw new ApiError(0, 'cancelled', 'The passkey step was cancelled or timed out. Try again when you’re ready.');
  }
  throw new ApiError(0, 'passkey_error', 'Your device couldn’t use a passkey. Please try again.');
}

type Options<T> = { challengeId: string; options: T };

async function create(optionsPath: string, body?: unknown) {
  const { challengeId, options } = await api<Options<PublicKeyCredentialCreationOptionsJSON>>('POST', optionsPath, body);
  const response = await startRegistration({ optionsJSON: options }).catch(friendly);
  return { challengeId, response };
}

export async function signUp(username: string): Promise<{ user: { username: string }; recoveryCodes: string[] }> {
  const { challengeId, response } = await create('/auth/signup/options', { username });
  return api('POST', '/auth/signup/verify', { challengeId, response });
}

export async function signIn(): Promise<{ user: { username: string } }> {
  const { challengeId, options } = await api<Options<PublicKeyCredentialRequestOptionsJSON>>('POST', '/auth/signin/options');
  const response = await startAuthentication({ optionsJSON: options }).catch(friendly);
  return api('POST', '/auth/signin/verify', { challengeId, response });
}

export async function addPasskey(): Promise<{ passkeys: Passkey[] }> {
  const { challengeId, response } = await create('/account/passkeys/options');
  return api('POST', '/account/passkeys/verify', { challengeId, response });
}

/**
 * Deletes the account after a fresh passkey check. Afterwards, where the browser
 * supports it, tells the device the passkey is gone so it can offer to remove it.
 */
export async function deleteAccount(username: string): Promise<void> {
  const { challengeId, options } = await api<Options<PublicKeyCredentialRequestOptionsJSON>>('POST', '/data/delete/options');
  const response = await startAuthentication({ optionsJSON: options }).catch(friendly);
  await api('POST', '/data/delete', { challengeId, response, username });
  const pkc = window.PublicKeyCredential as unknown as { signalUnknownCredential?: (o: { rpId: string; credentialId: string }) => Promise<void> };
  await pkc?.signalUnknownCredential?.({ rpId: options.rpId ?? location.hostname, credentialId: response.id }).catch(() => {});
}
