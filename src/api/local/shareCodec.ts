export const MAX_SHARE_CHARS = 60000;
const toB64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (s: string) => { const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
const pipe = async (bytes: Uint8Array, t: CompressionStream | DecompressionStream) => new Uint8Array(await new Response(new Response(bytes as unknown as BodyInit).body!.pipeThrough(t)).arrayBuffer());

/** Encodes a design into a URL-safe string. No server is involved: the whole design lives in the link. */
export async function encodeShare(questionId: string, doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, q: questionId, d: doc }));
  let out: string;
  try { out = `z.${toB64(await pipe(bytes, new CompressionStream('deflate-raw')))}`; } catch { out = `p.${toB64(bytes)}`; }
  if (out.length > MAX_SHARE_CHARS) throw new Error('This design is too large for a link. Use Export → Design as JSON instead.');
  return out;
}

/** Decodes a share payload. The returned design is untrusted and must be validated by the caller. */
export async function parseShare(payload: string): Promise<{ questionId: string; doc: unknown }> {
  try {
    const kind = payload.slice(0, 2); const body = payload.slice(2);
    if (kind !== 'z.' && kind !== 'p.') throw new Error('unknown format');
    const bytes = kind === 'z.' ? await pipe(fromB64(body), new DecompressionStream('deflate-raw')) : fromB64(body);
    const j = JSON.parse(new TextDecoder().decode(bytes));
    if (j?.v !== 1 || typeof j.q !== 'string' || typeof j.d !== 'object' || j.d === null) throw new Error('bad structure');
    return { questionId: j.q, doc: j.d };
  } catch { throw new Error('This share link is damaged or not a HLD Studio design.'); }
}
