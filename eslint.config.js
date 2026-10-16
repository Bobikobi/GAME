// Lint rules for the whole repo, plus the kernel's purity rules (spec R1, R2, R4):
// the simulation step may not read clocks, timers, randomness or floats, so a
// replay gives the same state on every machine.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

const PURE = 'The kernel is a pure step (rule R1): no clocks, timers, randomness or I/O.';
const INTEGER = 'The kernel uses safe integers only (rule R2): use idiv / mulDiv from num.ts.';

const BANNED_GLOBALS = [
  'Date',
  'performance',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'queueMicrotask',
  'crypto',
  'fetch',
  'window',
  'document',
  'localStorage',
  'process',
  'parseFloat',
];

// Math functions that return floats or depend on the platform
const BANNED_MATH = [
  'acos',
  'acosh',
  'asin',
  'asinh',
  'atan',
  'atan2',
  'atanh',
  'cbrt',
  'cos',
  'cosh',
  'exp',
  'expm1',
  'fround',
  'hypot',
  'log',
  'log10',
  'log1p',
  'log2',
  'pow',
  'round',
  'sin',
  'sinh',
  'sqrt',
  'tan',
  'tanh',
];

export default defineConfig(
  {
    ignores: ['**/dist/**', '**/dist-3d/**', 'game/public3d/**', '**/node_modules/**', 'game/src/generated/**', 'game/public/**', 'docs/**', 'coverage/**', '.scratch/**', 'web/.astro/**', '**/.vercel/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['kernel/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...BANNED_GLOBALS.map((name) => ({ name, message: PURE }))],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Draws come from rng.ts (rule R4).' },
        ...BANNED_MATH.map((property) => ({ object: 'Math', property, message: INTEGER })),
        { object: 'Number', property: 'parseFloat', message: INTEGER },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[raw=/^(\\d[\\d_]*)?\\.\\d|^\\d[\\d_]*[eE]/]', message: `${INTEGER} Write integer literals out in full.` },
        { selector: "BinaryExpression[operator='/']", message: `${INTEGER} Plain division gives floats.` },
        { selector: "AssignmentExpression[operator='/=']", message: `${INTEGER} Plain division gives floats.` },
      ],
    },
  },
  {
    // the one place that divides, carefully, so nothing else has to
    files: ['kernel/src/num.ts'],
    rules: {
      'no-restricted-syntax': ['error', { selector: 'Literal[raw=/^(\\d[\\d_]*)?\\.\\d|^\\d[\\d_]*[eE]/]', message: INTEGER }],
    },
  },
);
