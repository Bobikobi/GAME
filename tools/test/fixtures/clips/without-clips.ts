import type { LoadedFile } from '../../../src/load';

/**
 * The files of the real content with the real kit's clip sheets taken out. The fixture kit stands in for the clips in the
 * tests of the clip rules (one sheet per verb, race and view); the real kit holds the packed clips since #742 stage 2, and
 * the two would be two sheets for one lookup.
 */
export function withoutClips(files: readonly LoadedFile[]): LoadedFile[] {
  return files.map((f) => {
    const kit = (f.data as { kit?: { sprites?: Record<string, { clip?: unknown }> } }).kit;
    if (!kit?.sprites) return f;
    const sprites = Object.fromEntries(Object.entries(kit.sprites).filter(([, s]) => !s.clip));
    return { ...f, data: { ...f.data, kit: { ...kit, sprites } } } as LoadedFile;
  });
}
