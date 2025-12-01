// js/player.js
// Handles player movement, input, camera rotation, and collision.

(function (global) {
  'use strict';

  const Player = {
    x: 0,
    y: 40,
    z: 0,

    velX: 0,
    velY: 0,
    velZ: 0,

    yaw: 0,
    pitch: 0,

    speed: 0.12,
    sensitivity: 0.002,
    gravity: -0.01,
    jumpForce: 0.22,

    onGround: false,
    input: { w:false, a:false, s:false, d:false, space:false },

    init: function () {
      this._setupPointerLock();
      this._setupInput();
    },

    /* ---------------------------------------------------------
       Input setup
    --------------------------------------------------------- */
    _setupInput: function () {
      window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') this.input.w = true;
        if (e.code === 'KeyS') this.input.s = true;
        if (e.code === 'KeyA') this.input.a = true;
        if (e.code === 'KeyD') this.input.d = true;
        if (e.code === 'Space') this.input.space = true;
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') this.input.w = false;
        if (e.code === 'KeyS') this.input.s = false;
        if (e.code === 'KeyA') this.input.a = false;
        if (e.code === 'KeyD') this.input.d = false;
        if (e.code === 'Space') this.input.space = false;
      });
    },

    /* ---------------------------------------------------------
       Mouse look / pointer lock
    --------------------------------------------------------- */
    _setupPointerLock: function () {
      const canvas = document.getElementById('overlay');

      canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
      });

      document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
          document.addEventListener('mousemove', this._mouseMove);
        } else {
          document.removeEventListener('mousemove', this._mouseMove);
        }
      });
    },

    _mouseMove: (e) => {
      Player.yaw   -= e.movementX * Player.sensitivity;
      Player.pitch -= e.movementY * Player.sensitivity;

      // clamp pitch to avoid flipping
      Player.pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, Player.pitch));
    },

    /* ---------------------------------------------------------
       Movement update
    --------------------------------------------------------- */
    update: function () {
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);

      let mx = 0;
      let mz = 0;

      if (this.input.w) { mx += sin; mz += cos; }
      if (this.input.s) { mx -= sin; mz -= cos; }
      if (this.input.a) { mx -= cos; mz += sin; }
      if (this.input.d) { mx += cos; mz -= sin; }

      // normalize diagonal
      const mag = Math.sqrt(mx*mx + mz*mz);
      if (mag > 0) {
        mx /= mag;
        mz /= mag;
      }

      this.velX = mx * this.speed;
      this.velZ = mz * this.speed;

      // gravity
      this.velY += this.gravity;

      // jump
      if (this.onGround && this.input.space) {
        this.velY = this.jumpForce;
        this.onGround = false;
      }

      // apply movement with collision
      this._moveWithCollision();
    },

    /* ---------------------------------------------------------
       Basic collision system
       Uses getBlock from world.js
    --------------------------------------------------------- */
    _moveWithCollision: function () {
      if (!global.World) return;

      let newX = this.x + this.velX;
      let newY = this.y + this.velY;
      let newZ = this.z + this.velZ;

      const feet  = Math.floor(newY);
      const head  = Math.floor(newY + 1.7);

      const blockFeet = World.getBlock(Math.floor(newX), feet, Math.floor(this.z));
      const blockFeetZ = World.getBlock(Math.floor(this.x), feet, Math.floor(newZ));

      // X collision
      if (blockFeet === 0) {
        this.x = newX;
      }

      // Z collision
      if (blockFeetZ === 0) {
        this.z = newZ;
      }

      // Y collision (floor)
      const blockBelow = World.getBlock(Math.floor(this.x), Math.floor(newY), Math.floor(this.z));
      const blockAbove = World.getBlock(Math.floor(this.x), Math.floor(newY + 1.7), Math.floor(this.z));

      if (blockBelow === 0 && blockAbove === 0) {
        this.y = newY;
        this.onGround = false;
      } else {
        if (this.velY < 0) this.onGround = true;
        this.velY = 0;
      }
    },

    /* ---------------------------------------------------------
       Camera direction vector (for raycasting)
    --------------------------------------------------------- */
    getDirection: function () {
      const dx = Math.cos(this.pitch) * Math.sin(this.yaw);
      const dy = Math.sin(this.pitch);
      const dz = Math.cos(this.pitch) * Math.cos(this.yaw);
      return [dx, dy, dz];
    },

    /* ---------------------------------------------------------
       Raycast (block targeting)
    --------------------------------------------------------- */
    raycast: function (maxDist = 5.0) {
      const [dx, dy, dz] = this.getDirection();

      let x = this.x;
      let y = this.y + 1.6; // camera height
      let z = this.z;

      for (let i = 0; i < maxDist * 10; i++) {
        x += dx * 0.1;
        y += dy * 0.1;
        z += dz * 0.1;

        const bx = Math.floor(x);
        const by = Math.floor(y);
        const bz = Math.floor(z);

        const block = World.getBlock(bx, by, bz);
        if (block !== 0) {
          return { x: bx, y: by, z: bz, id: block };
        }
      }
      return null;
    }
  };

  global.Player = Player;

})(window);
