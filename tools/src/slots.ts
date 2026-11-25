/**
 * pnpm slots [--free] [--kind <kind>]
 *
 * The map's slots, one per line: id, kind, and the record that fills the slot, or `free`. `--free` lists only the
 * slots that await a creator; `--kind <kind>` lists one kind (resource, ruin, npc, building, restore, camp, area).
 * It is the same list the MCP `slots` tool answers (tools/src/hub/content.ts), read from the checkout.
 */
import { assemble } from './assemble';
import { loadAll } from './load';
import { mapSlots } from './hub/content';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const free = args.includes('--free');
const kind = flag('--kind');

const bundle = assemble(loadAll().files).bundle;
if (!bundle) {
  console.error('The content does not assemble; run "pnpm check" first.');
  process.exit(1);
}

let slots = mapSlots(bundle).sort((a, b) => a.id.localeCompare(b.id));
if (kind !== undefined) slots = slots.filter((s) => s.kind === kind);
if (free) slots = slots.filter((s) => s.filled_by === null);
for (const s of slots) console.log(`${s.id} ${s.kind} ${s.filled_by ?? 'free'}`);
