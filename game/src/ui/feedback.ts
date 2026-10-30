/**
 * Sound and motion for what the player earns: coins fly to the purse, a level
 * rings a jingle and flashes a banner, a skill point lights up. Display only:
 * it reads events after the kernel made them and changes nothing.
 */
import type { GameEvent } from '@game/kernel';
import { app } from '../app';
import { sound } from '../audio';
import { planBatch, type Cue } from '../audio/heard';
import { feedTooLate } from '../fires';
import { gold } from '../text';
import { h } from './dom';

/** Cues of one batch play one after another, never on top of each other. */
const CUE_GAP_MS = 140;

export function feedback(root: HTMLElement, events: readonly GameEvent[]): void {
  const cues: Cue[] = [];
  const add = (cue: Cue) => {
    // one of each per batch: three items found is one pickup, not three
    const k = 'sfx' in cue ? cue.sfx : cue.jingle;
    if (!cues.some((c) => ('sfx' in c ? c.sfx : c.jingle) === k)) cues.push(cue);
  };
  let goldIn = 0;
  let goldOut = 0;
  for (const e of events) {
    switch (e.e) {
      case 'gain':
        add({ sfx: 'pickup' });
        break;
      case 'gold':
        if (e.delta > 0) goldIn += e.delta;
        else goldOut -= e.delta;
        add({ sfx: 'coin', detune: e.delta > 0 ? 0 : -300 });
        break;
      case 'bound':
        add({ sfx: 'coin', detune: e.delta > 0 ? 0 : -300 });
        break;
      case 'level':
        add({ jingle: 'level' });
        banner(root, `${app.bundle.professions[e.profession]?.name ?? 'Level'} ${e.level}!`, 'level');
        break;
      case 'attr':
        add({ sfx: 'perfect' });
        break;
      case 'quest':
        add(e.state === 'done' ? { jingle: 'quest' } : { sfx: 'ui' });
        break;
      case 'discover':
        // a first-of-kind item is a page of the journal, not a rare find (G24, G25): the found jingle stays rare
        add({ sfx: 'journal' });
        break;
      case 'riddle':
        add({ jingle: 'found' });
        break;
      case 'learn':
        add({ sfx: 'perfect', detune: 200 });
        break;
      case 'restore':
      case 'build':
        add({ jingle: 'quest' });
        break;
      case 'eat':
        add({ sfx: 'pluck', detune: -400 });
        break;
      case 'fire': {
        // lit after its night was lost: no cheer, the line says it plainly
        const s = app.session;
        if (!s || !feedTooLate(app.bundle, s.state, e.id, s.state.tick)) add({ sfx: 'sizzle', detune: -200 });
        break;
      }
      case 'fire_out':
        add({ sfx: 'douse' });
        break;
      case 'nothing':
      case 'miss':
        add({ sfx: 'miss' });
        break;
      case 'tool_broke':
        add({ sfx: 'crack' });
        break;
      case 'hurt':
        add({ sfx: 'thud', detune: -300 });
        break;
      case 'fall':
        add({ sfx: 'bell', detune: -1200 });
        break;
      case 'seen':
        // heard from where the predator stands: whole beside the player, fainter and dulled when it is far or off-screen
        add({ sfx: 'growl', heard: app.world?.hazardHeard?.(e.id) });
        break;
      case 'safe':
        add({ sfx: 'safe' });
        break;
      case 'bag_full':
        add({ sfx: 'back' });
        break;
      case 'jackpot':
        add({ sfx: 'perfect', detune: 500 });
        banner(root, 'Jackpot!', 'jackpot');
        break;
    }
  }
  // one gold, one coin: when coins fly to the purse, their landing is the batch's coin
  const batch = goldIn > 0 && purse() ? cues.filter((c) => !('sfx' in c && c.sfx === 'coin')) : cues;
  // a jingle carries a batch on its own; without one, two small cues speak for it (SOUND.md section 1.3)
  planBatch(batch).forEach((cue, i) =>
    window.setTimeout(() => {
      if ('jingle' in cue) sound.jingle(cue.jingle);
      else sound.sfx(cue.sfx, { gain: cue.gain, detune: cue.detune, heard: cue.heard });
    }, i * CUE_GAP_MS),
  );
  if (goldIn > 0) coinsToPurse(root, goldIn);
  if (goldOut > 0) purseFloat(root, `-${gold(goldOut)}`, 'spent');
}

/** A word across the middle of the screen that rises and fades. */
export function banner(root: HTMLElement, text: string, kind: 'level' | 'jackpot' | 'point'): void {
  const el = h('div', { class: `banner ${kind}` }, h('span', null, text), h('i', { class: 'burst' }));
  root.append(el);
  window.setTimeout(() => el.remove(), kind === 'level' ? 2400 : 1600);
}

function purse(): DOMRect | undefined {
  return document.querySelector('.hud .chip.gold')?.getBoundingClientRect();
}

/** Where the player stands on the page, so earned things leave from there. */
function playerOnPage(): { x: number; y: number } {
  const s = app.session;
  if (s && app.world) {
    const p = app.world.screenOf(s.pos[0], s.pos[1]);
    return { x: p.x, y: p.y - 10 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** A few coins fly from the player to the purse; the purse shows the sum. */
function coinsToPurse(root: HTMLElement, mg: number): void {
  const to = purse();
  const from = playerOnPage();
  if (!to) return;
  const n = Math.min(6, 2 + Math.floor(mg / 10_000));
  for (let i = 0; i < n; i++) {
    const coin = h('i', { class: 'coin flying' });
    root.append(coin);
    const dx = to.left + 10 - from.x;
    const dy = to.top + to.height / 2 - from.y;
    const lift = -40 - Math.random() * 30;
    const anim = coin.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) scale(1.4)`, opacity: 0 },
        { transform: `translate(${from.x + dx * 0.3}px, ${from.y + lift}px) scale(1.6)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${from.x + dx}px, ${from.y + dy}px) scale(1)`, opacity: 1 },
      ],
      { duration: 650, delay: i * 70, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'backwards' },
    );
    anim.onfinish = () => {
      coin.remove();
      if (i === n - 1) {
        sound.sfx('coin', { detune: 300 });
        purseFloat(root, `+${gold(mg)}`, 'earned');
      }
    };
  }
}

function purseFloat(root: HTMLElement, text: string, kind: 'earned' | 'spent'): void {
  const at = purse();
  if (!at) return;
  const el = h('div', { class: `purse-float ${kind}`, style: `left:${at.left + at.width / 2}px;top:${at.bottom + 2}px` }, text);
  root.append(el);
  window.setTimeout(() => el.remove(), 1300);
}
