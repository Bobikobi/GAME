/** Measure a cold boot of the built classic game. Start Vite preview, then run:
 * pnpm exec tsx game/scripts/boot-time.ts [url] [--profile]
 */
import { Browser } from '../e2e/cdp';

interface Profile {
  nodes: { id: number; callFrame: { functionName: string }; children?: number[] }[];
  samples: number[];
  timeDeltas: number[];
}

function blendShare(profile: Profile): string {
  const parents = new Map<number, number>();
  const blend = new Set<number>();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) parents.set(child, node.id);
    if (/\bblend(?:Edge)?Tile\b/.test(node.callFrame.functionName)) blend.add(node.id);
  }
  const idle = new Set(profile.nodes.filter((node) => node.callFrame.functionName === '(idle)').map((node) => node.id));
  let total = 0;
  let blended = 0;
  for (const [i, sample] of profile.samples.entries()) {
    if (idle.has(sample)) continue;
    const elapsed = profile.timeDeltas[i] ?? 0;
    total += elapsed;
    for (let id: number | undefined = sample; id !== undefined; id = parents.get(id)) {
      if (!blend.has(id)) continue;
      blended += elapsed;
      break;
    }
  }
  return `${(blended / total * 100).toFixed(1)}% of non-idle profile time in blendTile (inclusive)`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const url = args.find((arg) => !arg.startsWith('--')) ?? 'http://localhost:4173/';
  const profiling = args.includes('--profile');
  const browser = await Browser.launch();
  try {
    const page = await browser.newPage({ width: 1920, height: 1080, mobile: false });
    await page.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.send('Network.enable');
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    // Chrome DevTools' adjusted Fast 4G preset (throughput is bytes per second).
    await page.send('Network.emulateNetworkConditions', {
      offline: false, latency: 165, downloadThroughput: 1_012_500, uploadThroughput: 168_750, connectionType: 'cellular4g',
    });
    if (profiling) {
      await page.send('Profiler.enable');
      await page.send('Profiler.start');
    }
    await page.goto(url);
    const ms = await page.waitFor<number>("performance.getEntriesByName('title', 'mark')[0]?.startTime", 'title paint', 120_000, false);
    const share = profiling ? blendShare((await page.send<{ profile: Profile }>('Profiler.stop')).profile) : '';
    console.log(`${ms.toFixed(1)} ms to title${share ? `, ${share}` : ''}`);
  } finally {
    await browser.close();
  }
}

await main();
