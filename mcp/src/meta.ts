/**
 * What every answer carries (docs/team/PLATFORM.md, section 4.1): the content format, the MCP version, the tag of the
 * content bundle the answer was computed from, and the checkout. The bundle is assembled once per process; a creator
 * who edits content restarts the tool or calls `check`, which assembles afresh.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FORMAT_VERSION } from '@game/schema';
import { assemble, loadAll } from '@game/tools';
import { MCP_VERSION, type Meta } from './tools';

let tag: string | undefined;

/** The tag of the checkout's content bundle; "unassembled" while the content does not assemble. */
export function contentTag(): string {
  tag ??= assemble(loadAll().files).bundle?.tag ?? 'unassembled';
  return tag;
}

/** Set by a fresh assembly (`check`), so the next answer names it; undefined means it did not assemble. */
export function setContentTag(next: string | undefined): void {
  tag = next ?? 'unassembled';
}

export function meta(root: string): Meta {
  return { format: FORMAT_VERSION, mcp: MCP_VERSION, content_tag: contentTag(), root };
}

/** The version of this package, which follows the content format. */
export const packageVersion = (): string =>
  (JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8')) as { version: string }).version;
