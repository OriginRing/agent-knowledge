// Shader formulas adapted from Canvas UI Glass (MIT).
// https://github.com/DavidHDev/canvas-ui

export interface GlassRenderer {
  hide: () => void;
  invalidate: () => void;
  move: (x: number, y: number) => void;
  resize: () => void;
  updateTexture: (source: TexImageSource) => void;
  destroy: () => void;
}

const VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main () { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uContent;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uEdge;
uniform float uBevel;
uniform float uIor;
uniform float uDepth;
uniform float uAberration;
uniform float uReflect;
uniform float uShine;
uniform vec3 uRimColor;
uniform float uZoom;
uniform float uAlpha;

const float PI = 3.14159265358979;
const float AIR_IOR = 1.0003;
const vec3 INCIDENT = vec3(0.0, 0.0, 1.0);

float pow2 (float x) { return x * x; }
float pow5 (float x) { float x2 = x * x; return x2 * x2 * x; }
float linearStep (float e0, float e1, float x) {
  return clamp((x - e0) / (e1 - e0), 0.0, 1.0);
}
float sdf (vec2 p) { return length(p) - uHalf.x; }
vec3 page (vec2 px, float lod) {
  vec2 uv = clamp(px / uResolution, vec2(0.0005), vec2(0.9995));
  return pow(textureLod(uContent, vec2(uv.x, 1.0 - uv.y), lod).rgb, vec3(2.2));
}
float iorForWavelength (float wavelength) {
  float ab = uAberration * 0.1;
  return mix(uIor + ab, uIor - ab,
    1.0 - pow(1.0 - linearStep(450.0, 650.0, wavelength), 4.0));
}
vec3 pageAA (vec2 px, float minLod) {
  float footprint = max(length(fwidth(px)), 1.0);
  return page(px, max(minLod, log2(footprint)));
}
vec3 sampleRefraction (vec2 basePx, float rim, vec3 normal, float glassIor) {
  vec3 rv = refract(INCIDENT, normal, AIR_IOR / glassIor);
  rv /= abs(rv.z) / uDepth;
  return pageAA(basePx + rv.xy, rim * 0.3);
}
float fresnelSchlick (float cosTheta, float f0) {
  return f0 + (1.0 - f0) * pow5(1.0 - cosTheta);
}
float smithSchlickDenom (float cosTheta, float k) {
  return cosTheta * (1.0 - k) + k;
}
float ggx (float roughness, float NDotL, float NDotV, float NDotH) {
  if (NDotL <= 0.0) return 0.0;
  float a2 = pow2(roughness);
  float d = a2 / (PI * pow2(pow2(NDotH) * (a2 - 1.0) + 1.0));
  float k = roughness * 0.5;
  float v = 1.0 / (smithSchlickDenom(NDotL, k)
    * smithSchlickDenom(clamp(NDotV, 0.0, 1.0), k));
  return NDotL * d * v;
}

void main () {
  vec2 fragPx = gl_FragCoord.xy;
  vec2 p = fragPx - uCenter;
  float sd = sdf(p);
  float mask = 1.0 - smoothstep(-1.5, 0.0, sd);
  float alpha = mask * uAlpha;
  float edgeW = max(uHalf.x * (1.0 - clamp(uEdge, 0.0, 0.98)), 1.0);
  float rim = pow(linearStep(-edgeW, 0.0, sd), uBevel);

  float e = 1.0;
  vec2 grad = vec2(
    sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)),
    sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e)));
  vec3 rimNormal = vec3(normalize(grad + vec2(1e-5)), 0.0);
  vec3 normal = normalize(mix(vec3(0.0, 0.0, -1.0), rimNormal, rim));
  vec2 basePx = uCenter + p / uZoom;

  vec3 refracted = sampleRefraction(basePx, rim, normal, iorForWavelength(611.4))
    * vec3(1.0, 0.0, 0.0);
  refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(570.5))
    * vec3(1.0, 1.0, 0.0);
  refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(549.1))
    * vec3(0.0, 1.0, 0.0);
  refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(491.4))
    * vec3(0.0, 1.0, 1.0);
  refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(464.2))
    * vec3(0.0, 0.0, 1.0);
  refracted += sampleRefraction(basePx, rim, normal, iorForWavelength(374.0))
    * vec3(1.0, 0.0, 1.0);
  refracted /= 3.0;

  vec3 glass = refracted;
  const vec3 V = vec3(0.0, 0.0, -1.0);
  float NDotV = clamp(dot(V, normal), 0.0, 1.0);
  float f0 = pow2((uIor - AIR_IOR) / (uIor + AIR_IOR));
  float fresnelV = fresnelSchlick(NDotV, f0) * uReflect;
  vec3 reflectVector = reflect(INCIDENT, normal);
  vec3 L = reflectVector;
  vec3 H = normalize(L + V);
  reflectVector /= abs(reflectVector.z) / uDepth;
  vec3 reflected = page(basePx + reflectVector.xy, 2.5);
  reflected *= ggx(0.5, dot(normal, L), NDotV, dot(normal, H));
  glass = mix(refracted, reflected, clamp(fresnelV, 0.0, 1.0));

  float ldot = dot(rimNormal.xy, normalize(vec2(-0.6, 0.8)));
  float band = pow(rim, 1.8);
  float arcs = pow(abs(ldot), 3.0) * (ldot > 0.0 ? 0.5 : 0.28);
  glass = mix(glass, uRimColor, band * 0.34);
  glass += band * (0.04 + arcs) * uShine;
  outColor = vec4(pow(glass, vec3(1.0 / 2.2)) * alpha, alpha);
}`;

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Glass shader compile error", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

export const createGlassRenderer = (
  canvas: HTMLCanvasElement,
): GlassRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!gl) return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  const uniforms: Record<string, WebGLUniformLocation> = {};
  const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < uniformCount; index += 1) {
    const info = gl.getActiveUniform(program, index);
    if (!info) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (location) uniforms[info.name] = location;
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );

  let targetX = canvas.clientWidth / 2;
  let targetY = canvas.clientHeight / 2;
  let x = targetX;
  let y = targetY;
  let presence = 0;
  let presenceTarget = 0;
  let frameId = 0;
  let destroyed = false;
  let lastTime = performance.now();

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
  };

  const render = () => {
    const dpr = canvas.width / Math.max(canvas.clientWidth, 1);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (presence <= 0.004) return;

    const centerX = x * dpr;
    const centerY = canvas.height - y * dpr;
    const halfSize = 104 * presence * dpr;
    const margin = 6 * dpr;
    const scissorX = Math.min(
      canvas.width,
      Math.max(0, Math.floor(centerX - halfSize - margin)),
    );
    const scissorY = Math.min(
      canvas.height,
      Math.max(0, Math.floor(centerY - halfSize - margin)),
    );
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(
      scissorX,
      scissorY,
      Math.min(canvas.width - scissorX, Math.ceil(halfSize * 2 + margin * 2)),
      Math.min(canvas.height - scissorY, Math.ceil(halfSize * 2 + margin * 2)),
    );

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.uContent, 0);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uCenter, centerX, centerY);
    gl.uniform2f(uniforms.uHalf, 104 * presence * dpr, 104 * presence * dpr);
    gl.uniform1f(uniforms.uEdge, 0.72);
    gl.uniform1f(uniforms.uBevel, 4);
    gl.uniform1f(uniforms.uIor, 1.5);
    gl.uniform1f(uniforms.uDepth, 220 * dpr);
    gl.uniform1f(uniforms.uAberration, 0.85);
    gl.uniform1f(uniforms.uReflect, 0.9);
    gl.uniform1f(uniforms.uShine, 0.7);
    gl.uniform3f(uniforms.uRimColor, 0.2, 0.16, 0.72);
    gl.uniform1f(uniforms.uZoom, 1.55);
    gl.uniform1f(uniforms.uAlpha, Math.min(presence * 5, 1));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.SCISSOR_TEST);
  };

  const frame = (now: number) => {
    if (destroyed) return;
    const delta = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    const positionEase = 1 - Math.exp(-delta * 12);
    const scaleEase = 1 - Math.exp(-delta * 11);
    x += (targetX - x) * positionEase;
    y += (targetY - y) * positionEase;
    presence += (presenceTarget - presence) * scaleEase;
    render();
    const settled =
      Math.abs(targetX - x) < 0.1 &&
      Math.abs(targetY - y) < 0.1 &&
      Math.abs(presenceTarget - presence) < 0.002;
    frameId = settled ? 0 : requestAnimationFrame(frame);
  };

  const wake = () => {
    if (frameId || destroyed) return;
    lastTime = performance.now();
    frameId = requestAnimationFrame(frame);
  };

  resize();
  return {
    hide() {
      presenceTarget = 0;
      wake();
    },
    invalidate() {
      presence = 0;
      presenceTarget = 0;
      render();
    },
    move(nextX, nextY) {
      targetX = nextX;
      targetY = nextY;
      if (presence <= 0.004) {
        x = nextX;
        y = nextY;
      }
      presenceTarget = 1;
      wake();
    },
    resize() {
      resize();
      render();
    },
    updateTexture(source) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      render();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      gl.deleteTexture(texture);
      gl.deleteBuffer(quad);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
};
