/**
 * The body of the Settings window (theme D): sections with a heading, each row a label and either a segmented
 * control or a switch. Every press goes through SettingsApplier (settings-apply.ts), so it is applied and kept at
 * once; the window only draws the record and what Auto resolved to. Sound is the mute and the music's instruments
 * (the player's own choice, DECISIONS.md 2026-10-30, kept on the device by audio/source.ts): the audio buses keep
 * their levels inside the graph (audio/index.ts) and the sound API offers no gain per bus.
 * There is no Controls section: the touch pad and buttons have no side or size to choose today.
 */
import type { SettingsApplier } from '../settings-apply';
import { TEXT_SIZES, type FrameCap, type Quality, type Settings, type TextSize } from '../settings';
import { SOURCE_LABEL, type MusicSource } from '../audio/source';
import { button, h } from './dom';

interface Choice<T> {
  value: T;
  label: string;
}

/** A group of buttons of which one is on, as a radio group. */
function segmented<T>(name: string, choices: readonly Choice<T>[], current: T, onPick: (v: T) => void): HTMLElement {
  const group = h('div', { class: 'set-seg', role: 'radiogroup', 'aria-label': name });
  for (const c of choices) {
    const b = button(c.label, () => onPick(c.value), `set-opt${c.value === current ? ' on' : ''}`);
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(c.value === current));
    group.append(b);
  }
  return group;
}

/** A row that is on or off. */
function toggle(name: string, on: boolean, onFlip: (v: boolean) => void): HTMLElement {
  const b = button(on ? 'On' : 'Off', () => onFlip(!on), `set-switch${on ? ' on' : ''}`);
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.setAttribute('aria-label', name);
  return b;
}

function row(label: string, note: string | null, control: HTMLElement): HTMLElement {
  return h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, h('b', null, label), note ? h('span', { class: 'set-note' }, note) : null), control);
}

const QUALITIES: readonly Choice<Quality>[] = [
  { value: 'auto', label: 'Auto' }, { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
];
const CAPS: readonly Choice<FrameCap>[] = [
  { value: 'auto', label: 'Auto' }, { value: 30, label: '30' }, { value: 60, label: '60' }, { value: 120, label: '120' },
];

export interface SoundSwitch {
  muted: boolean;
  setMuted(muted: boolean): void;
  readonly source: MusicSource;
  setSource(source: MusicSource): void;
}

const SOURCES: readonly Choice<MusicSource>[] = (['real', 'synth'] as const).map((value) => ({ value, label: SOURCE_LABEL[value] }));

/** Draws the window's body, and draws it again after every change. */
export function settingsBody(apply: SettingsApplier, sound: SoundSwitch | undefined, onClose?: () => void): HTMLElement {
  const body = h('div', { class: 'set-body' });
  const draw = () => {
    const s: Settings = apply.settings;
    const change = (patch: Partial<Settings>) => {
      apply.set(patch);
      draw();
    };
    body.replaceChildren(
      h('h3', null, 'Display'),
      row('Quality', s.quality === 'auto' ? apply.qualityAuto() : null, segmented('Quality', QUALITIES, s.quality, (quality) => change({ quality }))),
      row('Frame rate', s.frameCap === 'auto' ? apply.capAuto() : null, segmented('Frame rate', CAPS, s.frameCap, (frameCap) => change({ frameCap }))),
      ...(sound
        ? [h('h3', null, 'Sound'), row('Sound', null, toggle('Sound', !sound.muted, (on) => {
          sound.setMuted(!on);
          draw();
        })), row('Music', null, segmented('Music', SOURCES, sound.source, (source) => {
          sound.setSource(source);
          draw();
        }))]
        : []),
      h('h3', null, 'Accessibility'),
      row('Reduced motion', s.reducedMotion ? null : 'Off follows your phone', toggle('Reduced motion', s.reducedMotion, (reducedMotion) => change({ reducedMotion }))),
      row('Text size', null, segmented<TextSize>('Text size', TEXT_SIZES.map((t) => ({ value: t, label: String(t) })), s.textSize, (textSize) => change({ textSize }))),
      h('div', { class: 'set-foot' }, button('Reset to Auto', () => {
        apply.reset();
        draw();
      }, 'danger set-reset'), ...(onClose ? [button('Done', onClose, 'set-done')] : [])),
    );
  };
  draw();
  return body;
}
