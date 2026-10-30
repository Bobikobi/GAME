/**
 * A country database in MaxMind's file format, built in memory for the tests: a binary search tree over the
 * address bits, a data section of `{ country: { iso_code } }` records, and the metadata map at the end.
 * It is an IPv6 tree (ip_version 6) with the IPv4 networks under `::/96`, as DB-IP's own file is laid out,
 * with 24-bit records. Nothing here is DB-IP's data: the networks are the documentation ranges of RFC 5737
 * and RFC 3849, and the countries are the test's own.
 */

export interface Network {
  /** `a.b.c.d/len` or an IPv6 network such as `2001:db8::/32` */
  network: string;
  /** the code the record carries; the tests also use one that names no place */
  country: string;
}

/** the documentation ranges stand in for real networks; 203.0.113.0/24 carries a code that names no place */
export const FIXTURE: Network[] = [
  { network: '192.0.2.0/24', country: 'IL' },
  { network: '198.51.100.0/24', country: 'DE' },
  { network: '203.0.113.0/24', country: 'ZZ' },
  { network: '2001:db8::/32', country: 'FR' },
];

type Child = { node: number } | { data: number } | undefined;

function bitsOf(bytes: number[], length: number): number[] {
  return Array.from({ length }, (_, i) => (bytes[i >> 3]! >> (7 - (i & 7))) & 1);
}

function v4Bytes(text: string): number[] {
  return text.split('.').map(Number);
}

function v6Bytes(text: string): number[] {
  const [head, tail] = text.split('::');
  const groups = (part: string | undefined) => (part ? part.split(':') : []);
  const left = groups(head);
  const right = tail === undefined ? [] : groups(tail);
  const all = [...left, ...Array<string>(8 - left.length - right.length).fill('0'), ...right];
  return all.flatMap((group) => [parseInt(group, 16) >> 8, parseInt(group, 16) & 255]);
}

/** The path a network takes through the tree, root to leaf. */
function pathOf(network: string): number[] {
  const [address, length] = network.split('/') as [string, string];
  return address.includes(':')
    ? bitsOf(v6Bytes(address), Number(length))
    : [...Array<number>(96).fill(0), ...bitsOf(v4Bytes(address), Number(length))];
}

const utf8 = (text: string) => {
  const bytes = [...Buffer.from(text, 'utf8')];
  if (bytes.length > 28) throw new Error('the fixture keeps its strings short');
  return [(2 << 5) | bytes.length, ...bytes];
};
const map = (size: number) => (7 << 5) | size;
const unsigned = (type: number, value: number) => {
  const bytes: number[] = [];
  for (let rest = value; rest > 0; rest = Math.floor(rest / 256)) bytes.unshift(rest % 256);
  return [(type << 5) | bytes.length, ...bytes];
};

function record(country: string): number[] {
  return [map(1), ...utf8('country'), map(1), ...utf8('iso_code'), ...utf8(country)];
}

export function buildCountryDb(networks: Network[]): Buffer {
  const nodes: Child[][] = [[undefined, undefined]];
  const records: number[][] = [];
  const offsets = new Map<string, number>();
  let dataSize = 0;
  for (const { network, country } of networks) {
    if (!offsets.has(country)) {
      offsets.set(country, dataSize);
      records.push(record(country));
      dataSize += record(country).length;
    }
    const path = pathOf(network);
    let at = 0;
    path.forEach((bit, i) => {
      if (i === path.length - 1) {
        nodes[at]![bit] = { data: offsets.get(country)! };
        return;
      }
      let next = nodes[at]![bit];
      if (next === undefined || !('node' in next)) {
        nodes.push([undefined, undefined]);
        next = { node: nodes.length - 1 };
        nodes[at]![bit] = next;
      }
      at = next.node;
    });
  }
  const nodeCount = nodes.length;
  const value = (child: Child) => (child === undefined ? nodeCount : 'node' in child ? child.node : nodeCount + 16 + child.data);
  const tree = nodes.flatMap(([left, right]) => {
    const [l, r] = [value(left), value(right)];
    return [(l >> 16) & 255, (l >> 8) & 255, l & 255, (r >> 16) & 255, (r >> 8) & 255, r & 255];
  });
  const metadata = [
    map(8),
    ...utf8('binary_format_major_version'), ...unsigned(5, 2),
    ...utf8('binary_format_minor_version'), ...unsigned(5, 0),
    ...utf8('build_epoch'), 0x02, 0x02, 0x65, 0xe8, // uint64 (extended type 9): 0x65e8
    ...utf8('database_type'), ...utf8('Fixture-Country'),
    ...utf8('description'), map(1), ...utf8('en'), ...utf8('a fixture'),
    ...utf8('ip_version'), ...unsigned(5, 6),
    ...utf8('node_count'), ...unsigned(6, nodeCount),
    ...utf8('record_size'), ...unsigned(5, 24),
  ];
  return Buffer.from([...tree, ...Array<number>(16).fill(0), ...records.flat(), 0xab, 0xcd, 0xef, ...Buffer.from('MaxMind.com'), ...metadata]);
}
