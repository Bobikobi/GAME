import type { Mask } from './cast';

export interface StudyFoot { x: number; y: number; support: boolean }
export interface FootContact { x: number; y: number; width: number }

/** The ground contact follows a supporting shoe, never the bottommost swinging toe. */
export function worldStudyFootContacts(mask: Mask, originX: number, originY: number, feet: readonly StudyFoot[]): FootContact[] {
  const contacts: FootContact[] = [];
  for (const foot of feet) {
    if (!foot.support) continue;
    const cx = originX + foot.x, cy = originY + foot.y;
    const left = Math.floor(cx - 5), right = Math.ceil(cx + 5);
    for (let y = Math.min(mask.h - 1, Math.ceil(cy + 4)); y >= Math.max(0, Math.floor(cy - 4)); y--) {
      const spans = mask.rows[y]!.map(([a, b]) => [Math.max(a, left), Math.min(b, right)] as const).filter(([a, b]) => a <= b);
      if (!spans.length) continue;
      for (const [a, b] of spans) contacts.push({ x: a - originX, y: y - originY, width: b - a + 1 });
      break;
    }
  }
  // Union the four-row contact lines before drawing, so nearby supporting feet
  // never multiply the shadow alpha where their marks overlap.
  const rows = new Map<number, [number, number][]>();
  for (const contact of contacts) for (let dy = 0; dy < 4; dy++) {
    const y = contact.y + dy;
    const spans = rows.get(y) ?? [];
    spans.push([contact.x, contact.x + contact.width - 1]);
    rows.set(y, spans);
  }
  const union: FootContact[] = [];
  for (const [y, spans] of rows) {
    spans.sort((a, b) => a[0] - b[0]);
    let last: FootContact | undefined;
    for (const [a, b] of spans) {
      if (last && a <= last.x + last.width) last.width = Math.max(last.width, b - last.x + 1);
      else { last = { x: a, y, width: b - a + 1 }; union.push(last); }
    }
  }
  return union;
}
