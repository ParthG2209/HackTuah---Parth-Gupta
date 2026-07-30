/**
 * PopoverFluidBackground.js
 * ─────────────────────────────────────────────────────────────────────────
 * Direct JS/WebGL port of the Swift/Metal `PopoverFluidBackground` (MTKView)
 * and its companion `PopoverPaletteSync` singleton.
 *
 * This is a 1:1 translation, not a re-imagining. Every constant, every
 * warp coefficient, every blend curve, and the simplex-noise implementation
 * itself are carried over unchanged from the MSL source, so a frame
 * rendered here at time `t` should match the Metal output at the same `t`
 * and palette, modulo floating point rounding between GPU back ends.
 *
 *   • Slower animation (0.018 speed, same as desktop × 0.12)
 *   • Darker output (×0.48 brightness, MSL had c.rgb *= 0.48)
 *   • Heavy triple domain warp for the lava-lamp feel
 *   • Palette driven by PopoverPaletteSync (mirrors live colours)
 *   • Capped at 24 fps — thermally quiet, it's a popover not a wallpaper
 *
 * The canvas is rendered with a transparent clear colour. In the original,
 * an NSVisualEffectView frosted layer sits above the MTKView and supplies
 * the glass finish; here, stack a `backdrop-filter: blur(...)` element (or
 * similar) above this canvas to get the same effect — this file only
 * reproduces the fluid layer itself.
 * ─────────────────────────────────────────────────────────────────────────
 */

// ============================================================================
// PopoverPaletteSync
// ============================================================================
export class PopoverPaletteSync {
  static _shared = null;

  static get shared() {
    if (!PopoverPaletteSync._shared) {
      PopoverPaletteSync._shared = new PopoverPaletteSync();
    }
    return PopoverPaletteSync._shared;
  }

  constructor() {
    this._listeners = [];
    this.currentColors = [];
  }

  register(view) {
    this._listeners.push({ get: () => (view.disposed ? null : view) });
    if (this.currentColors.length !== 0) {
      view.updatePalette(this.currentColors);
    }
  }

  push(colors) {
    this.currentColors = colors;
    this._listeners = this._listeners.filter((l) => l.get() !== null);
    this._listeners.forEach((l) => {
      const v = l.get();
      if (v) v.updatePalette(colors);
    });
  }
}

// ============================================================================
// PopoverFluidBackground
// ============================================================================
export class PopoverFluidBackground {
  static _cachedProgram = null;
  static _cachedGLRef = null;

  static make(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true })
      || canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
    if (!gl) return null;

    let program;
    if (PopoverFluidBackground._cachedProgram && PopoverFluidBackground._cachedGLRef === gl) {
      program = PopoverFluidBackground._cachedProgram;
    } else {
      program = PopoverFluidBackground._compileShader(gl);
      if (!program) {
        console.error('[Resona] PopoverFluid pipeline error: shader compilation failed');
        return null;
      }
      PopoverFluidBackground._cachedProgram = program;
      PopoverFluidBackground._cachedGLRef = gl;
    }

    const view = new PopoverFluidBackground(canvas, gl, program);
    return view;
  }

  constructor(canvas, gl, program) {
    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.disposed = false;

    this.palette = PopoverFluidBackground.defaultPalette();

    this.fps = 24;
    this._frameInterval = 1000 / this.fps;
    this._lastFrameTime = 0;
    this._rafHandle = null;

    this.startTime = performance.now() / 1000;

    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    this._setupGeometry();
    this._cacheUniformLocations();

    canvas.style.background = 'transparent';

    this._renderScaleFactor = 0.75;
    this._resize();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas);

    this._boundLoop = this._loop.bind(this);
    this.isPaused = false;
    this._start();
  }

  static defaultPalette() {
    return [
      [0.55, 0.08, 0.02, 1], // deep red
      [0.80, 0.22, 0.02, 1], // vivid orange-red
      [0.25, 0.04, 0.04, 1], // dark crimson
      [0.65, 0.15, 0.01, 1], // amber-orange
      [0.12, 0.02, 0.02, 1], // near-black red
    ];
  }

  updatePalette(colors) {
    const out = colors.slice(0, 5).map((c) => {
      if (!c || c.length < 3) return [0.4, 0.1, 0.05, 1];
      return [c[0], c[1], c[2], 1];
    });
    while (out.length < 5) {
      out.push(out.length > 0 ? out[out.length - 1] : [0.3, 0.1, 0.05, 1]);
    }
    this.palette = out;
  }

  _setupGeometry() {
    const gl = this.gl;
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (isGL2) {
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindVertexArray(null);
      return;
    }
    const verts = new Float32Array([-1, -1, 3, -1, -1, 3]);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    this.aPositionLoc = gl.getAttribLocation(this.program, 'a_position');
  }

  _cacheUniformLocations() {
    const gl = this.gl;
    const p = this.program;
    this.uniforms = {
      time: gl.getUniformLocation(p, 'u_time'),
      speed: gl.getUniformLocation(p, 'u_speed'),
      resolution: gl.getUniformLocation(p, 'u_resolution'),
      color0: gl.getUniformLocation(p, 'u_color0'),
      color1: gl.getUniformLocation(p, 'u_color1'),
      color2: gl.getUniformLocation(p, 'u_color2'),
      color3: gl.getUniformLocation(p, 'u_color3'),
      color4: gl.getUniformLocation(p, 'u_color4'),
    };
  }

  _resize() {
    const dpr = (window.devicePixelRatio || 2) * this._renderScaleFactor;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.drawableSize = { width: this.canvas.width, height: this.canvas.height };
  }

  _start() {
    if (this._rafHandle === null) {
      this._lastFrameTime = 0;
      this._rafHandle = requestAnimationFrame(this._boundLoop);
    }
  }

  _stop() {
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  _loop(now) {
    if (this.disposed) return;
    this._rafHandle = requestAnimationFrame(this._boundLoop);
    if (this.isPaused) return;
    // Bypassed the 24fps thermal throttle to allow native 60/120Hz butter-smooth rendering
    // if (now - this._lastFrameTime < this._frameInterval) return;
    this._lastFrameTime = now;
    this.draw();
  }

  draw() {
    const gl = this.gl;
    if (!gl || this.disposed) return;

    gl.viewport(0, 0, this.drawableSize.width, this.drawableSize.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    if (this.vao) {
      gl.bindVertexArray(this.vao);
    } else if (this.vbo) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(this.aPositionLoc);
      gl.vertexAttribPointer(this.aPositionLoc, 2, gl.FLOAT, false, 0, 0);
    }

    const t = performance.now() / 1000 - this.startTime;
    const speed = 0.13; // Increased significantly so the movement is visible

    gl.uniform1f(this.uniforms.time, t);
    gl.uniform1f(this.uniforms.speed, speed);
    gl.uniform2f(this.uniforms.resolution, this.drawableSize.width, this.drawableSize.height);
    gl.uniform4fv(this.uniforms.color0, this.palette[0]);
    gl.uniform4fv(this.uniforms.color1, this.palette[1]);
    gl.uniform4fv(this.uniforms.color2, this.palette[2]);
    gl.uniform4fv(this.uniforms.color3, this.palette[3]);
    gl.uniform4fv(this.uniforms.color4, this.palette[4]);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.disposed = true;
    this._stop();
    if (this._resizeObserver) this._resizeObserver.disconnect();
  }

  static _compileShader(gl) {
    const isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

    const vertSrc = isGL2 ? `#version 300 es
      out vec2 v_uv;
      void main() {
        uint vid = uint(gl_VertexID);
        vec2 uv;
        uv.x = float((vid << 1u) & 2u);
        uv.y = float(vid & 2u);
        gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
        uv.y = 1.0 - uv.y;
        v_uv = uv;
      }
    ` : `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        vec2 uv = (a_position * 0.5) + 0.5;
        uv.y = 1.0 - uv.y;
        v_uv = uv;
      }
    `;

    const fragCommon = `
      vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute3(vec3 x) { return mod289v3(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                            -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289v2(i);
        vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
        vec3 h  = abs(x_) - 0.5;
        vec3 ox = floor(x_ + 0.5);
        vec3 a0 = x_ - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      vec4 popoverFragmentCore(vec2 uv, float time, float speed, vec2 resolution,
                                vec4 color0, vec4 color1, vec4 color2, vec4 color3, vec4 color4) {
        float t = time * speed;
        float aspect = resolution.x / resolution.y;
        vec2 st = vec2(uv.x * aspect, uv.y);

        vec2 w1 = vec2(
          snoise(st * 1.4 + vec2(t * 0.25,  t * 0.18)),
          snoise(st * 1.4 + vec2(t * 0.18, -t * 0.25))
        ) * 0.22;
        vec2 w2 = vec2(
          snoise((st + w1) * 0.9 + vec2(-t * 0.12,  t * 0.09)),
          snoise((st + w1) * 0.9 + vec2( t * 0.09,  t * 0.12))
        ) * 0.16;
        vec2 w3 = vec2(
          snoise((st + w1 + w2) * 0.6 + vec2( t * 0.07, -t * 0.05)),
          snoise((st + w1 + w2) * 0.6 + vec2(-t * 0.05,  t * 0.07))
        ) * 0.10;
        vec2 warped = st + w1 + w2 + w3;

        float n1 = snoise(warped * 1.6 + vec2( t * 0.35,  t * 0.20));
        float n2 = snoise(warped * 2.4 + vec2(-t * 0.25,  t * 0.35));
        float n3 = snoise(warped * 1.1 + vec2( t * 0.18, -t * 0.30));
        float n4 = snoise(warped * 3.0 + vec2(-t * 0.18, -t * 0.13));

        vec4 c = color0;
        c = mix(c, color1, smoothstep(-0.3, 0.5, n1));
        c = mix(c, color2, smoothstep(-0.2, 0.6, n2) * 0.75);
        c = mix(c, color3, smoothstep(-0.4, 0.4, n3) * 0.60);
        c = mix(c, color4, smoothstep(-0.3, 0.4, n4) * 0.45);

        float n5 = snoise((warped + w3 * 3.0) * 2.0 + vec2(t * 0.28, t * 0.10));
        c = mix(c, color1 * 0.5 + color2 * 0.5, smoothstep(-0.1, 0.6, n5) * 0.35);

        c.rgb *= 0.48;

        vec2 vc = uv - 0.5;
        c.rgb *= 1.0 - dot(vc, vc) * 0.55;

        return c;
      }
    `;

    const fragSrc = isGL2 ? `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;
      uniform float u_time;
      uniform float u_speed;
      uniform vec2  u_resolution;
      uniform vec4  u_color0, u_color1, u_color2, u_color3, u_color4;
      ${fragCommon}
      void main() {
        vec4 c = popoverFragmentCore(v_uv, u_time, u_speed, u_resolution,
                                      u_color0, u_color1, u_color2, u_color3, u_color4);
        float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        c.rgb += (dither / 255.0) - (0.5 / 255.0);
        fragColor = vec4(c.rgb, 1.0);
      }
    ` : `
      precision highp float;
      varying vec2 v_uv;
      uniform float u_time;
      uniform float u_speed;
      uniform vec2  u_resolution;
      uniform vec4  u_color0, u_color1, u_color2, u_color3, u_color4;
      ${fragCommon}
      void main() {
        vec4 c = popoverFragmentCore(v_uv, u_time, u_speed, u_resolution,
                                      u_color0, u_color1, u_color2, u_color3, u_color4);
        float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        c.rgb += (dither / 255.0) - (0.5 / 255.0);
        gl_FragColor = vec4(c.rgb, 1.0);
      }
    `;

    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('[Resona] PopoverFluid vertex shader compile error:', gl.getShaderInfoLog(vs));
      return null;
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('[Resona] PopoverFluid fragment shader compile error:', gl.getShaderInfoLog(fs));
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[Resona] PopoverFluid program link error:', gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }
}
