const vertex = `#version 300 es
precision highp float;
in vec3 point;
in float radius;
uniform vec2 viewport;
uniform vec3 camera;
uniform float surface;
uniform float pixelRatio;
out float opacity;
out float dotRadius;
out float halo;
out float extent;
void main() {
  float cy = cos(camera.x), sy = sin(camera.x);
  float cp = cos(camera.y), sp = sin(camera.y);
  vec3 rotated = vec3(cy * point.x + sy * point.z,
    sp * sy * point.x + cp * point.y - sp * cy * point.z,
    -cp * sy * point.x + sp * point.y + cp * cy * point.z);
  float depth = clamp(rotated.z / max(length(rotated), 0.000001), -1.0, 1.0);
  float front = sqrt(max(depth, 0.0));
  float rear = sqrt(clamp(1.0 + depth, 0.0, 1.0));
  float surfaceOpacity = depth >= 0.0 ? 0.27 + 0.73 * front : 0.18 + 0.09 * rear;
  opacity = mix(0.27 + 0.73 * (depth + 1.0) / 2.0, surfaceOpacity, surface);
  float surfaceSize = depth >= 0.0 ? 0.7 + 0.3 * front : 0.56 + 0.14 * rear;
  float size = mix(0.7 + 0.3 * front, surfaceSize, surface);
  halo = 1.0 - surface + surface * front;
  float shortest = min(viewport.x, viewport.y);
  dotRadius = radius * max(0.65, shortest / 800.0) * size;
  float scale = shortest * 0.38 / 3.0 * exp(camera.z);
  gl_Position = vec4(rotated.xy * scale * 2.0 / viewport, 0.0, 1.0);
  extent = ceil((dotRadius + 2.0) * 2.0 * pixelRatio) / pixelRatio;
  gl_PointSize = extent * pixelRatio;
}`;

const fragment = `#version 300 es
precision highp float;
in float opacity;
in float dotRadius;
in float halo;
in float extent;
uniform float pixelRatio;
out vec4 color;
void main() {
  float distance = length((gl_PointCoord - 0.5) * extent);
  float edge = 0.5 / pixelRatio;
  float core = 1.0 - smoothstep(dotRadius - edge, dotRadius + edge, distance);
  float glow = 0.075 * halo * exp(-0.5 * pow(distance / (dotRadius + 0.7), 2.0));
  float alpha = max(core, glow) * opacity;
  color = vec4(mix(vec3(1.0), vec3(20.0, 44.0, 76.0) / 255.0, alpha), 1.0);
}`;

export class DotRenderer {
  constructor(canvas, count) {
    this.canvas = canvas;
    this.count = count;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('This browser cannot display the globe. Please try a browser with WebGL 2.');
    this.gl = gl;
    this.program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(this.program, shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
    gl.useProgram(this.program);
    this.positions = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
    gl.bufferData(gl.ARRAY_BUFFER, count * 3 * 4, gl.DYNAMIC_DRAW);
    const point = gl.getAttribLocation(this.program, 'point');
    gl.enableVertexAttribArray(point);
    gl.vertexAttribPointer(point, 3, gl.FLOAT, false, 0, 0);
    let seed = 24;
    const radii = Float32Array.from({ length: count }, () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return 0.9 + 0.45 * seed / 4294967296;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, radii, gl.STATIC_DRAW);
    const radius = gl.getAttribLocation(this.program, 'radius');
    gl.enableVertexAttribArray(radius);
    gl.vertexAttribPointer(radius, 1, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['viewport', 'camera', 'surface', 'pixelRatio'].map(name => [name, gl.getUniformLocation(this.program, name)]));
    gl.clearColor(1, 1, 1, 1);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MIN);
    gl.blendFunc(gl.ONE, gl.ONE);
  }

  render(points, camera, surface) {
    const { gl, canvas, uniforms } = this;
    const { width, height } = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(width * ratio), h = Math.round(height * ratio);
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform3f(uniforms.camera, ...camera);
    gl.uniform1f(uniforms.surface, surface);
    gl.uniform1f(uniforms.pixelRatio, ratio);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, points);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }
}
