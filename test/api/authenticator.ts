// A software passkey: produces real WebAuthn registration and assertion
// responses (ES256, "none" attestation) so the tests exercise the server's
// actual verification, not a mock.
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;

export const b64url = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) (out.set(p, i), (i += p.length));
  return out;
};
const sha256 = async (b: Uint8Array) => new Uint8Array(await subtle.digest('SHA-256', new Uint8Array(b)));
const utf8 = (s: string) => new TextEncoder().encode(s);

// Minimal CBOR encoder: ints, byte strings, text strings, maps.
function cborHead(major: number, n: number): Uint8Array {
  if (n < 24) return Uint8Array.of((major << 5) | n);
  if (n < 256) return Uint8Array.of((major << 5) | 24, n);
  if (n < 65536) return Uint8Array.of((major << 5) | 25, n >> 8, n & 255);
  throw new Error('too long');
}
type Cbor = number | string | Uint8Array | Map<Cbor, Cbor>;
function cbor(v: Cbor): Uint8Array {
  if (typeof v === 'number') return v >= 0 ? cborHead(0, v) : cborHead(1, -1 - v);
  if (typeof v === 'string') return concat(cborHead(3, utf8(v).length), utf8(v));
  if (v instanceof Uint8Array) return concat(cborHead(2, v.length), v);
  return concat(cborHead(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)]));
}

/** WebCrypto gives ECDSA signatures as r‖s; WebAuthn wants ASN.1 DER. */
function derSignature(raw: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0]! & 0x80) v = concat(Uint8Array.of(0), v);
    return concat(Uint8Array.of(0x02, v.length), v);
  };
  const body = concat(int(raw.slice(0, 32)), int(raw.slice(32)));
  return concat(Uint8Array.of(0x30, body.length), body);
}

export class SoftPasskey {
  readonly credentialId = webcrypto.getRandomValues(new Uint8Array(16));
  private keys!: CryptoKeyPair;
  private userHandle = new Uint8Array();
  counter = 0;

  constructor(
    private rpId = 'localhost',
    private origin = 'http://localhost',
  ) {}

  get id(): string {
    return b64url(this.credentialId);
  }

  private async authData(flags: number, attested?: Uint8Array): Promise<Uint8Array> {
    const count = new Uint8Array(4);
    new DataView(count.buffer).setUint32(0, this.counter);
    return concat(await sha256(utf8(this.rpId)), Uint8Array.of(flags), count, attested ?? new Uint8Array());
  }

  /** Answers navigator.credentials.create() options (JSON form). */
  async register(options: { challenge: string; user: { id: string } }, overrides: { origin?: string } = {}) {
    this.keys = (await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
    this.userHandle = fromB64url(options.user.id);
    const jwk = await subtle.exportKey('jwk', this.keys.publicKey);
    const cose = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, fromB64url(jwk.x!)], [-3, fromB64url(jwk.y!)]]));
    const idLen = Uint8Array.of(0, this.credentialId.length);
    const attested = concat(new Uint8Array(16), idLen, this.credentialId, cose);
    const authData = await this.authData(0x01 | 0x04 | 0x40, attested); // UP, UV, AT
    const clientData = utf8(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin: overrides.origin ?? this.origin, crossOrigin: false }));
    const attestationObject = cbor(new Map<Cbor, Cbor>([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: { clientDataJSON: b64url(clientData), attestationObject: b64url(attestationObject), transports: ['internal'] },
      clientExtensionResults: {},
    };
  }

  /** Answers navigator.credentials.get() options (JSON form). */
  async authenticate(options: { challenge: string }, overrides: { origin?: string } = {}) {
    this.counter++;
    const authData = await this.authData(0x01 | 0x04); // UP, UV
    const clientData = utf8(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin: overrides.origin ?? this.origin, crossOrigin: false }));
    const signed = concat(authData, await sha256(clientData));
    const raw = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, this.keys.privateKey, signed));
    return {
      id: this.id,
      rawId: this.id,
      type: 'public-key',
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authData),
        signature: b64url(derSignature(raw)),
        userHandle: b64url(this.userHandle),
      },
      clientExtensionResults: {},
    };
  }
}
