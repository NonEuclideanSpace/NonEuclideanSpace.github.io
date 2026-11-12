export async function decodeFrames(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 12 || view.getUint32(0, true) !== 0x31464944) throw new Error('Invalid diffusion data');
  const length = view.getUint32(4, true), count = view.getUint32(8, true);
  if (!length || length > 1001 || count !== 5200 || view.byteLength !== 12 + length * (4 + count * 6)) {
    throw new Error('Incomplete diffusion data');
  }
  const frames = new Float32Array(length * count * 3);
  let offset = 12, destination = 0;
  for (let frame = 0; frame < length; frame++) {
    const scale = view.getFloat32(offset, true);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid diffusion scale');
    offset += 4;
    for (let i = 0; i < count * 3; i++, offset += 2) frames[destination++] = view.getInt16(offset, true) * scale;
    if (frame % 16 === 15) await new Promise(resolve => setTimeout(resolve, 0));
  }
  return { frames, count, length };
}

const downloads = new Map();

export function loadFrames(name) {
  if (!downloads.has(name)) {
    const download = (async () => {
      const response = await fetch(new URL(`./data/${name}.bin.gz`, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${name}`);
      let buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
        const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
        buffer = await new Response(stream).arrayBuffer();
      }
      return decodeFrames(buffer);
    })();
    downloads.set(name, download);
    download.catch(() => downloads.delete(name));
  }
  return downloads.get(name);
}
