/**
 * What the crossing card shows (docs/design/SEA_CROSSING.md): how far the boat is, the sign one segment before the
 * event strikes, and what the player can answer while it is open. Pure, so the rule can be tested without a page;
 * the kernel decides every answer, this only reads its state.
 */
import { type Bundle, type PublicState, exitRect, near, seaNow } from '@game/kernel';

import { itemName } from './text';

export interface SeaAnswer {
  label: string;
  /** a riddle's choice, by its place among the choices */
  choice?: number;
}

export interface SeaView {
  passage: string;
  title: string;
  /** segments sailed, of `segments` */
  segment: number;
  segments: number;
  /** the event's name and its sign, once the sign shows; kept through the window and after it */
  event?: string;
  sign?: readonly string[];
  /** a riddle's clue while it is open */
  clue?: string;
  /** what can be answered now: empty outside the window, after the outcome, and once answered on this segment */
  answers: SeaAnswer[];
  /** a tend's count while it holds: "1 of 3" */
  held?: string;
}

/** The passage a player standing on `at` can board: one whose jetty is on or beside the tile. */
export function passageAt(b: Bundle, at: readonly [number, number]): string | undefined {
  for (const p of Object.values(b.passages)) {
    const jetty = exitRect(b, p.from);
    if (jetty && near(at, jetty)) return p.id;
  }
  return undefined;
}

export function seaView(b: Bundle, st: PublicState): SeaView | undefined {
  const aboard = st.player.aboard;
  if (!aboard) return undefined;
  const now = seaNow(b, aboard);
  if (!now) return undefined;
  const { passage: p, event: e } = now;
  const view: SeaView = { passage: p.id, title: p.title, segment: aboard.segment, segments: p.segments, answers: [] };
  // the event is named from its sign on: before it, the water is only water
  const shown = now.sign || now.open || aboard.outcome !== 'open';
  if (shown) {
    view.event = e.title;
    view.sign = e.sign;
  }
  const act = e.act;
  if (act.kind === 'tend' && aboard.answers > 0 && aboard.outcome === 'open') view.held = `${aboard.answers} of ${act.times}`;
  if (!now.open || aboard.answeredAt === aboard.segment) return view;
  if (act.kind === 'riddle') {
    view.clue = act.clue;
    view.answers = act.choices.map((label, choice) => ({ label, choice }));
  } else if (act.kind === 'bring') {
    view.answers = [{ label: act.qty === 1 ? `Give ${itemName(b, act.item)}` : `Give ${act.qty} ${itemName(b, act.item)}` }];
  } else if (act.kind === 'tend') {
    view.answers = [{ label: 'Hold on' }];
  } else {
    view.answers = [{ label: 'Catch it' }];
  }
  return view;
}
