/**
 * Web Worker: lädt Flurstücks-Kacheln vom LGL-WFS und zerlegt das GML abseits des Haupt-Threads.
 * Liefert kompakte Datensätze zurück; Netzwerkabruf und Parsing blockieren so die Karte nicht.
 */

export interface RawParcel {
  ref: string;
  label: string;
  areaM2: number;
  /** Außenring als [lat, lon]-Paare */
  ring: [number, number][];
}

type Req = { type: 'load'; id: string; url: string } | { type: 'abort'; id: string };
type Res = { id: string; parcels: RawParcel[]; truncated: boolean } | { id: string; error: string; aborted?: boolean };

const ctx = self as unknown as { postMessage(m: Res): void; onmessage: ((e: MessageEvent<Req>) => void) | null };
const controllers = new Map<string, AbortController>();

const REF = /<cp:nationalCadastralReference>([^<]+)</;
const LABEL = /<cp:label>([^<]+)</;
const AREA = /<cp:areaValue[^>]*>([^<]+)</;
const POS = /<gml:posList[^>]*>([^<]+)</;

function parse(xml: string): RawParcel[] {
  const out: RawParcel[] = [];
  const members = xml.split('<wfs:member>');
  for (let i = 1; i < members.length; i++) {
    const m = members[i];
    const ref = REF.exec(m)?.[1]?.trim();
    const pos = POS.exec(m)?.[1];
    if (!ref || !pos) continue;
    const nums = pos.trim().split(/\s+/);
    const ring: [number, number][] = [];
    for (let k = 0; k + 1 < nums.length; k += 2) ring.push([Math.round(+nums[k] * 1e6) / 1e6, Math.round(+nums[k + 1] * 1e6) / 1e6]);
    if (ring.length < 3) continue;
    out.push({ ref, label: LABEL.exec(m)?.[1]?.trim() ?? '', areaM2: Number(AREA.exec(m)?.[1] ?? 0), ring });
  }
  return out;
}

ctx.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'abort') {
    controllers.get(msg.id)?.abort();
    return;
  }
  const ac = new AbortController();
  controllers.set(msg.id, ac);
  try {
    const resp = await fetch(msg.url, { signal: ac.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const parcels = parse(await resp.text());
    ctx.postMessage({ id: msg.id, parcels, truncated: parcels.length >= 5000 });
  } catch (err) {
    ctx.postMessage({ id: msg.id, error: String(err), aborted: ac.signal.aborted });
  } finally {
    controllers.delete(msg.id);
  }
};
