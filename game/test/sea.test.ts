/** The crossing card's words (game/src/sea.ts): the water is only water until the sign, and an answer shows only while it can be given. */
import { describe, expect, test } from 'vitest';

import { type State, exitRect, newState, seaWindow } from '@game/kernel';
import { passageAt, seaView } from '../src/sea';
import { loadBundle } from '../../tools/test/helpers/world';

const b = loadBundle();
const BAY = 'core/bay-crossing';
const p = b.passages[BAY]!;

/** A state aboard the bay's boat with event `id` drawn, `segment` segments sailed. */
function aboard(id: string, segment: number): State {
  const s = newState(b, 1);
  s.player.aboard = { passage: BAY, segment, event: p.events.findIndex((e) => e.id === id), answers: 0, answeredAt: -1, outcome: 'open' };
  return s;
}

describe('passageAt', () => {
  const opened = newState(b, 1);
  opened.player.quests['core/a-coin-for-maru'] = 'done';

  test('the boat is offered on and beside its jetty, and nowhere else', () => {
    const jetty = exitRect(b, p.from)!;
    expect(passageAt(b, opened, [jetty.x, jetty.y])).toBe(BAY);
    expect(passageAt(b, opened, [jetty.x - 1, jetty.y + jetty.h])).toBe(BAY);
    expect(passageAt(b, opened, [jetty.x + jetty.w + 1, jetty.y])).toBeUndefined();
    expect(passageAt(b, opened, [b.map.spawn.x, b.map.spawn.y])).toBeUndefined();
  });

  test('before Maru\'s coin the jetty offers nothing', () => {
    const jetty = exitRect(b, p.from)!;
    expect(passageAt(b, newState(b, 1), [jetty.x, jetty.y])).toBeUndefined();
  });
});

describe('seaView', () => {
  test('ashore there is no card', () => {
    expect(seaView(b, newState(b, 1))).toBeUndefined();
  });

  test('the event is named from its sign on, and answered only inside its window', () => {
    const e = p.events.find((x) => x.id === 'core/drifting-crate')!;
    const { first, last } = seaWindow(p, e);
    expect(seaView(b, aboard(e.id, first - 2))!.event).toBeUndefined();
    const sign = seaView(b, aboard(e.id, first - 1))!;
    expect(sign.event).toBe(e.title);
    expect(sign.sign).toEqual(e.sign);
    expect(sign.answers).toEqual([]);
    expect(seaView(b, aboard(e.id, first))!.answers).toEqual([{ label: 'Catch it' }]);
    expect(seaView(b, aboard(e.id, last + 1))!.answers).toEqual([]);
    const answered = aboard(e.id, first);
    answered.player.aboard!.answeredAt = first;
    expect(seaView(b, answered)!.answers).toEqual([]);
  });

  test('a riddle shows its clue and one button a choice; a bring names what it takes; a tend counts', () => {
    const fog = p.events.find((x) => x.id === 'core/fog-bell')!;
    const riddle = seaView(b, aboard(fog.id, seaWindow(p, fog).first))!;
    expect(riddle.clue).toBe(fog.act.kind === 'riddle' ? fog.act.clue : '');
    expect(riddle.answers.map((a) => a.choice)).toEqual([0, 1, 2]);
    const passenger = p.events.find((x) => x.id === 'core/passenger')!;
    expect(seaView(b, aboard(passenger.id, seaWindow(p, passenger).first))!.answers).toEqual([{ label: `Give ${b.items['core/herb']!.name}` }]);
    const squall = p.events.find((x) => x.id === 'core/squall')!;
    const held = aboard(squall.id, seaWindow(p, squall).first);
    held.player.aboard!.answers = 1;
    expect(seaView(b, held)!.held).toBe('1 of 3');
  });
});
