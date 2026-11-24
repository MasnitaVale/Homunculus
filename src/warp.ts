// Draws the mirrored camera image with WebGL: magnifies some areas (hands, lips…)
// and shrinks others (torso, shoulders).

import { SLOTS, type Bulge } from "./body";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform sampler2D u_video;
uniform vec2 u_size;
uniform float u_aspect;
uniform vec4 u_bulge[${SLOTS}];
uniform vec2 u_shape[${SLOTS}];
uniform float u_alpha;

void main() {
  // Screen position, origin top-left, mirrored like a real mirror.
  vec2 uv = vec2(gl_FragCoord.x / u_size.x, 1.0 - gl_FragCoord.y / u_size.y);
  vec2 p = vec2(1.0 - uv.x, uv.y);

  for (int i = 0; i < ${SLOTS}; i++) {
    vec4 b = u_bulge[i];
    if (abs(b.w) < 0.001 || b.z <= 0.0) continue;
    vec2 d = p - b.xy;
    vec2 q = vec2(d.x * u_aspect, d.y);
    float c = cos(u_shape[i].y);
    float s = sin(u_shape[i].y);
    q = vec2((c * q.x + s * q.y) / u_shape[i].x, -s * q.x + c * q.y);
    float r = length(q) / b.z;
    if (r < 1.0) {
      float k = 1.0 - r * r;
      p = b.xy + d * (1.0 - b.w * k * k);
    }
  }

  gl_FragColor = vec4(texture2D(u_video, clamp(p, 0.0, 1.0)).rgb, u_alpha);
}
`;

// Draws straight onto the visible canvas. With trails on, each frame is blended
// over the previous ones instead of replacing them.
export function createWarp(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, alpha: false });
  if (!gl) throw new Error("WebGL not available");

  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(program, "a_pos");
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uSize = gl.getUniformLocation(program, "u_size");
  const uAspect = gl.getUniformLocation(program, "u_aspect");
  const uBulge = gl.getUniformLocation(program, "u_bulge");
  const uAlpha = gl.getUniformLocation(program, "u_alpha");
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const flat = new Float32Array(SLOTS * 4);
  const shapes = new Float32Array(SLOTS * 2);
  const uShape = gl.getUniformLocation(program, "u_shape");

  // `bulges` are final: strength applied and centres settled.
  function draw(video: HTMLVideoElement, bulges: Bulge[], trails: boolean) {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl!.viewport(0, 0, w, h);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGB, gl!.RGB, gl!.UNSIGNED_BYTE, video);
    bulges.forEach((b, i) => {
      flat.set([b.x, b.y, b.r, b.s], i * 4);
      shapes.set([b.e, b.a], i * 2);
    });
    gl!.uniform2f(uSize, w, h);
    gl!.uniform1f(uAspect, w / h);
    gl!.uniform4fv(uBulge, flat);
    gl!.uniform2fv(uShape, shapes);
    gl!.uniform1f(uAlpha, trails ? 0.3 : 1);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  }

  return { draw };
}
