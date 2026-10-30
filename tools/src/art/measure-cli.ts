import { measureCli } from './measure.js';

const { text, code } = measureCli(process.argv.slice(2));
process.stdout.write(text);
process.exitCode = code;
