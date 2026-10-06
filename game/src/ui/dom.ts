/** A small element builder, so the UI reads as markup without a framework. */
import type { Bundle } from '@game/kernel';

type Child = Node | string | number | false | null | undefined;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props | null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function button(label: Child | Child[], onClick: () => void, cls = '', disabled = false): HTMLButtonElement {
  const b = h('button', { class: `btn ${cls}`.trim(), type: 'button', disabled }, label);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

/**
 * A sprite from the kit as a crisp, scaled element. Frames other than the
 * first are shown by shifting a background strip.
 */
export function sprite(bundle: Bundle, ref: string | undefined, scale = 2, frame = 0, cls = ''): HTMLElement {
  const info = ref ? bundle.sprites[ref] : undefined;
  if (!info) return h('span', { class: `sprite missing ${cls}`.trim(), style: `width:${16 * scale}px;height:${16 * scale}px` });
  const w = info.w * scale;
  const hgt = info.h * scale;
  return h('span', {
    class: `sprite ${cls}`.trim(),
    style:
      `width:${w}px;height:${hgt}px;background-image:url("${info.url}");` +
      `background-size:${w * info.frames}px ${hgt}px;background-position:${-frame * w}px 0`,
  });
}
