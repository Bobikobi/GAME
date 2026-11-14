/**
 * The body of the Settings window (theme D): sections with a heading, each row a label and either a segmented
 * control or a switch. Every press goes through SettingsApplier (settings-apply.ts), so it is applied and kept at
 * once; the window only draws the record and what Auto resolved to. Sound is the mute alone: the audio buses
 * keep their levels inside the graph (audio/index.ts) and the sound API offers no gain per bus.
 * Controls appears with the touch controls and chooses which side the stick uses and how large the controls draw.
 */
import type { SettingsApplier } from '../settings-apply';
import {
  TEXT_SIZES, type ButtonSize, type FrameCap, type Quality, type Settings, type StickSide, type TextSize,
} from '../settings';
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
const SIDES: readonly Choice<StickSide>[] = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }];
const BUTTON_SIZES: readonly Choice<ButtonSize>[] = [
  { value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' },
];

export interface SoundSwitch {
  muted: boolean;
  setMuted(muted: boolean): void;
}

/** Draws the window's body, and draws it again after every change. `touch-on` is the same flag that shows the controls. */
export function settingsBody(
  apply: SettingsApplier,
  sound: SoundSwitch | undefined,
  onClose?: () => void,
  showControls = typeof document !== 'undefined' && document.body.classList.contains('touch-on'),
): HTMLElement {
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
        }))]
        : []),
      ...(showControls ? [
        h('h3', null, 'Controls'),
        row('Stick side', null, segmented('Stick side', SIDES, s.stickSide, (stickSide) => change({ stickSide }))),
        row('Button size', null, segmented('Button size', BUTTON_SIZES, s.buttonSize, (buttonSize) => change({ buttonSize }))),
      ] : []),
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
