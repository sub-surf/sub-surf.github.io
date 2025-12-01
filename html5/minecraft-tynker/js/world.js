// js/world.js
// Chunk system, block storage, section mesh building.
// Cleaned and modularized.

(function (global) {
  'use strict';

  /* -------------------------------------------------------
      Constants
  ------------------------------------------------------- */
  const CHUNK_SIZE = 16;
  const SECTION_HEIGHT = 16;
  const WORLD_HEIGHT = 128; // 8 sections

  /* -------------------------------------------------------
      Block IDs
  ------------------------------------------------------- */
  const Blocks = {
    AIR: 0,
    DIRT: 1,
    GRASS: 2,
    STONE: 3,
    WOOD: 4,
    PLANKS: 5,
    SAND: 6,
    WATER: 7,
    LEAVES: 8,
    GLASS: 9,
  };

  const BlockNames = {
    0: "air",
    1: "dirt",
    2: "grass",
    3: "stone",
    4: "wood",
    5: "planks",
    6: "sand",
    7: "water",
    8: "leaves",
    9: "glass",
  };

  /* -------------------------------------------------------
      World object
  ------------------------------------------------------- */
  const World = {
    chunks: {}, // "cx,cz" → chunk object
    gl: null,

    init: function () {
      if (!global.Engine) throw new Error("Engine not initialized before world.");
      this.gl = Engine.gl;
    },

    /* -------------------------------------------------------
         Get or create a chunk
    ------------------------------------------------------- */
    getChunk: function (cx, cz) {
      const key = cx + "," + cz;
      if (!this.chunks[key]) {
        this.chunks[key] = this._createChunk(cx, cz);
      }
      return this.chunks[key];
    },

    _createChunk: function (cx, cz) {
      const sections = [];
      for (let i = 0; i < WORLD_HEIGHT / SECTION_HEIGHT; i++) {
        sections.push(this._createSection());
      }
      return { cx, cz, sections };
    },

    _createSection: function () {
      // 16 × 16 × 16 = 4096 blocks per section
      return {
        blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * SECTION_HEIGHT),
        mesh: null,
        vertexBuffer: null,
        vertexCount: 0
      };
    },

    /* -------------------------------------------------------
         Get block
    ------------------------------------------------------- */
    getBlock: function (x, y, z) {
      if (y < 0 || y >= WORLD_HEIGHT) return Blocks.AIR;

      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const chunk = this.getChunk(cx, cz);

      const lx = x & 15;
      const lz = z & 15;
      const sectionIndex = Math.floor(y / SECTION_HEIGHT);
      const sy = y & 15;

      const section = chunk.sections[sectionIndex];
      const idx = lx + (sy * CHUNK_SIZE) + (lz * CHUNK_SIZE * SECTION_HEIGHT);

      return section.blocks[idx];
    },

    /* -------------------------------------------------------
         Set block
    ------------------------------------------------------- */
    setBlock: function (x, y, z, block) {
      if (y < 0 || y >= WORLD_HEIGHT) return;

      const cx = Math.floor(x / CHUNK_SIZE);
      const cz = Math.floor(z / CHUNK_SIZE);
      const chunk = this.getChunk(cx, cz);

      const lx = x & 15;
      const lz = z & 15;
      const sectionIndex = Math.floor(y / SECTION_HEIGHT);
      const sy = y & 15;

      const section = chunk.sections[sectionIndex];
      const idx = lx + (sy * CHUNK_SIZE) + (lz * CHUNK_SIZE * SECTION_HEIGHT);

      section.blocks[idx] = block;
      section.mesh = null; // mark mesh dirty
    },

    /* -------------------------------------------------------
         Simple world generation (flat + grass/dirt)
         Replace with noise later if needed.
    ------------------------------------------------------- */
    generateChunk: function (cx, cz) {
      const chunk = this.getChunk(cx, cz);

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x;
            const wz = cz * CHUNK_SIZE + z;

            // Simple flat world at height 32
            const height = 32;

            let block = Blocks.AIR;
            if (y === height) block = Blocks.GRASS;
            else if (y < height && y > height - 3) block = Blocks.DIRT;
            else if (y < height - 3) block = Blocks.STONE;

            this.setBlock(wx, y, wz, block);
          }
        }
      }
    },

    /* -------------------------------------------------------
         Mesh builder for each section
    ------------------------------------------------------- */
    buildSectionMesh: function (section, cx, cy, cz) {
      if (section.mesh !== null) return; // already built

      const verts = [];
      const gl = this.gl;

      const pushQuad = (vx) => verts.push(...vx);

      const worldX = cx * CHUNK_SIZE;
      const worldY = cy * SECTION_HEIGHT;
      const worldZ = cz * CHUNK_SIZE;

      const getBlock = this.getBlock.bind(this);

      // Loop through section blocks
      for (let sy = 0; sy < SECTION_HEIGHT; sy++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = worldX + x;
            const wy = worldY + sy;
            const wz = worldZ + z;

            const id = getBlock(wx, wy, wz);
            if (id === Blocks.AIR) continue;

            const name = BlockNames[id];
            const isTransparent = (name === "glass" || name === "water");

            // For each face: if neighbor is air, create face quad
            const faces = [
              ["top",    0,  1,  0,   0,1],
              ["bottom", 0, -1,  0,   0,-1],
              ["north",  0,  0, -1,   0,0],
              ["south",  0,  0,  1,   0,0],
              ["west",  -1,  0,  0,   0,0],
              ["east",   1,  0,  0,   0,0]
            ];

            for (const f of faces) {
              const [face, ox, oy, oz] = f;

              const neighbor = getBlock(wx + ox, wy + oy, wz + oz);

              // Only show face if neighbor is air or transparent vs solid rules
              if (neighbor === Blocks.AIR || (!isTransparent && BlockNames[neighbor] === "glass")) {
                const uv = Textures.getUV(name, face === "top" ? "top"
                                              : face === "bottom" ? "bottom"
                                              : "side");

                pushQuad(makeFace(face, wx, wy, wz, uv));
              }
            }
          }
        }
      }

      section.vertexCount = verts.length / 6; // each vertex = [x,y,z,u,v,shadow]
      section.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, section.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);

      section.mesh = true; // built
    },

    /* -------------------------------------------------------
         Build all sections for a chunk
    ------------------------------------------------------- */
    buildChunkMeshes: function (cx, cz) {
      const chunk = this.getChunk(cx, cz);
      for (let i = 0; i < chunk.sections.length; i++) {
        this.buildSectionMesh(chunk.sections[i], cx, i, cz);
      }
      return chunk;
    }
  };

  /* -------------------------------------------------------
      Face-building helper
      Returns 6 vertices (2 triangles) with UVs
  ------------------------------------------------------- */
  function makeFace(face, x, y, z, uv) {
    // Works with cube faces 1×1×1
    const s = 1;
    const [u0,v0, u1,v1] = uv;

    switch (face) {
      case "top":
        return [
          x, y+s, z,   u0,v1, 1,
          x+s, y+s, z,   u1,v1, 1,
          x+s, y+s, z+s, u1,v0, 1,

          x, y+s, z,   u0,v1, 1,
          x+s, y+s, z+s, u1,v0, 1,
          x, y+s, z+s, u0,v0, 1
        ];
      case "bottom":
        return [
          x, y, z,     u0,v1, 1,
          x+s, y, z+s, u1,v0, 1,
          x+s, y, z,   u1,v1, 1,

          x, y, z,     u0,v1, 1,
          x, y, z+s,   u0,v0, 1,
          x+s, y, z+s, u1,v0, 1
        ];
      case "north":
        return [
          x,   y,   z,     u0,v1, 1,
          x+s, y+s, z,     u1,v0, 1,
          x+s, y,   z,     u1,v1, 1,

          x,   y,   z,     u0,v1, 1,
          x,   y+s, z,     u0,v0, 1,
          x+s, y+s, z,     u1,v0, 1
        ];
      case "south":
        return [
          x,   y,   z+s,   u0,v1, 1,
          x+s, y,   z+s,   u1,v1, 1,
          x+s, y+s, z+s,   u1,v0, 1,

          x,   y,   z+s,   u0,v1, 1,
          x+s, y+s, z+s,   u1,v0, 1,
          x,   y+s, z+s,   u0,v0, 1
        ];
      case "west":
        return [
          x,   y,   z,     u0,v1, 1,
          x,   y+s, z+s,   u1,v0, 1,
          x,   y,   z+s,   u1,v1, 1,

          x,   y,   z,     u0,v1, 1,
          x,   y+s, z,     u0,v0, 1,
          x,   y+s, z+s,   u1,v0, 1
        ];
      case "east":
        return [
          x+s, y,   z,     u0,v1, 1,
          x+s, y,   z+s,   u1,v1, 1,
          x+s, y+s, z+s,   u1,v0, 1,

          x+s, y,   z,     u0,v1, 1,
          x+s, y+s, z+s,   u1,v0, 1,
          x+s, y+s, z,     u0,v0, 1
        ];
    }
  }

  /* -------------------------------------------------------
      Expose
  ------------------------------------------------------- */
  global.Blocks = Blocks;
  global.World = World;

})(window);
