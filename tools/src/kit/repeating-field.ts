import type { PNG } from 'pngjs';
import { paletteColourAt } from './import.js';
import { hexToRgb } from './palette.js';

/** Reconcile opposite border strips of existing art; leave its registered central motifs intact. */
export function reconcileStudyField(image: PNG, palette: readonly string[], edgeWidth = 8): void {
  const rgb = palette.map(hexToRgb);
  for (const horizontal of [true, false]) {
    const source = Buffer.from(image.data);
    const span = horizontal ? image.width : image.height;
    const across = horizontal ? image.height : image.width;
    for (let row = 0; row < across; row++) for (let d = 0; d < Math.min(edgeWidth, span / 2); d++) {
      const a = horizontal ? (row * image.width + d) * 4 : (d * image.width + row) * 4;
      const b = horizontal ? (row * image.width + span - 1 - d) * 4 : ((span - 1 - d) * image.width + row) * 4;
      const blend = (1 - d / edgeWidth) * .5;
      for (const [out, other] of [[a, b], [b, a]]) {
        const channels = [0, 1, 2].map(c => Math.round(source[out! + c]! * (1 - blend) + source[other! + c]! * blend));
        const color = paletteColourAt(channels[0]!, channels[1]!, channels[2]!, 0, 0, rgb, false);
        if (!color) throw new Error('Empty study palette');
        image.data.set([...color, 255], out!);
      }
    }
  }
}

export function studyFieldEdgeMismatches(image: PNG): { horizontal: number; vertical: number } {
  const same = (a: number, b: number) => [0, 1, 2, 3].every(c => image.data[a + c] === image.data[b + c]);
  let horizontal = 0, vertical = 0;
  for (let y = 0; y < image.height; y++) if (!same(y * image.width * 4, (y * image.width + image.width - 1) * 4)) horizontal++;
  for (let x = 0; x < image.width; x++) if (!same(x * 4, ((image.height - 1) * image.width + x) * 4)) vertical++;
  return { horizontal, vertical };
}
