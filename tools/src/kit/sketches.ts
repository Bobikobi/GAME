import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

import { CORE_PALETTE, coreRamp, hexToRgb } from './palette.js';

type Grid = readonly string[];
type Category = 'tiles' | 'items' | 'props' | 'chars';

interface Sketch {
  name: string;
  category: Category;
  frameWidth: number;
  frameHeight: number;
  frames: readonly Grid[];
}

export const PALETTE_LEGEND: Readonly<Record<string, number>> = {
  o: 0, d: 1, g: 2, G: 3, H: 4, W: 5,
  a: 6, b: 7, c: 8, e: 9, f: 10,
  u: 11, v: 12, w: 13, x: 14, y: 15,
  q: 16, r: 17, s: 18, t: 19, z: 20,
  A: 21, B: 22, C: 23, D: 24,
  E: 25, F: 26, I: 27,
  K: 28, L: 29, M: 30, N: 31,
  // the six steps of the shared moss ramp, dark to light: an olive the core greens lack (ground motifs only)
  '0': 32, '1': 33, '2': 34, '3': 35, '4': 36, '5': 37,
};

/** The colour of each letter's index: the 32 core colours, then the moss ramp's steps. */
export const LETTER_PALETTE: readonly string[] = [...CORE_PALETTE, ...(coreRamp('moss')?.steps ?? [])];

const grass: Grid = [
  'cccccccccccccccc',
  'cccbcccccecccccc',
  'ccbcbccccccccccc',
  'ccccccccccccbccc',
  'cccccecccccbcbcc',
  'cbcccccccccccccc',
  'bcbccccccccccccc',
  'cccccccccecccccc',
  'ccccccccccccccbc',
  'ccccbccccccccbcb',
  'cccbcbcccccccccc',
  'cccccccccccecccc',
  'ccccccccbccccccc',
  'cceccccbcbcccccc',
  'cccccccccccccccc',
  'cccccccccccccccc',
];

const grassFlowers: Grid = [
  'cccccccccccccccc',
  'cccbcccccecccccc',
  'ccbcbccccccccccc',
  'ccccccWcccccbccc',
  'cccccWIccccbcbcc',
  'cbccccWccccccccc',
  'bcbccccccccccccc',
  'cccccccccecccccc',
  'ccccccccccccccbc',
  'ccccbccccNcccbcb',
  'cccbcbccNNNccccc',
  'ccccccccNccceccc',
  'ccIccWccbccccccc',
  'cceWIWcbcbcccccc',
  'ccIccWcccccccccc',
  'cccccccccccccccc',
];

const grove: Grid = [
  'bbbbbbbbbbbbbbbb',
  'bbbabbbbbcbbbbbb',
  'bbababbcbbbbbbbb',
  'bbbbbbbbbbbbabbb',
  'bbbbcbbbbbbababb',
  'babbbbbbbbbbbbbb',
  'ababbcbbbbbbbbbb',
  'bbbbbbbbcbbbbbbb',
  'bbbbbbbbbbbbbbab',
  'bbbbabbbbbbbabab',
  'bbbababbcbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbabbbbbbb',
  'bbcbbbbababbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
];

const forest: Grid = [
  'aabbbbaaaabbbbaa',
  'abcbbaabbcbbbbaa',
  'bccbbaaabccbbbaa',
  'bbbaaabbbbbaabbb',
  'baaaabcbbaaabbbb',
  'aaoaabccbaaoaaba',
  'aabbbbcbbbaabbaa',
  'bbbccbbbbaabccbb',
  'bbcccbbaaaabccbb',
  'abbcbbaaoaabbbaa',
  'aabbaaabbbbaaaaa',
  'oabbaaabbccbbaao',
  'aabbcbabcccbbbaa',
  'abbccbaabcbbaaab',
  'aabbbbaaaabbbbaa',
  'aabbbbaaaabbbbaa',
];

const waterA: Grid = [
  'ssssssssssssssss',
  'ssssssssttssssss',
  'sstttsssssssssss',
  'ssssssssssssrrss',
  'ssssrrssssssssss',
  'ssssssssstttssss',
  'sttsssssssssssss',
  'ssssssssssssssss',
  'ssssssttssssssss',
  'ssssssssssssstss',
  'ssrrssssssssssss',
  'sssssssssttsssss',
  'sssttsssssssssss',
  'sssssssssssrrsss',
  'ssssssssssssssss',
  'ssssssssssssssss',
];

const waterB: Grid = [
  'ssssssssssssssss',
  'sssssssssttsssss',
  'ssstttssssssssss',
  'sssssssssssssrrs',
  'sssssrrsssssssss',
  'sssssssssstttsss',
  'ssttssssssssssss',
  'ssssssssssssssss',
  'sssssssttsssssss',
  'ssssssssssssssts',
  'sssrrsssssssssss',
  'ssssssssssttssss',
  'ssssttssssssssss',
  'ssssssssssssrrss',
  'ssssssssssssssss',
  'ssssssssssssssss',
];

const sand: Grid = [
  'xxxxxxxxxxxxxxxx',
  'xxxyxxxxxxxxxxxx',
  'xxxxxxxxxxwxxxxx',
  'xxxxwxxxxxxxxxxx',
  'xxxxxxxxxxxxxyxx',
  'xyxxxxxxxxxxxxxx',
  'xxxxxxxxwxxxxxxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxyxxxxxxxxxx',
  'xxxxxxxxxxxxxwxx',
  'xxwxxxxxxxxxxxxx',
  'xxxxxxxxxyxxxxxx',
  'xxxxxxwxxxxxxxxx',
  'xxxxxxxxxxxxxyxx',
  'xxxxxxxxxxxxxxxx',
  'xxxxxxxxxxxxxxxx',
];

const path: Grid = [
  'wwwwwwwwwwwwwwww',
  'wwwvwwwwwwxwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwxwwwwwwwvwww',
  'wvwwwwwwwwwwwwww',
  'wwwwwwwvwwwwwwww',
  'wwwwwwwwwwxwwwww',
  'wwxwwwwwwwwwwwww',
  'wwwwwwwwwwwwwvww',
  'wwwwwxwwwwwwwwww',
  'wwwwwwwwwvwwwwww',
  'wwwvwwwwwwwwxwww',
  'wwwwwwxwwwwwwwww',
  'wwwwwwwwwwwwvwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
];

const cobble: Grid = [
  'gggggggggggggggg',
  'gGGGGggGGGGGGGGg',
  'gGHHGggGHHHHHGGg',
  'gGGGGggGGGGGGGGg',
  'gggggggggggggggg',
  'gGGGGGGggGGGGGGg',
  'gGHHHGGggGHHHGGg',
  'gGGGGGGggGGGGGGg',
  'gggggggggggggggg',
  'gGGGGGggGGGGGGGg',
  'gGHHGGggGHHHHGGg',
  'gGGGGGggGGGGGGGg',
  'gggggggggggggggg',
  'gGGGGGGGggGGGGGg',
  'gggggggggggggggg',
  'gggggggggggggggg',
];

const ruinFloor: Grid = [
  'gggggggggggggggg',
  'gGGGGGGggGGGGGGg',
  'gGGGGGGggGGGGGGg',
  'gGGdGGGggGGGGGGg',
  'gGGgdggggGGGbGGg',
  'gGGGdGGggGGGGGGg',
  'ggggdggggggggggg',
  'gGGGddGggGGGGGGg',
  'gGGGGdGggGGGGdGg',
  'gGbGGdGggGGGdGGg',
  'gggggggggggdgggg',
  'gGGGGGGggGddGGGg',
  'gGGGGGGggGdGGGGg',
  'gGGGGGGggGGGGGGg',
  'gggggggggggggggg',
  'gggggggggggggggg',
];

const rubble: Grid = [
  '................',
  '................',
  '.....oooo.......',
  '..ooooGGGoo.....',
  '..ogGGHHGGo.....',
  '.ooGGGGoGGoooo..',
  '.ogGHGooogGGHGo.',
  '.oGGGGogGGGGGGo.',
  '.ooGGoogGHHGGoo.',
  '..oGooooGGGGo...',
  '..ogGGGGGGHGo...',
  '..oGGHHGGGGoo...',
  '..ooGGGGGoo.....',
  '....oooooo......',
  '................',
  '................',
];

const bridge: Grid = [
  'ssssrrrrssssssss',
  'sssssssssssttsss',
  'vvvvvvvvvvvvvvvv',
  'vxxvxxvxxvxxvxxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vwxvwxvwxvwxvwxv',
  'vvvvvvvvvvvvvvvv',
  'sssssssttsssssss',
  'ssrrssssssssssss',
];

const bridgeBroken: Grid = [
  'ssssrrrrssssssss',
  'sssssssssssttsss',
  'vvvvvvssssssssss',
  'vxxvxvssssssssss',
  'vwxvwvssssssssss',
  'vwxvwvssssssssss',
  'vwxvwvssssssssss',
  'vvvvvvssssssssss',
  'ssssssssssssssss',
  'ssssssssssvvvvvv',
  'ssssssssssvxxvxv',
  'ssssssssssvwxvwv',
  'ssssssssssvwxvwv',
  'ssssssssssvvvvvv',
  'sssssssttsssssss',
  'ssrrssssssssssss',
];

const herb: Grid = [
  '................',
  '................',
  '.........oo.....',
  '.....oo.obco....',
  '....obcoobco....',
  '....obcco.......',
  '.....ocbo.oo....',
  '..oo..oboobco...',
  '.obco.oboebco...',
  '.obccoobcco.....',
  '..ocbobcbo......',
  '....obcbo.......',
  '.....obo........',
  '.....owo........',
  '......o.........',
  '................',
];

const herbTea: Grid = [
  '................',
  '................',
  '.....tttt.......',
  '......tt........',
  '....ooooooo.....',
  '...oweeeeewo....',
  '...ovwwwwwwooo..',
  '...ovwwwwwwowo..',
  '...ovwwwwwwowo..',
  '...ovwwwwwwooo..',
  '....owwwwwo.....',
  '.....ooooo......',
  '................',
  '................',
  '................',
  '................',
];

const berryMash: Grid = [
  '................',
  '................',
  '................',
  '....oooooooo....',
  '...ovBBBBBCvo...',
  '...ovBCCBCCvo...',
  '...oovvvvvvoo...',
  '....owwwwwwo....',
  '....ovwwwwvo....',
  '.....ovvvvo.....',
  '......oooo......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const herbStew: Grid = [
  '................',
  '................',
  '................',
  '....oooooooo....',
  '...owbwbwbwwo...',
  '...owewwKLLwo...',
  '...oowwwwwwwoo..',
  '....ovvvvvvo....',
  '....owwwwwwo....',
  '.....ovvvvo.....',
  '......oooo......',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const mushroomSkewer: Grid = [
  '................',
  '................',
  '..oooo..........',
  '.ovxxvo.........',
  '.ovwwvo.........',
  '..ovvo.oooo.....',
  '...owoovxxvo....',
  '...owoovwwvo....',
  '....wo.ovvo.....',
  '....wo..owo.....',
  '....wo..owo.....',
  '.....wo.owo.....',
  '.....wowo.......',
  '......wo........',
  '......o.........',
  '................',
];

const potteryShard: Grid = [
  '................',
  '................',
  '....ooooooo.....',
  '...osssWWWo.....',
  '...osWWssso.....',
  '....osssWWo.....',
  '....oWWssso.....',
  '.....osssso.....',
  '.....osWWo......',
  '......osso......',
  '......osso......',
  '.......oo.......',
  '................',
  '................',
  '................',
  '................',
];

const oldCoin: Grid = [
  '................',
  '................',
  '......oooo......',
  '....ooFFFFoo....',
  '...oFIIIIIFo....',
  '..oFIIEEIIFo....',
  '..oFIEFEIIFo....',
  '..oFIEFEIIFo....',
  '..oFIIEEIIFo....',
  '..oFIIIIIFo.....',
  '...oFFIIFo......',
  '....ooooo.......',
  '................',
  '................',
  '................',
  '................',
];

const stoneIdol: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ogGGGGo.....',
  '....oGHoHGo.....',
  '....oGGGGGo.....',
  '.....oGgGo......',
  '....ooGGGoo.....',
  '...oGgGGGgGo....',
  '...oGGGGGGGo....',
  '...oGgGGGgGo....',
  '..ooGGGGGGGoo...',
  '..ogggggggggo...',
  '...ooooooooo....',
  '................',
  '................',
];

const stewScrap: Grid = [
  '................',
  '................',
  '....ooooooo.....',
  '...oyyyyyyyo....',
  '...oywwwyyyo....',
  '...oyyyyyyyo....',
  '...oyywwwwyo....',
  '...oyyyyyyyo....',
  '...oywwwyyyo....',
  '...oyyyyyyyo....',
  '...oyyyyyoo.....',
  '....ooyyyo......',
  '......ooo.......',
  '................',
  '................',
  '................',
];

const basket: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovwwwwvo....',
  '...ovoo..oovo...',
  '...owo....owo...',
  '..oooooooooooo..',
  '..ovwxwxwxwxvo..',
  '..owxwxwxwxwwo..',
  '..ovwxwxwxwxvo..',
  '...owxwxwxwo....',
  '...ovvvvvvvo....',
  '....oooooo......',
  '................',
  '................',
  '................',
];

const trowel: Grid = [
  '................',
  '..........oo....',
  '.........owwo...',
  '........owxwo...',
  '.......owxwo....',
  '......owxwo.....',
  '.....oowwo......',
  '....ogHHGo......',
  '...ogHHHGo......',
  '..ogGHHHGo......',
  '..oGGHHHGo......',
  '...oGGGGo.......',
  '....oGGo........',
  '.....oo.........',
  '................',
  '................',
];

const log: Grid = [
  '................',
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '.oxwwwwwwwwwwxo.',
  '.ovwwwvwwwvwxyxo',
  '.ovvwvvvwvvwxwxo',
  '.ovvvvvvvvvvxyxo',
  '.ouvuvvvuvvvxxxo',
  '.oouuuuuuuuuuoo.',
  '...oooooooooo...',
  '................',
  '................',
  '................',
  '................',
];

const axe: Grid = [
  '.....oooo.oo....',
  '....oHHHGoxwo...',
  '...oHWHHGGGxwo..',
  '..oHWHHHGGGgxwo.',
  '..oHWHHHGGGgxwo.',
  '..oHHHHHGGggxwo.',
  '...oHHHHGggoxwo.',
  '....oHHGggoxwo..',
  '.....ooooooxwo..',
  '.........oxwo...',
  '.........oxwo...',
  '........oxwo....',
  '........oxwo....',
  '.......oxwo.....',
  '.......oxwo.....',
  '........oo......',
];

const sapling: Grid = [
  '................',
  '................',
  '................',
  '.......oo.......',
  '......offo......',
  '.....ofeeco.....',
  '...ooeoecocoo...',
  '..ofeeoecoecco..',
  '..oeecoovoccbo..',
  '...ocbocvcobo...',
  '....oobecboo....',
  '......ovwo......',
  '......ovwo......',
  '......ovwo......',
  '.....ouvwuo.....',
  '......oooo......',
];

const youngTree: Grid = [
  '................',
  '......oooo......',
  '....oofffeoo....',
  '...offffeeeeo...',
  '..offfeeefecco..',
  '.offfeeeeeeccco.',
  '.offecceeccccco.',
  'ofeeeeeccccbcbbo',
  'oeeeeeccbbcbbbbo',
  'oeeebbccccbbbbao',
  '.oeccccccbabbao.',
  '.occcccabbbbaao.',
  '..occcbvvbaaao..',
  '...ocbbwuaaao...',
  '....oobwvaoo....',
  '......owvo......',
  '......owvo......',
  '......owvo......',
  '......owvo......',
  '......owvo......',
  '......owvo......',
  '.....owwvvo.....',
  '....ouwwvvuo....',
  '.....oooooo.....',
];

const herbPlant: Grid = [
  '................',
  '......W.........',
  '.....WIW..W.....',
  '......W..WIW....',
  '...oo......W....',
  '..obco..oo......',
  '..obccoobco.oo..',
  '...obcobccoobco.',
  '.oo.obcobcobcco.',
  'obco.obcobcobo..',
  'obccobccobcbo...',
  '.obcobcobcbo....',
  '..oobcobcoo.....',
  '....obobbo......',
  '.....oooo.......',
  '................',
];

const bushEmpty: Grid = [
  '................',
  '.....oooooo.....',
  '...oobbbcbboo...',
  '..obbbcccccbbbo.',
  '.obccecccbccbbo.',
  '.obccccccccccbo.',
  'obbbcccccecccbbo',
  'obccccccccccccbo',
  'obccecccccbcccbo',
  'obccccccccccccbo',
  '.obcccccecccbbo.',
  '.obbbcccccccbbo.',
  '..oobbbccbbboo..',
  '....ooobooo.....',
  '.......o........',
  '................',
];

const campfireUnlit: Grid = [
  '................',
  '................',
  '................',
  '.....oggggo.....',
  '...oogGHHGgoo...',
  '..ogGoggggoGgo..',
  '..oGGoovvooGGo..',
  '.ogHGoovvvoGHgo.',
  '.ogGGoovvooGGgo.',
  '..oGGoovvvoGGo..',
  '..ogGoggggoGgo..',
  '...oogGHHGgoo...',
  '.....oggggo.....',
  '................',
  '................',
  '................',
];

const sign: Grid = [
  '................',
  '..oooooooooooo..',
  '.ovxxxxxxxxxxvo.',
  '.ovxwwwwwwwwxvo.',
  '.ovxwwwwwwwwxvo.',
  '.ovxwwwwwwwwxvo.',
  '.ovxxxxxxxxxxvo.',
  '..oooooooooooo..',
  '......ovvo......',
  '......owwo......',
  '......owwo......',
  '......owwo......',
  '.....oovvoo.....',
  '....oooooooo....',
  '................',
  '................',
];

const marketStall: Grid = [
  '................................',
  '................................',
  '....oooooooooooooooooooooooo....',
  '...oBBBBWWWWBBBBWWWWBBBBWWWWo...',
  '..oBCCCCWWWWCCCCWWWWCCCCWWWWBo..',
  '..oBCCCCWWWWCCCCWWWWCCCCWWWWBo..',
  '..oBBBBWWWWBBBBWWWWBBBBWWWWBBo..',
  '..oooooooooooooooooooooooooooo..',
  '..ovvvvvvvvvvvvvvvvvvvvvvvvvvo..',
  '..owxxxxxxxxxxxxxxxxxxxxxxxxwo..',
  '..ovvvvvvvvvvvvvvvvvvvvvvvvvvo..',
  '...ovvo................ovvo.....',
  '...owwo................owwo.....',
  '...owwo................owwo.....',
  '...owwo................owwo.....',
  '...owwo................owwo.....',
  '...owwo...oooooooooo...owwo.....',
  '...owwo..ovwwwwwwvvo..owwo......',
  '...owwo..owxwxwxwwwo..owwo......',
  '...owwo..ovwxwxwvvvo..owwo......',
  '...owwo..oooooooooo...owwo......',
  '...owwo....oooooo.....owwo......',
  '...owwo...ovxxxxvo....owwo......',
  '...owwo...owwwwwwo....owwo......',
  '...owwo...owxwxwwo....owwo......',
  '...owwo...ovvvvvvo....owwo......',
  '...owwo...oooooooo....owwo......',
  '...owwo................owwo.....',
  '..oovvoo..............oovvoo....',
  '..oooooo..............oooooo....',
  '................................',
  '................................',
];

const ruinPillar: Grid = [
  '................',
  '................',
  '....oooo........',
  '...ogHGGooo.....',
  '..ogGGGGGGo.....',
  '..oGGGdGGGo.....',
  '..oGGdGGGGo.....',
  '...ooGGGoo......',
  '....oGGGo.......',
  '....oGHGo.......',
  '....oGGGo.......',
  '....oGGGo.......',
  '....oGbGo.......',
  '....oGGGo.......',
  '....oGGGo.......',
  '....oGdGo.......',
  '....odGGo.......',
  '....oGGGo.......',
  '....oGHGo.......',
  '....oGGGo.......',
  '....oGbGo.......',
  '....oGbGo.......',
  '....oGGGo.......',
  '....oGGGo.......',
  '...ooGGGoo......',
  '..oGGGGGGGo.....',
  '..oGHHGGHGo.....',
  '..oGGGGGGGo.....',
  '.oGGGGGGGGGo....',
  '.ooooooooooo....',
  '................',
  '................',
];

const fog: Grid = [
  '................................',
  '................................',
  '................................',
  '............GGHHHHG.............',
  '.........GGHHWWWWWWHHG..........',
  '.......GHHWWWWWWWWWWWWHG........',
  '......GHHWWWWWWWWWWWWWHHG.......',
  '.....GHWWWWWWWWWWWWWWWWWHG......',
  '....GHHWWWWWWWWWWWWWWWWWWHHG....',
  '...GHWWWWWWWWWWWWWWWWWWWWWWHG...',
  '...GWWWWWWWWWWWWWWWWWWWWWWWWHG..',
  '..GHWWWWWWWWWWWWWWWWWWWWWWWWWHG.',
  '..GWWWWWWWWWWWWWWWWWWWWWWWWWWWG.',
  '.GHWWWWWWWWWWWWWWWWWWWWWWWWWWWHG',
  '.GWWWWWWWWWWWWWWWWWWWWWWWWWWWWWG',
  '.GWWWWWWWWWWWWWWWWWWWWWWWWWWWWWG',
  '.GWWWWWWWWWWWWWWWWWWWWWWWWWWWWWG',
  '.GHWWWWWWWWWWWWWWWWWWWWWWWWWWWHG',
  '..GWWWWWWWWWWWWWWWWWWWWWWWWWWWG.',
  '..GHWWWWWWWWWWWWWWWWWWWWWWWWWHG.',
  '...GWWWWWWWWWWWWWWWWWWWWWWWWWG..',
  '...GHWWWWWWWWWWWWWWWWWWWWWWWHG..',
  '....GHHWWWWWWWWWWWWWWWWWWHHG....',
  '.....GHWWWWWWWWWWWWWWWWWHG......',
  '......GHHWWWWWWWWWWWWWHHG.......',
  '.......GHHWWWWWWWWWWHHG.........',
  '.........GGHHWWWWWHHG...........',
  '............GGHHHHG.............',
  '................................',
  '................................',
  '................................',
  '................................',
];

const digSpot: Grid = [
  '................',
  '................',
  '................',
  '.....vvvvv......',
  '...vvwwvvwvv....',
  '..vwwvvvwvvvv...',
  '..vvwvvvvvvwvv..',
  '.vvvGvvvvwvvvv..',
  '.vvvwvvvvvvvvv..',
  '..vvvvvwvvGvv...',
  '..vGvvvvvvvvv...',
  '...vvvwvvvv.....',
  '.....vvvv.......',
  '................',
  '................',
  '................',
];

const chest: Grid = [
  '................',
  '................',
  '....oooooooo....',
  '...ovxxxxxxvo...',
  '..ovxwwwwwwxvo..',
  '..owwwGwwGwwwo..',
  '..ovvvvvvvvvvo..',
  '..owwwGwwGwwwo..',
  '..owwwGHHGwwwo..',
  '..owwwGggGwwwo..',
  '..ovvvGggGvvvo..',
  '..oooooooooooo..',
  '...oo......oo...',
  '................',
  '................',
  '................',
];

const shelf: Grid = [
  '................',
  '..oooooooooooo..',
  '.ovxxxxxxxxxxvo.',
  '.ovwwwwwwwwwwvo.',
  '..oooooooooooo..',
  '..owo..oo..owo..',
  '..owo.oFFo.owo..',
  '..owo.oIIo.owo..',
  '..oooooooooooo..',
  '..owo.oNNo.owo..',
  '..owo.oNNo.owo..',
  '..owo..oo..owo..',
  '..oooooooooooo..',
  '.ooo........ooo.',
  '................',
  '................',
];

const playerDownA: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovvvvwvo....',
  '...ovwwwwwwvo...',
  '...owwwvwwwwwo..',
  '...owvLLLLvwo...',
  '...ovLKoKLKvo...',
  '....oLLLLLLo....',
  '....oLLKLLLo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obcecccbbo...',
  '...obcwccebo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....ovv.oddo....',
  '....ovvo.oddo...',
  '....ovvo.ovvo...',
  '....ooo..ovvo...',
  '.........oooo...',
];

const playerDownStand: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovvvvwvo....',
  '...ovwwwwwwvo...',
  '...owwwvwwwwwo..',
  '...owvLLLLvwo...',
  '...ovLKoKLKvo...',
  '....oLLLLLLo....',
  '....oLLKLLLo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obcecccbbo...',
  '...obcwccebo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddoddo.....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....oooooooo....',
];

const playerDownB: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovvvvwvo....',
  '...ovwwwwwwvo...',
  '...owwwvwwwwwo..',
  '...owvLLLLvwo...',
  '...ovLKoKLKvo...',
  '....oLLLLLLo....',
  '....oLLKLLLo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obcecccbbo...',
  '...obcwccebo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddo.vvo....',
  '...oddo.ovvo....',
  '...ovvo.ovvo....',
  '...ovvo..ooo....',
  '...oooo.........',
];

const playerUpA: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovwwvvvo....',
  '...ovwwwwwwvo...',
  '...owwwwwwwwwo..',
  '...owwvwwvwwwo..',
  '...ovwwwwwwvo...',
  '....ovwwwwvo....',
  '....ovvvvvvo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obbcccebo....',
  '...obcwcccbo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....ovv.oddo....',
  '....ovvo.oddo...',
  '....ovvo.ovvo...',
  '....ooo..ovvo...',
  '.........oooo...',
];

const playerUpStand: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovwwvvvo....',
  '...ovwwwwwwvo...',
  '...owwwwwwwwwo..',
  '...owwvwwvwwwo..',
  '...ovwwwwwwvo...',
  '....ovwwwwvo....',
  '....ovvvvvvo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obbcccebo....',
  '...obcwcccbo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddoddo.....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....oooooooo....',
];

const playerUpB: Grid = [
  '................',
  '................',
  '.....oooooo.....',
  '....ovwwvvvo....',
  '...ovwwwwwwvo...',
  '...owwwwwwwwwo..',
  '...owwvwwvwwwo..',
  '...ovwwwwwwvo...',
  '....ovwwwwvo....',
  '....ovvvvvvo....',
  '.....oooooo.....',
  '....oobccboo....',
  '...obbcccebo....',
  '...obcwcccbo....',
  '...obccwccbo....',
  '....occccbo.....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddo.vvo....',
  '...oddo.ovvo....',
  '...ovvo.ovvo....',
  '...ovvo..ooo....',
  '...oooo.........',
];

const playerLeftA: Grid = [
  '................',
  '................',
  '.....ooooo......',
  '....ovvvvvo.....',
  '...ovwwwwwwo....',
  '...owwwwwwwo....',
  '...owwwvLLLo....',
  '...ovwLKLo......',
  '....oLLLLLo.....',
  '....oLLLLo......',
  '.....oooo.......',
  '....oobccbo.....',
  '...obceccbo.....',
  '...obcwccboo....',
  '...obccccoKo....',
  '....occcboKo....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....ovv.oddo....',
  '....ovvo.oddo...',
  '....ovvo.ovvo...',
  '....ooo..ovvo...',
  '.........oooo...',
];

const playerLeftStand: Grid = [
  '................',
  '................',
  '.....ooooo......',
  '....ovvvvvo.....',
  '...ovwwwwwwo....',
  '...owwwwwwwo....',
  '...owwwvLLLo....',
  '...ovwLKLo......',
  '....oLLLLLo.....',
  '....oLLLLo......',
  '.....oooo.......',
  '....oobccbo.....',
  '...obceccbo.....',
  '...obcwccboo....',
  '...obccccoKo....',
  '....occcboKo....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddoddo.....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....ovvoovvo....',
  '....oooooooo....',
];

const playerLeftB: Grid = [
  '................',
  '................',
  '.....ooooo......',
  '....ovvvvvo.....',
  '...ovwwwwwwo....',
  '...owwwwwwwo....',
  '...owwwvLLLo....',
  '...ovwLKLo......',
  '....oLLLLLo.....',
  '....oLLLLo......',
  '.....oooo.......',
  '....oobccbo.....',
  '...obceccbo.....',
  '...obcwccboo....',
  '...obccccoKo....',
  '....occcboKo....',
  '....obdddbo.....',
  '....oddddbo.....',
  '....oddoddo.....',
  '....oddo.vvo....',
  '...oddo.ovvo....',
  '...ovvo.ovvo....',
  '...ovvo..ooo....',
  '...oooo.........',
];

const elder: Grid = [
  '................',
  '.....oooooo.....',
  '....oWWWWWWo....',
  '....oWLLLLWo....',
  '....oLKoKLLo....',
  '....oLLLLLLo....',
  '.....oWWWWo.....',
  '....oWWWWWwo....',
  '....oWHWHWwo....',
  '...ooWWWWWwoo...',
  '..owoHWWWWHowo..',
  '..owoMNNNNMowo..',
  '..owoMNMNNMowo..',
  '..owoMNNMNMowo..',
  '..owwoMNNMoowo..',
  '..owwoMNNMoowo..',
  '..owwoMNNMoowo..',
  '..owwoMNNMoowo..',
  '..owwoMNNMoowo..',
  '..owwooMMooowo..',
  '..owwo.oddo.owo.',
  '..owwo.ovvo.owo.',
  '..oooo.oooo.ooo.',
  '................',
];

export const SKETCHES: readonly Sketch[] = [
  { name: 'grass', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [grass] },
  { name: 'grass_flowers', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [grassFlowers] },
  { name: 'grove', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [grove] },
  { name: 'forest', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [forest] },
  { name: 'water', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [waterA, waterB] },
  { name: 'sand', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [sand] },
  { name: 'path', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [path] },
  { name: 'cobble', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [cobble] },
  { name: 'ruin_floor', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [ruinFloor] },
  { name: 'rubble', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [rubble] },
  { name: 'bridge', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [bridge] },
  { name: 'bridge_broken', category: 'tiles', frameWidth: 16, frameHeight: 16, frames: [bridgeBroken] },
  { name: 'herb', category: 'items', frameWidth: 16, frameHeight: 16, frames: [herb] },
  { name: 'herb-tea', category: 'items', frameWidth: 16, frameHeight: 16, frames: [herbTea] },
  { name: 'berry-mash', category: 'items', frameWidth: 16, frameHeight: 16, frames: [berryMash] },
  { name: 'herb-stew', category: 'items', frameWidth: 16, frameHeight: 16, frames: [herbStew] },
  { name: 'mushroom-skewer', category: 'items', frameWidth: 16, frameHeight: 16, frames: [mushroomSkewer] },
  { name: 'pottery-shard', category: 'items', frameWidth: 16, frameHeight: 16, frames: [potteryShard] },
  { name: 'old-coin', category: 'items', frameWidth: 16, frameHeight: 16, frames: [oldCoin] },
  { name: 'stone-idol', category: 'items', frameWidth: 16, frameHeight: 16, frames: [stoneIdol] },
  { name: 'stew-scrap', category: 'items', frameWidth: 16, frameHeight: 16, frames: [stewScrap] },
  { name: 'basket', category: 'items', frameWidth: 16, frameHeight: 16, frames: [basket] },
  { name: 'trowel', category: 'items', frameWidth: 16, frameHeight: 16, frames: [trowel] },
  { name: 'log', category: 'items', frameWidth: 16, frameHeight: 16, frames: [log] },
  { name: 'axe', category: 'items', frameWidth: 16, frameHeight: 16, frames: [axe] },
  { name: 'herb_plant', category: 'props', frameWidth: 16, frameHeight: 16, frames: [herbPlant] },
  { name: 'bush_empty', category: 'props', frameWidth: 16, frameHeight: 16, frames: [bushEmpty] },
  { name: 'campfire_unlit', category: 'props', frameWidth: 16, frameHeight: 16, frames: [campfireUnlit] },
  { name: 'sign', category: 'props', frameWidth: 16, frameHeight: 16, frames: [sign] },
  { name: 'market_stall', category: 'props', frameWidth: 32, frameHeight: 32, frames: [marketStall] },
  { name: 'ruin_pillar', category: 'props', frameWidth: 16, frameHeight: 32, frames: [ruinPillar] },
  { name: 'fog', category: 'props', frameWidth: 32, frameHeight: 32, frames: [fog] },
  { name: 'dig_spot', category: 'props', frameWidth: 16, frameHeight: 16, frames: [digSpot] },
  { name: 'chest', category: 'props', frameWidth: 16, frameHeight: 16, frames: [chest] },
  { name: 'sapling', category: 'props', frameWidth: 16, frameHeight: 16, frames: [sapling] },
  { name: 'young_tree', category: 'props', frameWidth: 16, frameHeight: 24, frames: [youngTree] },
  { name: 'shelf', category: 'props', frameWidth: 16, frameHeight: 16, frames: [shelf] },
  { name: 'player_down', category: 'chars', frameWidth: 16, frameHeight: 24, frames: [playerDownA, playerDownStand, playerDownB] },
  { name: 'player_up', category: 'chars', frameWidth: 16, frameHeight: 24, frames: [playerUpA, playerUpStand, playerUpB] },
  { name: 'player_left', category: 'chars', frameWidth: 16, frameHeight: 24, frames: [playerLeftA, playerLeftStand, playerLeftB] },
  { name: 'elder', category: 'chars', frameWidth: 16, frameHeight: 24, frames: [elder] },
];

function renderSketch(sketch: Sketch): PNG {
  const width = sketch.frameWidth * sketch.frames.length;
  const image = new PNG({ width, height: sketch.frameHeight });
  image.data.fill(0);

  for (let frameIndex = 0; frameIndex < sketch.frames.length; frameIndex += 1) {
    const frame = sketch.frames[frameIndex];
    if (frame === undefined || frame.length !== sketch.frameHeight) {
      throw new Error(`${sketch.name} frame ${frameIndex}: expected ${sketch.frameHeight} rows`);
    }
    for (let y = 0; y < frame.length; y += 1) {
      const row = frame[y];
      if (row === undefined || row.length !== sketch.frameWidth) {
        throw new Error(`${sketch.name} frame ${frameIndex}, row ${y}: expected ${sketch.frameWidth} columns, got ${row?.length ?? 0}`);
      }
      for (let x = 0; x < row.length; x += 1) {
        const symbol = row[x];
        if (symbol === '.') continue;
        const paletteIndex = symbol === undefined ? undefined : PALETTE_LEGEND[symbol];
        if (paletteIndex === undefined) {
          throw new Error(`${sketch.name} frame ${frameIndex}: unknown symbol ${JSON.stringify(symbol)}`);
        }
        const color = CORE_PALETTE[paletteIndex];
        if (color === undefined) throw new Error(`Palette index ${paletteIndex} does not exist`);
        const [r, g, b] = hexToRgb(color);
        const offset = (y * width + frameIndex * sketch.frameWidth + x) * 4;
        image.data[offset] = r;
        image.data[offset + 1] = g;
        image.data[offset + 2] = b;
        image.data[offset + 3] = 255;
      }
    }
  }
  return image;
}

const FONT: Readonly<Record<string, readonly string[]>> = {
  a: ['010', '101', '111', '101', '101'], b: ['110', '101', '110', '101', '110'],
  c: ['011', '100', '100', '100', '011'], d: ['110', '101', '101', '101', '110'],
  e: ['111', '100', '110', '100', '111'], f: ['111', '100', '110', '100', '100'],
  g: ['011', '100', '101', '101', '011'], h: ['101', '101', '111', '101', '101'],
  i: ['111', '010', '010', '010', '111'], j: ['001', '001', '001', '101', '010'],
  k: ['101', '101', '110', '101', '101'], l: ['100', '100', '100', '100', '111'],
  m: ['101', '111', '111', '101', '101'], n: ['101', '111', '111', '111', '101'],
  o: ['010', '101', '101', '101', '010'], p: ['110', '101', '110', '100', '100'],
  q: ['010', '101', '101', '111', '011'], r: ['110', '101', '110', '101', '101'],
  s: ['011', '100', '010', '001', '110'], t: ['111', '010', '010', '010', '010'],
  u: ['101', '101', '101', '101', '111'], v: ['101', '101', '101', '101', '010'],
  w: ['101', '101', '111', '111', '101'], x: ['101', '101', '010', '101', '101'],
  y: ['101', '101', '010', '010', '010'], z: ['111', '001', '010', '100', '111'],
  '-': ['000', '000', '111', '000', '000'], _: ['000', '000', '000', '000', '111'],
};

function setPalettePixel(image: PNG, x: number, y: number, paletteIndex: number): void {
  const color = CORE_PALETTE[paletteIndex];
  if (color === undefined || x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const [r, g, b] = hexToRgb(color);
  const offset = (y * image.width + x) * 4;
  image.data[offset] = r;
  image.data[offset + 1] = g;
  image.data[offset + 2] = b;
  image.data[offset + 3] = 255;
}

function fillPaletteRect(image: PNG, left: number, top: number, width: number, height: number, paletteIndex: number): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) setPalettePixel(image, x, y, paletteIndex);
  }
}

function drawLabel(image: PNG, label: string, left: number, top: number, scale: number): void {
  let cursor = left;
  for (const character of label) {
    const glyph = FONT[character];
    if (glyph !== undefined) {
      for (let y = 0; y < glyph.length; y += 1) {
        const row = glyph[y] ?? '';
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] === '1') fillPaletteRect(image, cursor + x * scale, top + y * scale, scale, scale, 5);
        }
      }
    }
    cursor += 4 * scale;
  }
}

function renderContactSheet(rendered: readonly { sketch: Sketch; image: PNG }[]): PNG {
  const columns = 4;
  const cellWidth = 208;
  const cellHeight = 160;
  const rows = Math.ceil(rendered.length / columns);
  const sheet = new PNG({ width: columns * cellWidth, height: rows * cellHeight });
  fillPaletteRect(sheet, 0, 0, sheet.width, sheet.height, 0);

  for (let index = 0; index < rendered.length; index += 1) {
    const entry = rendered[index];
    if (entry === undefined) continue;
    const cellX = index % columns * cellWidth;
    const cellY = Math.floor(index / columns) * cellHeight;
    fillPaletteRect(sheet, cellX + 2, cellY + 2, cellWidth - 4, cellHeight - 4, 1);
    drawLabel(sheet, `${entry.sketch.category}/${entry.sketch.name}`, cellX + 8, cellY + 8, 2);

    const scale = 4;
    const targetWidth = entry.image.width * scale;
    const targetHeight = entry.image.height * scale;
    const startX = cellX + Math.floor((cellWidth - targetWidth) / 2);
    const startY = cellY + 28 + Math.floor((cellHeight - 34 - targetHeight) / 2);
    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        const sourceOffset = (Math.floor(y / scale) * entry.image.width + Math.floor(x / scale)) * 4;
        if (entry.image.data[sourceOffset + 3] !== 255) continue;
        const targetOffset = ((startY + y) * sheet.width + startX + x) * 4;
        sheet.data[targetOffset] = entry.image.data[sourceOffset] ?? 0;
        sheet.data[targetOffset + 1] = entry.image.data[sourceOffset + 1] ?? 0;
        sheet.data[targetOffset + 2] = entry.image.data[sourceOffset + 2] ?? 0;
        sheet.data[targetOffset + 3] = 255;
      }
    }
  }
  return sheet;
}

export function generateSketches(outputRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')): string[] {
  const written: string[] = [];
  const rendered = SKETCHES.map((sketch) => ({ sketch, image: renderSketch(sketch) }));
  for (const entry of rendered) {
    const output = join(outputRoot, 'content', 'kit', 'core', entry.sketch.category, `${entry.sketch.name}.png`);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, PNG.sync.write(entry.image));
    written.push(output);
  }

  const sheetPath = join(outputRoot, 'tools', 'test', 'fixtures', 'kit', 'out', 'sketches-sheet.png');
  mkdirSync(dirname(sheetPath), { recursive: true });
  writeFileSync(sheetPath, PNG.sync.write(renderContactSheet(rendered)));
  written.push(sheetPath);
  return written;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  const written = generateSketches();
  console.log(`Wrote ${written.length - 1} sprites and ${written.at(-1)}`);
}
