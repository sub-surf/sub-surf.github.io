// js/textures.js
// Generates the block texture atlas + texture coordinates.
// Cleaned & separated from original code.

(function (global) {
  'use strict';

  const Textures = {
    atlasCanvas: null,
    atlasTexture: null,
    tileSize: 16,        // base resolution of each block face
    atlasSize: 16 * 16,  // 16×16 grid of 16px tiles

    textureMap: {},      // { blockId: { top:[x,y], side:[x,y], bottom:[x,y] } }
    uvCache: {},         // cached UV coords per block face
    gl: null,

    /* -------------------------------------------------------
       Create <canvas> atlas and draw all textures into it
    ------------------------------------------------------- */
    init: function () {
      this.atlasCanvas = document.createElement('canvas');
      this.atlasCanvas.width = this.atlasSize;
      this.atlasCanvas.height = this.atlasSize;

      const ctx = this.atlasCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      this._defineTextureMap();
      this._drawBlocks(ctx);
    },

    /* -------------------------------------------------------
       Upload canvas to WebGL as a single texture atlas
    ------------------------------------------------------- */
    uploadToGL: function () {
      if (!global.Engine || !Engine.gl) {
        throw new Error('Engine must be initialized before textures.');
      }

      this.gl = Engine.gl;

      const tex = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        this.atlasCanvas
      );

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

      this.atlasTexture = tex;
      return tex;
    },

    /* -------------------------------------------------------
       Block → texture tile coordinates
    ------------------------------------------------------- */
    _defineTextureMap: function () {
      // You can expand or adjust this based on your original mapping.
      // Cleaned to prevent duplicates.
      this.textureMap = {
        dirt:       { top:[2,0], side:[2,0], bottom:[2,0] },
        grass:      { top:[0,0], side:[1,0], bottom:[2,0] },
        stone:      { top:[3,0], side:[3,0], bottom:[3,0] },
        wood:       { top:[4,0], side:[4,0], bottom:[4,0] },
        planks:     { top:[5,0], side:[5,0], bottom:[5,0] },
        sand:       { top:[6,0], side:[6,0], bottom:[6,0] },
        water:      { top:[7,0], side:[7,0], bottom:[7,0] },
        leaves:     { top:[8,0], side:[8,0], bottom:[8,0] },
        glass:      { top:[9,0], side:[9,0], bottom:[9,0] },

        // extend as needed
      };
    },

    /* -------------------------------------------------------
       Draw the atlas on a canvas
    ------------------------------------------------------- */
    _drawBlocks: function (ctx) {
      const tile = this.tileSize;

      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, this.atlasSize, this.atlasSize);

      for (const key in this.textureMap) {
        const tex = this.textureMap[key];

        this._drawTile(ctx, tex.top,    tile, '#cfcf9c');   // example colors for simplified textures
        this._drawTile(ctx, tex.side,   tile, '#a0a05c');
        this._drawTile(ctx, tex.bottom, tile, '#7a7a40');
      }
    },

    /* -------------------------------------------------------
       Draw a solid-color tile (placeholder-style)
       You can replace with actual pixel-art tiles later.
    ------------------------------------------------------- */
    _drawTile: function (ctx, coord, tile, color) {
      const [x, y] = coord;
      ctx.fillStyle = color;
      ctx.fillRect(x * tile, y * tile, tile, tile);
    },

    /* -------------------------------------------------------
       UV mapping generator for block faces
    ------------------------------------------------------- */
    getUV: function (blockId, face) {
      const key = blockId + '_' + face;
      if (this.uvCache[key]) return this.uvCache[key];

      const map = this.textureMap[blockId];
      if (!map) return [0,0,  1,0,  1,1,  0,1];

      const tile = this.tileSize;
      const [tx, ty] = map[face];

      const u0 = tx * tile / this.atlasSize;
      const v0 = ty * tile / this.atlasSize;
      const u1 = (tx * tile + tile) / this.atlasSize;
      const v1 = (ty * tile + tile) / this.atlasSize;

      // 4 UVs for a quad
      const uv = [u0, v0,  u1, v0,  u1, v1,  u0, v1];
      this.uvCache[key] = uv;
      return uv;
    }
  };

  // Initialize the atlas immediately
  Textures.init();

  // Expose
  global.Textures = Textures;

})(window);
