/**
 * The wire's merge patch, in the kernel because both ends apply it (NEXT 18 a); this file keeps the
 * server's import path, so nothing that builds a patch or applies one changes.
 */
export { applyStatePatch, publicState, statePatch, type MergePatch, type PublicState } from '@game/kernel';
