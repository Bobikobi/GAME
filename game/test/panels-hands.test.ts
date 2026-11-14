import { beforeAll, expect, test, vi } from 'vitest';
import { WEAR_SLOTS } from '@game/kernel';
import { app } from '../src/app';
import { Session } from '../src/session';
import { openBag } from '../src/ui/panels';
import type { UI } from '../src/ui/ui';
import { loadBundle } from '../../tools/test/helpers/world';

// Capture the real panel's element tree and click handlers without a browser.
vi.mock('../src/ui/dom', () => {
  class Element {
    children: (Element | string)[] = [];
    dataset = {};
    constructor(public tag: string, public props: Record<string, unknown> = {}) {}
    append(...children: (Element | string)[]) { this.children.push(...children); }
    replaceChildren(...children: (Element | string)[]) { this.children = children; }
    addEventListener() {}
    focus() {}
    querySelector() { return null; }
  }
  const h = (tag: string, props: Record<string, unknown> | null, ...children: unknown[]) => {
    const el = new Element(tag, props ?? {});
    el.append(...children.flat().filter((c) => c !== null && c !== undefined && c !== false) as (Element | string)[]);
    return el;
  };
  return {
    h,
    button: (label: string, onclick: () => void, cls = '') => h('button', { class: cls, onclick }, label),
    sprite: () => h('span', null),
  };
});

interface Element {
  tag: string;
  props: Record<string, unknown>;
  children: (Element | string)[];
}
const elements = (el: Element): Element[] => [el, ...el.children.flatMap((c) => typeof c === 'object' ? elements(c) : [])];
const text = (el: Element): string => el.children.map((c) => typeof c === 'object' ? text(c) : String(c)).join('');

beforeAll(() => {
  app.bundle = loadBundle();
  app.session = Session.fresh(app.bundle, 1);
});

test('the kit renders ten work and look rows in WEAR_SLOTS order, with Gloves after Feet', () => {
  let root: Element | undefined;
  const ui = { push: ({ el }: { el: HTMLElement }) => { root = el as unknown as Element; }, pop: () => {} } as unknown as UI;
  openBag(ui);
  const outfit = elements(root!).find((el) => el.tag === 'button' && text(el) === 'Outfit')!;
  (outfit.props.onclick as () => void)();
  const labels: Record<string, string> = { head: 'Head', top: 'Top', legs: 'Legs', outfit: 'Outfit', feet: 'Feet', hands: 'Gloves', jewelry1: 'Jewel 1', jewelry2: 'Jewel 2', hand: 'Hand', back: 'Back' };
  const check = () => {
    const rows = elements(root!).filter((el) => el.props.class === 'worn-row');
    expect(rows).toHaveLength(10);
    const sides = elements(root!).filter((el) => el.props.class === 'worn-slots');
    expect(sides.map((side) => side.children.length)).toEqual([5, 5]);
    expect(rows.map((row) => text(row.children[0] as Element))).toEqual(WEAR_SLOTS.map((slot) => labels[slot]));
    expect(text(rows[5]!.children[0] as Element)).toBe('Gloves');
    expect(rows.every((row) => text(row.children[1] as Element) === 'Empty')).toBe(true);
  };
  check();
  const look = elements(root!).find((el) => el.tag === 'button' && text(el) === 'Look')!;
  (look.props.onclick as () => void)();
  check();
});
