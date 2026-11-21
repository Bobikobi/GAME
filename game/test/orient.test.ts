import { expect, it, vi } from 'vitest';
import { landscapeOnFirstStart, requestLandscape } from '../src/ui/orient';

const allow = () => Promise.resolve();
const refuse = () => Promise.reject(new Error('denied'));
const documentWith = (requestFullscreen = allow) => ({ documentElement: { requestFullscreen }, fullscreenElement: null });

it('enters fullscreen before locking landscape', async () => {
  const lock = vi.fn(allow);
  const fullscreen = vi.fn(allow);
  const asked = requestLandscape(documentWith(fullscreen), { orientation: { lock } });
  expect(fullscreen).toHaveBeenCalledOnce();
  expect(lock).not.toHaveBeenCalled();
  await expect(asked).resolves.toBe('locked');
  expect(lock).toHaveBeenCalledWith('landscape');
});

it.each([
  ['lock rejected', { orientation: { lock: refuse } }, documentWith(), 'refused: landscape lock'],
  ['no orientation API', {}, documentWith(), 'unsupported'],
  ['fullscreen refused', { orientation: { lock: allow } }, documentWith(refuse), 'refused: fullscreen'],
] as const)('returns a plain result when %s', async (_, screen, doc, result) => {
  await expect(requestLandscape(doc, screen)).resolves.toBe(result);
});

it('does not lock after leaving play while fullscreen is pending', async () => {
  const lock = vi.fn(allow);
  const leaving = new AbortController();
  const asked = requestLandscape(documentWith(), { orientation: { lock } }, leaving.signal);
  leaving.abort();
  await expect(asked).resolves.toBe('refused: left play');
  expect(lock).not.toHaveBeenCalled();
});

it('asks on the first phone start gesture and skips desktop starts', () => {
  const request = vi.fn();
  landscapeOnFirstStart(() => false, request)('touch');
  const phoneStart = landscapeOnFirstStart(() => true, request);
  phoneStart('mouse');
  expect(request).not.toHaveBeenCalled();
  phoneStart('touch');
  expect(request).toHaveBeenCalledOnce();
  phoneStart('touch');
  expect(request).toHaveBeenCalledOnce();
});
