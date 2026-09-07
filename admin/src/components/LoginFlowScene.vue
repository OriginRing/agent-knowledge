<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

type SceneNode = {
  x: number;
  y: number;
  label: string;
  icon: "core" | "file" | "knowledge" | "memory" | "skill" | "model";
  tone: "cyan" | "violet";
};

const nodes: SceneNode[] = [
  {
    x: 0.5,
    y: 0.5,
    label: "智能体编排",
    icon: "core",
    tone: "violet",
  },
  { x: 0.18, y: 0.24, label: "文件理解", icon: "file", tone: "cyan" },
  {
    x: 0.79,
    y: 0.22,
    label: "知识库",
    icon: "knowledge",
    tone: "violet",
  },
  {
    x: 0.17,
    y: 0.76,
    label: "长期记忆",
    icon: "memory",
    tone: "violet",
  },
  { x: 0.81, y: 0.74, label: "技能执行", icon: "skill", tone: "cyan" },
  { x: 0.51, y: 0.13, label: "模型能力", icon: "model", tone: "cyan" },
];

const edges = nodes.slice(1).map((_, index) => [0, index + 1] as const);
const canvas = ref<HTMLCanvasElement>();
const scene = ref<HTMLElement>();
const hoveredNode = ref<number | null>(null);
const webglUnavailable = ref(false);

let animationFrame = 0;
let resizeObserver: ResizeObserver | undefined;
let cleanupRenderer: (() => void) | undefined;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function setupRenderer(target: HTMLCanvasElement) {
  const context = target.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  });
  if (!context) return null;
  const gl: WebGLRenderingContext = context;

  const lineProgram = createProgram(
    gl,
    `
      attribute vec2 a_position;
      attribute float a_alpha;
      varying float v_alpha;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_alpha = a_alpha;
      }
    `,
    `
      precision mediump float;
      uniform vec3 u_color;
      varying float v_alpha;
      void main() {
        gl_FragColor = vec4(u_color, v_alpha);
      }
    `,
  );
  const pointProgram = createProgram(
    gl,
    `
      attribute vec2 a_position;
      attribute float a_size;
      attribute float a_energy;
      varying float v_energy;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_size;
        v_energy = a_energy;
      }
    `,
    `
      precision mediump float;
      varying float v_energy;
      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float distanceFromCenter = length(centered);
        float glow = 1.0 - smoothstep(0.08, 0.5, distanceFromCenter);
        float core = 1.0 - smoothstep(0.0, 0.16, distanceFromCenter);
        vec3 cyan = vec3(0.12, 0.78, 1.0);
        vec3 violet = vec3(0.51, 0.34, 1.0);
        vec3 color = mix(cyan, violet, v_energy);
        float alpha = glow * 0.72 + core * 0.28;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  );
  if (!lineProgram || !pointProgram) return null;

  const lineBuffer = gl.createBuffer();
  const pointBuffer = gl.createBuffer();
  if (!lineBuffer || !pointBuffer) return null;

  const linePosition = gl.getAttribLocation(lineProgram, "a_position");
  const lineAlpha = gl.getAttribLocation(lineProgram, "a_alpha");
  const lineColor = gl.getUniformLocation(lineProgram, "u_color");
  const pointPosition = gl.getAttribLocation(pointProgram, "a_position");
  const pointSize = gl.getAttribLocation(pointProgram, "a_size");
  const pointEnergy = gl.getAttribLocation(pointProgram, "a_energy");
  let width = 1;
  let height = 1;
  let reducedMotion = false;
  let hovered = -1;
  const hoverEnergy = nodes.map(() => 0);
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  function toClipX(value: number) {
    return value * 2 - 1;
  }
  function toClipY(value: number) {
    return 1 - value * 2;
  }
  function resize() {
    const bounds = target.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.round(bounds.width * ratio));
    height = Math.max(1, Math.round(bounds.height * ratio));
    if (target.width !== width || target.height !== height) {
      target.width = width;
      target.height = height;
    }
    gl.viewport(0, 0, width, height);
  }
  function setMotionPreference() {
    reducedMotion = motionQuery.matches;
  }
  setMotionPreference();
  motionQuery.addEventListener("change", setMotionPreference);

  function drawLines(time: number) {
    const values: number[] = [];
    const pulseTime = reducedMotion ? 0 : time;
    const pushSegment = (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      alpha: number,
      thickness = 1.5,
    ) => {
      const pixelDeltaX = ((endX - startX) * width) / 2;
      const pixelDeltaY = ((endY - startY) * height) / 2;
      const length = Math.max(1, Math.hypot(pixelDeltaX, pixelDeltaY));
      const offsetX = (-pixelDeltaY / length) * ((thickness * 2) / width);
      const offsetY = (pixelDeltaX / length) * ((thickness * 2) / height);
      values.push(
        startX - offsetX,
        startY - offsetY,
        alpha,
        startX + offsetX,
        startY + offsetY,
        alpha,
        endX + offsetX,
        endY + offsetY,
        alpha * 0.62,
        startX - offsetX,
        startY - offsetY,
        alpha,
        endX + offsetX,
        endY + offsetY,
        alpha * 0.62,
        endX - offsetX,
        endY - offsetY,
        alpha * 0.62,
      );
    };
    edges.forEach(([from, to], edgeIndex) => {
      const start = nodes[from];
      const end = nodes[to];
      const active = Math.max(hoverEnergy[from], hoverEnergy[to]);
      const clipStartX = toClipX(start.x);
      const clipStartY = toClipY(start.y);
      const clipEndX = toClipX(end.x);
      const clipEndY = toClipY(end.y);

      pushSegment(
        clipStartX,
        clipStartY,
        clipEndX,
        clipEndY,
        0.1 + active * 0.12,
        8,
      );
      pushSegment(
        clipStartX,
        clipStartY,
        clipEndX,
        clipEndY,
        0.38 + active * 0.34,
        1.8,
      );

      for (let streak = 0; streak < 2; streak += 1) {
        const progress = reducedMotion
          ? 0.56 - streak * 0.28
          : (pulseTime * 0.00034 + edgeIndex * 0.11 + streak * 0.5) % 1;
        const headT = Math.max(0, 1 - progress);
        const tailT = Math.min(1, headT + 0.24);
        const headX = toClipX(start.x + (end.x - start.x) * headT);
        const headY = toClipY(start.y + (end.y - start.y) * headT);
        const tailX = toClipX(start.x + (end.x - start.x) * tailT);
        const tailY = toClipY(start.y + (end.y - start.y) * tailT);
        pushSegment(headX, headY, tailX, tailY, 0.18 + active * 0.12, 9);
        pushSegment(headX, headY, tailX, tailY, 1 + active * 0.35, 3.2);
      }
    });
    [0.1, 0.145, 0.195].forEach((radius, ringIndex) => {
      const segments = 56;
      for (let segment = 0; segment < segments; segment += 1) {
        const angle = (segment / segments) * Math.PI * 2;
        const nextAngle = ((segment + 1) / segments) * Math.PI * 2;
        const verticalRadius = radius * (0.55 + ringIndex * 0.04);
        const alpha = 0.24 + hoverEnergy[0] * 0.24;
        pushSegment(
          toClipX(0.5 + Math.cos(angle) * radius),
          toClipY(0.5 + Math.sin(angle) * verticalRadius),
          toClipX(0.5 + Math.cos(nextAngle) * radius),
          toClipY(0.5 + Math.sin(nextAngle) * verticalRadius),
          alpha,
          0.8,
        );
      }
    });
    gl.useProgram(lineProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(linePosition);
    gl.vertexAttribPointer(linePosition, 2, gl.FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(lineAlpha);
    gl.vertexAttribPointer(lineAlpha, 1, gl.FLOAT, false, 12, 8);
    gl.uniform3f(lineColor, 0.24, 0.65, 1);
    gl.drawArrays(gl.TRIANGLES, 0, values.length / 3);
  }

  function drawPoints(time: number) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const values: number[] = [];
    nodes.forEach((node, index) => {
      const targetEnergy = hovered === index ? 1 : 0;
      hoverEnergy[index] += (targetEnergy - hoverEnergy[index]) * 0.12;
      const ambient = reducedMotion ? 0 : Math.sin(time * 0.002 + index) * 2;
      const baseSize = index === 0 ? 98 : 58;
      values.push(
        toClipX(node.x),
        toClipY(node.y),
        (baseSize + ambient + hoverEnergy[index] * 28) * ratio,
        node.tone === "violet" ? 0.8 : 0.18,
      );
    });

    edges.forEach(([from, to], index) => {
      const start = nodes[from];
      const end = nodes[to];
      const progress = reducedMotion
        ? 0.48
        : (time * 0.00012 + index * 0.19) % 1;
      values.push(
        toClipX(start.x + (end.x - start.x) * progress),
        toClipY(start.y + (end.y - start.y) * progress),
        16 * ratio,
        index % 2 ? 0.75 : 0.12,
      );
    });

    gl.useProgram(pointProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pointPosition);
    gl.vertexAttribPointer(pointPosition, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(pointSize);
    gl.vertexAttribPointer(pointSize, 1, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(pointEnergy);
    gl.vertexAttribPointer(pointEnergy, 1, gl.FLOAT, false, 16, 12);
    gl.drawArrays(gl.POINTS, 0, values.length / 4);
  }

  function draw(time: number) {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    drawLines(time);
    drawPoints(time);
  }

  return {
    draw,
    setHovered(index: number) {
      hovered = index;
    },
    destroy() {
      motionQuery.removeEventListener("change", setMotionPreference);
      gl.deleteBuffer(lineBuffer);
      gl.deleteBuffer(pointBuffer);
      gl.deleteProgram(lineProgram);
      gl.deleteProgram(pointProgram);
    },
  };
}

function findHoveredNode(event: PointerEvent) {
  const bounds = canvas.value?.getBoundingClientRect();
  if (!bounds) return -1;
  const pointerX = (event.clientX - bounds.left) / bounds.width;
  const pointerY = (event.clientY - bounds.top) / bounds.height;
  const aspect = bounds.width / bounds.height;
  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;
  nodes.forEach((node, index) => {
    const distance = Math.hypot(
      (node.x - pointerX) * aspect,
      node.y - pointerY,
    );
    const radius = index === 0 ? 0.105 : 0.075;
    if (distance < radius && distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  });
  return closestIndex;
}

onMounted(() => {
  if (!canvas.value || !scene.value) return;
  const renderer = setupRenderer(canvas.value);
  if (!renderer) {
    webglUnavailable.value = true;
    return;
  }
  const render = (time: number) => {
    renderer.draw(time);
    animationFrame = window.requestAnimationFrame(render);
  };
  const updateAnimationState = () => {
    window.cancelAnimationFrame(animationFrame);
    if (!document.hidden) animationFrame = window.requestAnimationFrame(render);
  };
  updateAnimationState();
  document.addEventListener("visibilitychange", updateAnimationState);

  const updateHover = (event: PointerEvent) => {
    const index = findHoveredNode(event);
    hoveredNode.value = index >= 0 ? index : null;
    renderer.setHovered(index);
  };
  const clearHover = () => {
    hoveredNode.value = null;
    renderer.setHovered(-1);
  };
  scene.value.addEventListener("pointermove", updateHover);
  scene.value.addEventListener("pointerdown", updateHover);
  scene.value.addEventListener("pointerleave", clearHover);
  resizeObserver = new ResizeObserver(() => renderer.draw(performance.now()));
  resizeObserver.observe(scene.value);
  cleanupRenderer = () => {
    scene.value?.removeEventListener("pointermove", updateHover);
    scene.value?.removeEventListener("pointerdown", updateHover);
    scene.value?.removeEventListener("pointerleave", clearHover);
    document.removeEventListener("visibilitychange", updateAnimationState);
    window.cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    renderer.destroy();
  };
});

onUnmounted(() => {
  window.cancelAnimationFrame(animationFrame);
  cleanupRenderer?.();
});
</script>

<template>
  <section
    ref="scene"
    class="login-flow-scene"
    :class="{ 'is-fallback': webglUnavailable }"
    aria-label="智能体能力流程：模型、文件、知识库、记忆与技能汇聚到智能体编排核心"
  >
    <canvas ref="canvas" aria-hidden="true" />
    <div class="scene-grid" aria-hidden="true" />
    <div
      v-for="(node, index) in nodes"
      :key="node.label"
      class="scene-node-label"
      :class="{
        'is-core': index === 0,
        'is-active': hoveredNode === index,
        [`tone-${node.tone}`]: true,
      }"
      :style="{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }"
      aria-hidden="true"
    >
      <span class="scene-node-icon">
        <svg v-if="node.icon === 'core'" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="6" r="2" />
          <circle cx="5" cy="18" r="2" />
          <circle cx="19" cy="18" r="2" />
          <path
            d="m7 7.5 2.7 2.6m4.6 0L17 7.5m-7.3 6.4L7 16.5m7.3-2.6 2.7 2.6"
          />
        </svg>
        <svg
          v-else-if="node.icon === 'file'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M5 3h9l4 4v6.5M14 3v5h4M8 11h6m-6 3h4" />
          <circle cx="16.5" cy="16.5" r="3.5" />
          <path d="m19 19 2 2M5 3v18h8" />
        </svg>
        <svg
          v-else-if="node.icon === 'knowledge'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <ellipse cx="12" cy="5.5" rx="7" ry="3" />
          <path
            d="M5 5.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6M5 11.5v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
          />
        </svg>
        <svg
          v-else-if="node.icon === 'memory'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M5 7V3m0 0H1m4 0-2.1 2.1A9 9 0 1 0 12 3" />
          <circle cx="12" cy="12" r="6" />
          <path d="M12 8v4l3 2" />
        </svg>
        <svg
          v-else-if="node.icon === 'skill'"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M9 4a3 3 0 1 1 6 0v2h3a2 2 0 0 1 2 2v3h-2a3 3 0 1 0 0 6h2v3H8a2 2 0 0 1-2-2v-3H4a3 3 0 1 1 0-6h2V6h3Z"
          />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4" />
        </svg>
      </span>
      <strong>{{ node.label }}</strong>
      <small v-if="index === 0">AGENT CORE</small>
    </div>
  </section>
</template>
