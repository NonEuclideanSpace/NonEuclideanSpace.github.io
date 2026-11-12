import { clamp, Replay, MotionPlayer, IdleCamera } from './motion.js';
import { DotRenderer } from './renderer.js?v=2';
import { loadFrames } from './data.js';

const canvas = document.querySelector('#diffusion-canvas');
const controls = [...document.querySelectorAll('.diffusion-controls button')];
const status = document.querySelector('#diffusion-status');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const durations = { forward: 7, training: 18, reverse: 9 };
const replays = new Map();
const pointers = new Map();
let player, camera, renderer;
let reverseIndex = 0, request = 0, animation = 0, hiddenAt = null, hiddenTotal = 0;
let previousTime = 0, wasFinished = false, dirty = true;
let previousCamera = [NaN, NaN, NaN];

const now = () => ((hiddenAt ?? performance.now()) - hiddenTotal) / 1000;
const announce = text => { status.textContent = text; };
const nameFor = mode => mode === 'reverse' ? `reverse-${reverseIndex}` : mode;

function getReplay(mode) {
  const name = nameFor(mode);
  if (!replays.has(name)) {
    const replay = loadFrames(name).then(data => new Replay(data.frames, data.count, durations[mode], mode));
    replays.set(name, replay);
    replay.catch(() => replays.delete(name));
  }
  return replays.get(name);
}

function clearBusy() {
  for (const button of controls) button.removeAttribute('aria-busy');
}

async function activate(mode) {
  if (!player) return;
  const id = ++request;
  clearBusy();
  announce('');
  const time = now();
  camera.interrupt(time);
  if (mode === 'reset') {
    player.reset(time);
    camera.recenter(time, false);
    dirty = true;
    return;
  }
  if (mode === player.mode && !player.evaluate(time).finished) {
    player.toggle(time);
    dirty = true;
    return;
  }
  const button = controls.find(item => item.dataset.mode === mode);
  button.setAttribute('aria-busy', 'true');
  const notice = setTimeout(() => { if (id === request) announce('Loading…'); }, 180);
  try {
    const replay = await getReplay(mode);
    if (id !== request) return;
    const start = now();
    camera.interrupt(start);
    player.start(mode, replay, start);
    if (mode === 'reverse') reverseIndex = (reverseIndex + 1) % 3;
    dirty = true;
    announce('');
  } catch {
    if (id === request) announce('Could not load. Select again to retry.');
  } finally {
    clearTimeout(notice);
    if (id === request) clearBusy();
  }
}

function tick() {
  animation = 0;
  if (!player || document.hidden || renderer.gl.isContextLost()) return;
  const time = now();
  const delta = Math.min(0.1, Math.max(0, time - previousTime));
  previousTime = time;
  const state = player.evaluate(time);
  if (state.finished && !wasFinished) camera.holdUntil = time + 5;
  const view = camera.update(time, !state.active && !pointers.size && !reducedMotion.matches);
  if (dirty || state.active || (state.finished !== wasFinished) || view.some((v, i) => v !== previousCamera[i])) {
    renderer.render(state.points, view, state.surface);
    previousCamera = [...view];
    dirty = false;
  }
  wasFinished = state.finished;
  for (const button of controls) {
    const mode = button.dataset.mode;
    const selected = mode === player.mode;
    const resetting = mode === 'reset' && player.mode === 'home' && (!state.finished || camera.mode === 'return');
    const active = selected || resetting;
    const target = selected ? state.progress : resetting ? clamp((time - camera.started) / camera.returnDuration) : 0;
    button.progress = (button.progress || 0) + (target - (button.progress || 0)) * (1 - Math.exp(-delta / 0.07));
    button.style.setProperty('--progress', button.progress.toFixed(4));
    if (button.dataset.active !== String(active)) button.dataset.active = String(active);
    if (mode !== 'reset') {
      const pressed = String(selected && !state.finished && player.clock.targetSpeed > 0);
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    }
  }
  animation = requestAnimationFrame(tick);
}

for (const button of controls) {
  button.addEventListener('click', () => activate(button.dataset.mode));
  const prepare = () => {
    if (player && button.dataset.mode !== 'reset') getReplay(button.dataset.mode).catch(() => {});
  };
  button.addEventListener('pointerenter', prepare);
  button.addEventListener('focus', prepare);
}

canvas.addEventListener('pointerdown', event => {
  if (!camera || (event.pointerType === 'mouse' && event.button !== 0)) return;
  pointers.set(event.pointerId, [event.clientX, event.clientY]);
  canvas.setPointerCapture(event.pointerId);
  camera.interrupt(now());
});

canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  const last = pointers.get(event.pointerId);
  const next = [event.clientX, event.clientY];
  if (pointers.size === 1) camera.move([(next[0] - last[0]) * 0.007, (next[1] - last[1]) * 0.007, 0], now());
  else {
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
    const before = Math.hypot(last[0] - other[0], last[1] - other[1]);
    const after = Math.hypot(next[0] - other[0], next[1] - other[1]);
    if (before > 0 && after > 0) camera.move([0, 0, Math.log(after / before)], now());
  }
  pointers.set(event.pointerId, next);
  dirty = true;
});

function endPointer(event) {
  if (pointers.delete(event.pointerId)) camera.interrupt(now());
}

for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, endPointer);
canvas.addEventListener('dblclick', () => activate('reset'));
canvas.addEventListener('wheel', event => {
  if (!camera) return;
  event.preventDefault();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
  camera.move([0, 0, clamp(-event.deltaY * units * 0.0015, -0.2, 0.2)], now());
  dirty = true;
}, { passive: false });

canvas.addEventListener('keydown', event => {
  if (!camera) return;
  const moves = { ArrowLeft: [-0.12, 0, 0], ArrowRight: [0.12, 0, 0], ArrowUp: [0, -0.12, 0], ArrowDown: [0, 0.12, 0], '+': [0, 0, 0.08], '=': [0, 0, 0.08], '-': [0, 0, -0.08] };
  if (moves[event.key]) camera.move(moves[event.key], now());
  else if (event.key === '0' || event.key === 'Home') activate('reset');
  else if (event.key === ' ' && player.mode && player.mode !== 'home') activate(player.mode);
  else return;
  event.preventDefault();
  dirty = true;
});

new ResizeObserver(() => { dirty = true; }).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    cancelAnimationFrame(animation);
    animation = 0;
    pointers.clear();
  } else {
    if (hiddenAt !== null) hiddenTotal += performance.now() - hiddenAt;
    hiddenAt = null;
    dirty = true;
    if (!animation && player) animation = requestAnimationFrame(tick);
  }
});

canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  cancelAnimationFrame(animation);
  animation = 0;
  if (player) player.clock.setSpeed(0, now());
  announce('Restoring the globe…');
});

canvas.addEventListener('webglcontextrestored', () => {
  renderer = new DotRenderer(canvas, player.initial.length / 3);
  dirty = true;
  announce('');
  if (!animation) animation = requestAnimationFrame(tick);
});

try {
  const data = await loadFrames('initial');
  renderer = new DotRenderer(canvas, data.count);
  player = new MotionPlayer(data.frames, now());
  camera = new IdleCamera(now());
  previousTime = now();
  for (const button of controls) button.disabled = false;
  announce('');
  animation = requestAnimationFrame(tick);
} catch (error) {
  announce(error.message.startsWith('This browser') ? error.message : 'Could not load the globe. Please reload to retry.');
}
