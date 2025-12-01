// js/engine.js
// Core WebGL engine, shader helpers, typed-array helpers, basic model/view utilities.
// Cleaned & modularized from the original index.html file.

(function (global) {
  'use strict';

  /* ---------- Typed array helpers (centralized) ---------- */
  const newFloat32Array = (arr) => new Float32Array(arr);
  const newInt32Array = (arr) => new Int32Array(arr);
  const newUint32Array = (arr) => new Uint32Array(arr);
  const newUint16Array = (arr) => new Uint16Array(arr);
  const newUint8Array = (arr) => new Uint8Array(arr);

  /* ---------- Canvas & GL context initialization ---------- */
  function initCanvas(canvasId = 'overlay') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error(`Canvas #${canvasId} not found`);
    // Resize to window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return canvas;
  }

  function getGL(canvas, options = {}) {
    // try WebGL context
    const gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
    if (!gl) {
      throw new Error('WebGL not supported in this browser');
    }
    // default clear color and enable depth test (others will be configured by engine)
    gl.clearColor(0.3, 0.6, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    return gl;
  }

  /* ---------- Shader source strings (extracted & cleaned) ---------- */
  const vertexShaderSrc3D = [
    'attribute vec3 aVertex;',
    'attribute vec2 aTexture;',
    'attribute float aShadow;',
    'varying   vec2 vTexture;',
    'varying float vShadow;',
    'uniform mat4 uView;',
    'void main(void) {',
    '  vTexture = aTexture;',
    '  vShadow = aShadow > 0.0 ? aShadow : 1.0;',
    '  gl_Position = uView * vec4(aVertex, 1.0);',
    '}'
  ].join('\n');

  const fragmentShaderSrc3D = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    '  precision highp float;',
    '#else',
    '  precision mediump float;',
    '#endif',
    'varying float vShadow;',
    'uniform sampler2D uSampler;',
    'varying vec2 vTexture;',
    'void main(void){',
    '  vec4 color = texture2D(uSampler, vTexture);',
    '  gl_FragColor = vec4(color.rgb * vShadow, color.a);',
    '  if (gl_FragColor.a == 0.0) discard;',
    '}'
  ].join('\n');

  // Simple textured 2D/quad shader (used for HUD/icons if needed)
  const vertexShaderSrc2D = [
    'attribute vec3 aVertex;',
    'attribute vec2 aTexture;',
    'varying vec2 vTexture;',
    'uniform mat4 uView;',
    'void main(void) {',
    '  vTexture = aTexture;',
    '  gl_Position = uView * vec4(aVertex, 1.0);',
    '}'
  ].join('\n');

  const fragmentShaderSrc2D = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    '  precision highp float;',
    '#else',
    '  precision mediump float;',
    '#endif',
    'varying vec2 vTexture;',
    'uniform sampler2D uSampler;',
    'void main(void) {',
    '  vec4 color = texture2D(uSampler, vTexture);',
    '  if (color.a == 0.0) discard;',
    '  gl_FragColor = color;',
    '}'
  ].join('\n');

  /* ---------- Shader compile / program helpers ---------- */
  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Could not compile shader:\n' + info);
    }
    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const v = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const f = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Error linking program:\n' + info);
    }
    return program;
  }

  /* ---------- GL attribute/uniform cache utility ---------- */
  function cacheProgramLocations(gl, program, descriptors) {
    // descriptors: { attribs: ['aVertex','aTexture','aShadow'], uniforms: ['uView','uSampler'] }
    const locations = { attrib: {}, uniform: {} };
    if (descriptors.attribs) {
      descriptors.attribs.forEach((a) => {
        locations.attrib[a] = gl.getAttribLocation(program, a);
      });
    }
    if (descriptors.uniforms) {
      descriptors.uniforms.forEach((u) => {
        locations.uniform[u] = gl.getUniformLocation(program, u);
      });
    }
    return locations;
  }

  /* ---------- Simple matrix helpers (minimalist; enough for view/projection) ---------- */
  // 4x4 column-major matrices used as Float32Array(16)
  function identityMatrix() {
    return newFloat32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }

  function multiplyMatrix(a, b) {
    // Multiply a * b (both Float32Array[16]) => out Float32Array[16]
    const out = new Float32Array(16);
    for (let r=0; r<4; r++) {
      for (let c=0; c<4; c++) {
        let v = 0;
        for (let k=0; k<4; k++) {
          v += a[k*4 + r] * b[c*4 + k]; // note column-major layout
        }
        out[c*4 + r] = v;
      }
    }
    return out;
  }

  function ortho(left, right, bottom, top, near, far) {
    const lr = 1.0 / (left - right);
    const bt = 1.0 / (bottom - top);
    const nf = 1.0 / (near - far);
    const out = identityMatrix();
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    return out;
  }

  /* ---------- Engine object & state ---------- */
  const Engine = {
    canvas: null,
    gl: null,
    programs: {},
    glCache: {},
    viewportWidth: 0,
    viewportHeight: 0,

    init: function (opts = {}) {
      // opts: { canvasId }
      this.canvas = initCanvas(opts.canvasId || 'overlay');
      this.gl = getGL(this.canvas, opts.contextAttributes || { alpha: false, antialias: false });
      this.viewportWidth = this.canvas.width;
      this.viewportHeight = this.canvas.height;

      // Create shader programs
      this.programs.program3D = createProgram(this.gl, vertexShaderSrc3D, fragmentShaderSrc3D);
      this.gl.useProgram(this.programs.program3D);
      this.glCache.program3D = cacheProgramLocations(this.gl, this.programs.program3D, {
        attribs: ['aVertex','aTexture','aShadow'],
        uniforms: ['uView','uSampler']
      });

      this.programs.program2D = createProgram(this.gl, vertexShaderSrc2D, fragmentShaderSrc2D);
      this.gl.useProgram(this.programs.program2D);
      this.glCache.program2D = cacheProgramLocations(this.gl, this.programs.program2D, {
        attribs: ['aVertex','aTexture'],
        uniforms: ['uView','uSampler']
      });

      // Set some default GL state
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
      this.gl.activeTexture(this.gl.TEXTURE0);

      // Prepare a default projection/view matrix for convenience (can be replaced by other modules)
      const aspect = this.viewportWidth / this.viewportHeight;
      this.defaultView = identityMatrix(); // caller can set a proper matrix
      this.projection = identityMatrix();

      // small convenience functions attached
      this.resize = this._resize.bind(this);
      window.addEventListener('resize', this.resize);

      return this;
    },

    _resize: function () {
      if (!this.canvas) return;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.viewportWidth = this.canvas.width;
      this.viewportHeight = this.canvas.height;
      this.gl.viewport(0, 0, this.viewportWidth, this.viewportHeight);
    },

    createBuffer: function (data, usage) {
      const buf = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buf);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, usage || this.gl.STATIC_DRAW);
      return buf;
    },

    updateBuffer: function (buffer, data) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.DYNAMIC_DRAW);
    },

    // Sets up attribute pointers for a given program cache
    enableAttributes: function (programKey, strideBytes = 24) {
      const cache = this.glCache[programKey];
      if (!cache) return;
      // aVertex: vec3 (float), aTexture: vec2 (float), aShadow: float
      const locVertex = cache.attrib['aVertex'];
      const locTexture = cache.attrib['aTexture'];
      const locShadow = cache.attrib['aShadow'];
      if (locVertex >= 0) {
        this.gl.vertexAttribPointer(locVertex, 3, this.gl.FLOAT, false, strideBytes, 0);
        this.gl.enableVertexAttribArray(locVertex);
      }
      if (typeof locTexture !== 'undefined' && locTexture >= 0) {
        this.gl.vertexAttribPointer(locTexture, 2, this.gl.FLOAT, false, strideBytes, 12);
        this.gl.enableVertexAttribArray(locTexture);
      }
      if (typeof locShadow !== 'undefined' && locShadow >= 0) {
        this.gl.vertexAttribPointer(locShadow, 1, this.gl.FLOAT, false, strideBytes, 20);
        this.gl.enableVertexAttribArray(locShadow);
      }
    },

    useProgram: function (key) {
      const prog = this.programs[key];
      if (!prog) throw new Error('Program not found: ' + key);
      this.gl.useProgram(prog);
      return prog;
    },

    // Convenience to bind texture unit 0 to sampler uniform
    bindTextureToSampler: function (programKey, samplerUniformName, texture) {
      this.useProgram(programKey);
      const loc = this.glCache[programKey].uniform[samplerUniformName];
      if (loc) {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.uniform1i(loc, 0);
      }
    },

    // A very small helper to set the view matrix uniform
    setViewMatrix: function (programKey, viewMatrix) {
      const loc = this.glCache[programKey].uniform['uView'];
      if (loc) {
        this.gl.uniformMatrix4fv(loc, false, viewMatrix);
      }
    },

    /* Expose typed-array helpers too */
    helpers: {
      newFloat32Array, newInt32Array, newUint8Array, newUint16Array, newUint32Array
    }
  };

  // Expose engine to global
  global.Engine = Engine;

})(window);
