import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { decodeFrames } from '../assets/diffusion/data.js';
import { Replay, MotionPlayer, IdleCamera } from '../assets/diffusion/motion.js';

const root = new URL('../assets/diffusion/data/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
const data = {};
for (const [name, asset] of Object.entries(manifest.assets)) {
  const raw = gunzipSync(await readFile(new URL(asset.file, root)));
  data[name] = await decodeFrames(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  assert.ok(data[name].frames.every(Number.isFinite));
  assert.ok(asset.max_coordinate_error < 0.0002);
}
await assert.rejects(decodeFrames(new ArrayBuffer(12)), /Invalid diffusion data/);
const initial = data.initial.frames;
const replays = ['forward', 'training', 'reverse_0', 'reverse_1', 'reverse_2'].map(name => {
  const mode = name.startsWith('reverse') ? 'reverse' : name;
  return new Replay(data[name].frames, 5200, { forward: 7, training: 18, reverse: 9 }[mode], mode);
});
const copy = state => ({ ...state, points: state.points.slice(), velocity: state.velocity.slice() });
const difference = (a, b) => a.reduce((max, value, i) => Math.max(max, Math.abs(value - b[i])), 0);
const meanRadius = frame => {
  let sum = 0;
  for (let i = 0; i < frame.length; i += 3) sum += Math.hypot(frame[i], frame[i + 1], frame[i + 2]);
  return sum / (frame.length / 3);
};
assert.ok(Math.abs(meanRadius(initial) - 3) < 0.001);
for (const replay of replays) {
  const end = copy(replay.evaluate(replay.duration));
  assert.equal(difference(end.points, replay.frames.subarray(-initial.length)), 0);
  assert.ok(end.velocity.every(value => value === 0));
  if (replay.mode !== 'forward') assert.ok(Math.abs(meanRadius(end.points) - 3) < 0.12);
  const middle = copy(replay.evaluate(replay.duration * 0.47));
  const left = copy(replay.evaluate(replay.duration * 0.47 - 0.001));
  const right = copy(replay.evaluate(replay.duration * 0.47 + 0.001));
  const estimate = right.points.map((value, i) => (value - left.points[i]) / 0.002);
  assert.ok(difference(middle.velocity, estimate) < 0.04);
}
for (const first of replays) {
  for (const second of replays) {
    const player = new MotionPlayer(initial, 0);
    player.start(first.mode, first, 0);
    const before = copy(player.evaluate(2.13));
    player.start(second.mode, second, 2.13);
    const after = copy(player.evaluate(2.13));
    assert.ok(difference(before.points, after.points) < 1e-6);
    assert.ok(difference(before.velocity, after.velocity) < 1e-6);
    assert.equal(before.surface, after.surface);
    player.toggle(2.44);
    const paused = copy(player.evaluate(3));
    assert.equal(difference(paused.points, player.evaluate(4).points), 0);
    assert.ok(paused.velocity.every(value => value === 0));
    player.reset(4);
    const reset = player.evaluate(6);
    assert.equal(difference(initial, reset.points), 0);
    assert.ok(reset.finished);
  }
}
const camera = new IdleCamera(0);
camera.update(5, true);
assert.equal(camera.mode, 'orbit');
assert.equal(camera.velocity[0], 0);
camera.update(5.2, true);
assert.ok(camera.velocity[0] > 0 && camera.velocity[0] < 0.09);
const view = [...camera.position], velocity = [...camera.velocity];
camera.interrupt(5.2);
assert.equal(difference(view, camera.sample(5.2)), 0);
assert.equal(difference(velocity, camera.velocity), 0);
camera.move([Math.PI * 4 + 0.7, -0.8, 0.4], 6);
camera.recenter(6, false);
assert.ok(Math.abs(camera.target[0] - camera.origin[0]) <= Math.PI);
camera.sample(8);
assert.ok(Math.abs(Math.sin(camera.position[0] - camera.home[0])) < 1e-12);
assert.equal(camera.position[1], camera.home[1]);
assert.equal(camera.position[2], 0);
const player = new MotionPlayer(initial, 0);
player.start('training', replays[1], 0);
const start = performance.now();
for (let i = 0; i < 1000; i++) player.evaluate(i / 60);
console.log(JSON.stringify({ assets: Object.keys(data).length, transitions: 25, pauseResumeReset: true, trainingRadius: meanRadius(replays[1].evaluate(18).points), millisecondsPerFrame: (performance.now() - start) / 1000 }, null, 2));
