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

const sphereVertex = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const sphereFragment = `#version 300 es
precision highp float;
uniform vec2 viewport;
uniform vec3 camera;
uniform float surface;
uniform float pixelRatio;
out vec4 color;
void main() {
  float radius = min(viewport.x, viewport.y) * 0.38 * exp(camera.z);
  vec2 position = (gl_FragCoord.xy / pixelRatio - viewport * 0.5) / radius;
  float distance = length(position);
  float edge = 0.5 / (radius * pixelRatio);
  if (distance > 1.0 + edge) discard;
  float z = sqrt(max(0.0, 1.0 - dot(position, position)));
  vec3 normal = normalize(vec3(position, z));
  float light = max(dot(normal, normalize(vec3(-0.45, 0.65, 0.9))), 0.0);
  float shading = 0.018 + 0.015 * (1.0 - light) + 0.018 * pow(1.0 - z, 2.0);
  float alpha = shading * surface * (1.0 - smoothstep(1.0 - edge, 1.0 + edge, distance));
  color = vec4(mix(vec3(1.0), vec3(20.0, 44.0, 76.0) / 255.0, alpha), 1.0);
}`;

function createProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

export class DotRenderer {
  constructor(canvas, count) {
    this.canvas = canvas;
    this.count = count;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('This browser cannot display the globe. Please try a browser with WebGL 2.');
    this.gl = gl;
    this.program = createProgram(gl, vertex, fragment);
    this.sphereProgram = createProgram(gl, sphereVertex, sphereFragment);
    this.sphereArray = gl.createVertexArray();
    this.pointArray = gl.createVertexArray();
    gl.useProgram(this.program);
    gl.bindVertexArray(this.pointArray);
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
    this.sphereUniforms = Object.fromEntries(['viewport', 'camera', 'surface', 'pixelRatio'].map(name => [name, gl.getUniformLocation(this.sphereProgram, name)]));
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
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (surface > 0) {
      let deviation = 0;
      for (let i = 0; i < points.length; i += 3) deviation += Math.abs(Math.hypot(points[i], points[i + 1], points[i + 2]) - 3);
      const phase = Math.max(0, Math.min(1, (deviation / this.count - 0.12) / 0.55));
      const opacity = surface * (1 - phase * phase * (3 - 2 * phase));
      if (opacity > 0) {
        const sphere = this.sphereUniforms;
        gl.useProgram(this.sphereProgram);
        gl.bindVertexArray(this.sphereArray);
        gl.uniform2f(sphere.viewport, width, height);
        gl.uniform3f(sphere.camera, ...camera);
        gl.uniform1f(sphere.surface, opacity);
        gl.uniform1f(sphere.pixelRatio, ratio);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    gl.useProgram(this.program);
    gl.bindVertexArray(this.pointArray);
    gl.uniform2f(uniforms.viewport, width, height);
    gl.uniform3f(uniforms.camera, ...camera);
    gl.uniform1f(uniforms.surface, surface);
    gl.uniform1f(uniforms.pixelRatio, ratio);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positions);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, points);
    gl.drawArrays(gl.POINTS, 0, this.count);
  }
}
