/**
 * Puts a change of the settings (settings.ts) to work at once, for the Settings window (ui/settings-window.ts):
 * the record is kept, the frame cap goes to the loop (perf.ts applyCap), the quality groups are redrawn into RICH,
 * and the text size and reduced motion go to the page as two attributes the stylesheet reads (ui/settings.css).
 * The window holds no rule of its own: it asks this and shows what comes back.
 */
import { RICH } from './config';
import { applyCap, type Perf } from './perf';
import {
  AUTO_SETTINGS, autoCapLabel, autoQualityLabel, clearSettings, motionReduced, phoneAsksReducedMotion, resolve, richOf, writeSettings,
  type Settings, type SettingsStorage,
} from './settings';

/** The page's root, as far as it is touched: two data attributes. */
export interface Root {
  dataset: Record<string, string | undefined>;
}

/** The text size and the motion preference as attributes on the page root. */
export function applyDisplay(root: Root, s: Settings, phoneAsks = phoneAsksReducedMotion()): void {
  root.dataset.textSize = String(s.textSize);
  root.dataset.motion = motionReduced(s, phoneAsks) ? 'reduced' : 'full';
}

export interface Host {
  perf: Perf;
  game: Parameters<typeof applyCap>[0];
  storage: SettingsStorage | null;
  root: Root;
  /** the page named its ?rich= groups: the preset does not override them */
  richFromUrl: boolean;
}

export class SettingsApplier {
  constructor(private readonly host: Host) {}

  get settings(): Settings {
    return this.host.perf.settings;
  }

  /** Changes some fields: kept, then applied at once. */
  set(patch: Partial<Settings>): Settings {
    return this.take({ ...this.settings, ...patch }, true);
  }

  /** Every row back to Auto, the stored record cleared. */
  reset(): Settings {
    clearSettings(this.host.storage);
    return this.take({ ...AUTO_SETTINGS }, false);
  }

  /** What Auto came to on this device, for the label beside the quality row. */
  qualityAuto(): string {
    return autoQualityLabel(resolve(AUTO_SETTINGS, this.host.perf.device));
  }

  /** ...and beside the frame-rate row. */
  capAuto(): string {
    const e = resolve(AUTO_SETTINGS, this.host.perf.device);
    return autoCapLabel(e, this.host.perf.device);
  }

  private take(next: Settings, keep: boolean): Settings {
    const { perf, game, storage, root, richFromUrl } = this.host;
    perf.settings = next;
    if (keep) writeSettings(storage, next);
    applyCap(game, perf);
    if (!richFromUrl) Object.assign(RICH, richOf(perf.effective.quality, motionReduced(next, phoneAsksReducedMotion())));
    applyDisplay(root, next);
    return next;
  }
}
