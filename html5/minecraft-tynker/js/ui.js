// ui.js — Now uses uiCanvas (2D only)

(function (global) {
  'use strict';

  const UI = {
    canvas: null,
    ctx: null,
    ready: false,

    selectedBlock: 1,
    hotbarSize: 9,
    hotbarItems: [1,2,3,4,5,6,7,8,9],

    lastFPS: 0,
    frameCounter: 0,
    lastSecond: 0,

    init: function () {
      this.canvas = document.getElementById('uiCanvas');

      if (!this.canvas) {
        console.error("UI.init ERROR: uiCanvas not found");
        return;
      }

      this.ctx = this.canvas.getContext('2d');

      if (!this.ctx) {
        console.error("UI.init ERROR: could not get 2D context");
        return;
      }

      // Set initial size
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      this.ctx.imageSmoothingEnabled = false;

      window.addEventListener('resize', () => {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
      });

      this._setupHotbarInput();
      this.ready = true;

      console.log("UI READY ✔");
    },

    // Hotbar scrolling
    _setupHotbarInput: function () {
      window.addEventListener('wheel', (e) => {
        if (e.deltaY > 0) this.selectedBlock++;
        if (e.deltaY < 0) this.selectedBlock--;

        if (this.selectedBlock < 1) this.selectedBlock = this.hotbarSize;
        if (this.selectedBlock > this.hotbarSize) this.selectedBlock = 1;
      });
    },

    drawCrosshair: function () {
      const c = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      c.strokeStyle = "white";
      c.lineWidth = 2;

      c.beginPath();
      c.moveTo(w/2 - 8, h/2);
      c.lineTo(w/2 + 8, h/2);
      c.stroke();

      c.beginPath();
      c.moveTo(w/2, h/2 - 8);
      c.lineTo(w/2, h/2 + 8);
      c.stroke();
    },

    drawHotbar: function () {
      const c = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;

      const size = 40;
      const startX = w/2 - (this.hotbarSize * size) / 2;
      const y = h - size - 20;

      for (let i = 0; i < this.hotbarSize; i++) {
        const x = startX + i * size;

        // Box
        c.fillStyle = "rgba(0,0,0,0.4)";
        c.fillRect(x, y, size, size);

        // Selected outline
        if (i + 1 === this.selectedBlock) {
          c.strokeStyle = "yellow";
          c.lineWidth = 3;
          c.strokeRect(x, y, size, size);
        }

        // Block ID text
        c.fillStyle = "white";
        c.font = "16px sans-serif";
        c.fillText(this.hotbarItems[i], x + 14, y + 25);
      }
    },

    drawDebug: function () {
      const c = this.ctx;
      c.fillStyle = "white";
      c.font = "14px sans-serif";

      const px = Player.x.toFixed(1);
      const py = Player.y.toFixed(1);
      const pz = Player.z.toFixed(1);

      c.fillText(`XYZ: ${px}, ${py}, ${pz}`, 10, 20);
      c.fillText(`FPS: ${this.lastFPS}`, 10, 40);
    },

    updateFPS: function () {
      const now = performance.now();
      if (now - this.lastSecond > 1000) {
        this.lastFPS = this.frameCounter;
        this.frameCounter = 0;
        this.lastSecond = now;
      }
      this.frameCounter++;
    },

    render: function () {
      if (!this.ready) return;

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.drawCrosshair();
      this.drawHotbar();
      this.drawDebug();
      this.updateFPS();
    }
  };

  global.UI = UI;

})(window);
