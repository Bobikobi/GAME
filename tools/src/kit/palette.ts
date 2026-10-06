/**
 * The core palette: 32 colors, the only ones a kit sprite may use (plus fully
 * transparent pixels). Ramps run dark to light. A copy lives in the core kit
 * file, and `pnpm check` fails when the two disagree.
 */
export const CORE_PALETTE: readonly string[] = [
  // outline and greys
  '#1b1a2e', '#3a3554', '#5d6177', '#8f94a8', '#c6cad6', '#f5f4ef',
  // greens
  '#1f3d2b', '#2e6b3b', '#4c9a3f', '#84c450', '#c8e88a',
  // earth and wood
  '#3d2618', '#6e4226', '#9e6b3c', '#c99a5e', '#ebd3a2',
  // water and sky
  '#172a52', '#275a99', '#3f8fd1', '#7cc4ec', '#c4ecf8',
  // reds
  '#5e1c28', '#a8302f', '#e2533f', '#f6a07f',
  // orange and yellow
  '#b8661f', '#eda83a', '#f8de62',
  // skin
  '#d38c66', '#f3c7a0',
  // purples
  '#5b3373', '#9a5bb0',
];

export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
