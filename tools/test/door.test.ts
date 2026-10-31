/** The site's Play doors (NEXT 18 h6): the demo by default, the game with an account when the build names it. */
import { describe, expect, it } from 'vitest';
import { DEMO_DOOR, playDoor } from '../src/site/door';

describe('playDoor', () => {
  it('opens the demo when SITE_GAME_URL is unset or blank', () => {
    expect(playDoor({})).toBe(DEMO_DOOR);
    expect(playDoor({ SITE_GAME_URL: '' })).toBe('/play/');
    expect(playDoor({ SITE_GAME_URL: '  ' })).toBe('/play/');
  });
  it('opens the root of the name an https origin gives', () => {
    expect(playDoor({ SITE_GAME_URL: 'https://play.example.org' })).toBe('https://play.example.org/');
    expect(playDoor({ SITE_GAME_URL: ' https://play.example.org/ ' })).toBe('https://play.example.org/');
  });
  it('stops the build on anything but an https origin', () => {
    for (const bad of ['play.example.org', 'http://play.example.org', 'https://play.example.org/play/', 'https://play.example.org/?a=1', 'https://u:p@play.example.org', 'javascript:alert(1)']) {
      expect(() => playDoor({ SITE_GAME_URL: bad }), bad).toThrow(/SITE_GAME_URL/);
    }
  });
});
