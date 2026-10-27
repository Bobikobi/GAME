/**
 * Just enough of the zip format to take two files out of a library archive: the central directory, stored and
 * deflated entries, each checked against its CRC. No zip64, no encryption (the libraries need neither).
 */
import { crc32, inflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The entries listed in the archive's central directory. */
export function zipEntries(buf: Buffer): ZipEntry[] {
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error('not a zip archive (no end of central directory)');
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(at) !== CENTRAL) throw new Error(`broken central directory at ${at}`);
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    const entry: ZipEntry = {
      method: buf.readUInt16LE(at + 10),
      crc: buf.readUInt32LE(at + 16),
      compressedSize: buf.readUInt32LE(at + 20),
      size: buf.readUInt32LE(at + 24),
      offset: buf.readUInt32LE(at + 42),
      name: buf.toString('utf8', at + 46, at + 46 + nameLen),
    };
    if (entry.size === 0xffffffff || entry.offset === 0xffffffff) throw new Error(`${entry.name}: zip64 entries are not read`);
    entries.push(entry);
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** One entry's bytes, inflated and checked. */
export function zipRead(buf: Buffer, entry: ZipEntry): Buffer {
  if (buf.readUInt32LE(entry.offset) !== LOCAL) throw new Error(`${entry.name}: no local header at ${entry.offset}`);
  const start = entry.offset + 30 + buf.readUInt16LE(entry.offset + 26) + buf.readUInt16LE(entry.offset + 28);
  const raw = buf.subarray(start, start + entry.compressedSize);
  let data: Buffer;
  if (entry.method === 0) data = Buffer.from(raw);
  else if (entry.method === 8) data = inflateRawSync(raw);
  else throw new Error(`${entry.name}: compression method ${entry.method} is not read`);
  if (data.length !== entry.size) throw new Error(`${entry.name}: ${data.length} bytes, the directory says ${entry.size}`);
  if (crc32(data) >>> 0 !== entry.crc >>> 0) throw new Error(`${entry.name}: CRC does not match`);
  return data;
}

/** The entry with exactly this name. */
export function zipFile(buf: Buffer, name: string): Buffer {
  const entry = zipEntries(buf).find((e) => e.name === name);
  if (entry === undefined) throw new Error(`the archive has no ${name}`);
  return zipRead(buf, entry);
}
