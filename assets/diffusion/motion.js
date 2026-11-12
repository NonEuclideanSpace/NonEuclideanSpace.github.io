export const clamp = (x, low = 0, high = 1) => Math.max(low, Math.min(high, x));
const smooth = x => (x = clamp(x), x * x * (3 - 2 * x));
const ease = x => x ** 3 * (10 - 15 * x + 6 * x * x);
const integral = x => x ** 4 * (2.5 - 3 * x + x * x);

export class Replay {
  constructor(frames, count, duration, mode) {
    this.frames = frames;
    this.stride = count * 3;
    this.length = frames.length / this.stride;
    this.duration = duration;
    this.mode = mode;
    this.tangents = new Float32Array(frames.length);
    for (let i = this.stride; i < frames.length - this.stride; i++) {
      this.tangents[i] = 0.5 * (frames[i + this.stride] - frames[i - this.stride]);
    }
    this.state = {
      points: new Float32Array(this.stride), velocity: new Float32Array(this.stride),
      surface: 1, surfaceVelocity: 0, progress: 0, finished: false, active: false,
    };
  }

  evaluate(elapsed) {
    const progress = clamp(elapsed / this.duration);
    const position = progress * (this.length - 1);
    const index = Math.min(Math.floor(position), this.length - 2);
    const u = position - index;
    const u2 = u * u, u3 = u2 * u;
    const weights = [2 * u3 - 3 * u2 + 1, u3 - 2 * u2 + u, -2 * u3 + 3 * u2, u3 - u2];
    const derivatives = [6 * u2 - 6 * u, 3 * u2 - 4 * u + 1, -6 * u2 + 6 * u, 3 * u2 - 2 * u];
    const rate = elapsed <= 0 || elapsed >= this.duration ? 0 : (this.length - 1) / this.duration;
    const start = index * this.stride, end = start + this.stride;
    const { frames, tangents, state } = this;
    for (let i = 0; i < this.stride; i++) {
      const a = frames[start + i], b = tangents[start + i];
      const c = frames[end + i], d = tangents[end + i];
      state.points[i] = weights[0] * a + weights[1] * b + weights[2] * c + weights[3] * d;
      state.velocity[i] = rate * (derivatives[0] * a + derivatives[1] * b + derivatives[2] * c + derivatives[3] * d);
    }
    state.surfaceVelocity = 0;
    if (this.mode === 'forward') {
      const phase = clamp(progress / 0.15);
      state.surface = 1 - smooth(phase);
      state.surfaceVelocity = -6 * phase * (1 - phase) / (0.15 * this.duration);
    } else if (this.mode === 'reverse') {
      const phase = clamp((progress - 0.85) / 0.15);
      state.surface = smooth(phase);
      state.surfaceVelocity = 6 * phase * (1 - phase) / (0.15 * this.duration);
    } else {
      state.surface = 1;
    }
    if (rate === 0) state.surfaceVelocity = 0;
    state.progress = progress;
    return state;
  }
}

export class SmoothClock {
  constructor(now, speed = 1) {
    this.started = now;
    this.position = 0;
    this.initialSpeed = speed;
    this.targetSpeed = speed;
    this.duration = 0.32;
  }

  evaluate(now) {
    const elapsed = Math.max(0, now - this.started);
    const u = Math.min(1, elapsed / this.duration);
    const difference = this.targetSpeed - this.initialSpeed;
    const position = this.position + this.initialSpeed * Math.min(elapsed, this.duration)
      + difference * this.duration * integral(u)
      + this.targetSpeed * Math.max(0, elapsed - this.duration);
    return [position, this.initialSpeed + difference * ease(u)];
  }

  setSpeed(speed, now) {
    [this.position, this.initialSpeed] = this.evaluate(now);
    this.targetSpeed = speed;
    this.started = now;
  }
}

const snapshot = state => ({ ...state, points: state.points.slice(), velocity: state.velocity.slice() });

export class MotionPlayer {
  constructor(initial, now) {
    this.initial = initial;
    this.mode = null;
    this.replay = null;
    this.clock = new SmoothClock(now, 0);
    this.transitionDuration = 0.85;
    this.clipStart = 0.67;
    this.source = {
      points: initial.slice(), velocity: new Float32Array(initial.length),
      surface: 1, surfaceVelocity: 0, progress: 0, finished: false, active: false,
    };
    this.home = new Replay(new Float32Array([...initial, ...initial]), initial.length / 3, 0.3, 'home');
  }

  evaluate(now) {
    if (!this.replay) return this.source;
    const [elapsed, speed] = this.clock.evaluate(now);
    const state = this.replay.evaluate(elapsed - this.clipStart);
    if (elapsed < this.transitionDuration) {
      const u = elapsed / this.transitionDuration;
      const weight = ease(u);
      const derivative = 30 * u * u * (1 - u) ** 2 / this.transitionDuration;
      const decay = Math.exp(-elapsed / 0.18);
      const source = this.source;
      for (let i = 0; i < state.points.length; i++) {
        const start = source.points[i] + source.velocity[i] * 0.18 * (1 - decay);
        state.velocity[i] = (1 - weight) * source.velocity[i] * decay + weight * state.velocity[i]
          + derivative * (state.points[i] - start);
        state.points[i] = (1 - weight) * start + weight * state.points[i];
      }
      const surface = source.surface + source.surfaceVelocity * 0.18 * (1 - decay);
      state.surfaceVelocity = (1 - weight) * source.surfaceVelocity * decay + weight * state.surfaceVelocity
        + derivative * (state.surface - surface);
      state.surface = (1 - weight) * surface + weight * state.surface;
    }
    if (state.surface < 0 || state.surface > 1) {
      state.surface = clamp(state.surface);
      state.surfaceVelocity = 0;
    }
    for (let i = 0; i < state.velocity.length; i++) state.velocity[i] *= speed;
    state.surfaceVelocity *= speed;
    state.finished = elapsed >= Math.max(this.transitionDuration, this.clipStart + this.replay.duration);
    state.active = !state.finished && (speed > 1e-8 || this.clock.targetSpeed > 0);
    return state;
  }

  start(mode, replay, now) {
    this.source = snapshot(this.evaluate(now));
    this.mode = mode;
    this.replay = replay;
    this.clock = new SmoothClock(now);
  }

  toggle(now) {
    this.clock.setSpeed(this.clock.targetSpeed > 0 ? 0 : 1, now);
  }

  reset(now) {
    this.start('home', this.home, now);
  }
}

export class IdleCamera {
  constructor(now) {
    this.home = [-105 * Math.PI / 180, 30 * Math.PI / 180, 0];
    this.position = [...this.home];
    this.velocity = [0, 0, 0];
    this.origin = [...this.position];
    this.originVelocity = [...this.velocity];
    this.target = [...this.position];
    this.mode = 'still';
    this.started = now;
    this.holdUntil = now + 5;
    this.returnDuration = 1.6;
    this.orbitAfterReturn = true;
  }

  sample(now) {
    const elapsed = Math.max(0, now - this.started);
    if (this.mode === 'return') {
      const duration = this.returnDuration, u = Math.min(1, elapsed / duration);
      for (let i = 0; i < 3; i++) {
        this.position[i] = (2 * u ** 3 - 3 * u * u + 1) * this.origin[i]
          + (u ** 3 - 2 * u * u + u) * duration * this.originVelocity[i]
          + (-2 * u ** 3 + 3 * u * u) * this.target[i];
        this.velocity[i] = ((6 * u * u - 6 * u) * this.origin[i] + (-6 * u * u + 6 * u) * this.target[i]) / duration
          + (3 * u * u - 4 * u + 1) * this.originVelocity[i];
      }
      if (elapsed >= duration) {
        this.position = [...this.target];
        this.velocity.fill(0);
        this.origin = [...this.position];
        this.started += duration;
        this.mode = this.orbitAfterReturn ? 'orbit' : 'still';
        return this.sample(now);
      }
    } else if (this.mode === 'orbit') {
      const u = Math.min(1, elapsed / 1.4);
      this.position = [...this.origin];
      this.position[0] += 0.09 * (1.4 * integral(u) + Math.max(0, elapsed - 1.4));
      this.velocity = [0.09 * ease(u), 0, 0];
    } else if (this.mode === 'coast') {
      const u = Math.min(1, elapsed / 0.3);
      for (let i = 0; i < 3; i++) {
        this.position[i] = this.origin[i] + this.originVelocity[i] * 0.3 * (u - integral(u));
        this.velocity[i] = this.originVelocity[i] * (1 - ease(u));
      }
      if (elapsed >= 0.3) {
        this.mode = 'still';
        this.velocity.fill(0);
      }
    }
    return this.position;
  }

  interrupt(now) {
    this.sample(now);
    this.origin = [...this.position];
    this.originVelocity = [...this.velocity];
    this.mode = 'coast';
    this.started = now;
    this.holdUntil = now + 5;
  }

  move(delta, now) {
    this.interrupt(now);
    this.origin = this.origin.map((v, i) => v + delta[i]);
    this.origin[1] = clamp(this.origin[1], -1.4, 1.4);
    this.origin[2] = clamp(this.origin[2], Math.log(0.6), Math.log(1.7));
    this.position = [...this.origin];
  }

  recenter(now, orbit = true) {
    this.sample(now);
    this.origin = [...this.position];
    this.originVelocity = [...this.velocity];
    this.target = [...this.origin];
    const difference = this.home[0] - this.origin[0];
    this.target[0] += Math.atan2(Math.sin(difference), Math.cos(difference));
    this.target[1] = this.home[1];
    if (!orbit) this.target[2] = this.home[2];
    this.started = now;
    this.mode = 'return';
    this.orbitAfterReturn = orbit;
    this.holdUntil = now + 5;
    if (this.origin.every((v, i) => Math.abs(v - this.target[i]) < 1e-10)
      && this.originVelocity.every(v => Math.abs(v) < 1e-10)) this.mode = orbit ? 'orbit' : 'still';
  }

  update(now, allowIdle) {
    this.sample(now);
    if (!allowIdle && (this.mode === 'orbit' || (this.mode === 'return' && this.orbitAfterReturn))) this.interrupt(now);
    else if (allowIdle && this.mode === 'still' && now >= this.holdUntil) this.recenter(now);
    return this.sample(now);
  }
}
