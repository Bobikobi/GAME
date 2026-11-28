/**
 * What the exporter bakes for a streamed land and the device would otherwise compute (S1, private #44): the helpers the mount reads it with.
 */

/** A zlib-deflated blob inflated by the browser's own stream (DecompressionStream 'deflate'), off the main thread: the bytes the exporter compressed. */
export async function inflateBlob(blob: Blob): Promise<Uint8Array> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
