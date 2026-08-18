/* shared background tuner for APPETITE
   press E on a page to open its tune window; every page remembers its own choice.
   modes:
     dither — retro grain tile, still
     live   — the kitchen-style living pixels: they breathe, drift, and stir around the cursor
     raw    — the photograph as-is
     off    — plain color */

function initBgTune(cfg) {
  const BAYER = [ [0,8,2,10], [12,4,14,6], [3,11,1,9], [15,7,13,5] ];
  const TONES = {
    paper: [232, 230, 225],
    dusk:  [96, 90, 74],
    warm:  [64, 48, 35],
    night: [30, 28, 21]
  };
  const MISSING = [12, 16, 63, 73];
  const NUMS = Array.from({length: 92}, (_, i) => i + 1).filter(n => !MISSING.includes(n));

  const state = Object.assign(
    { photo: 33, mode: 'dither', tone: 'paper', tile: 420, levels: 6, mix: 40, dim: 30, grain: 6, drift: 12, pos: 30 },
    cfg.defaults || {}
  );
  try { Object.assign(state, JSON.parse(localStorage.getItem(cfg.key)) || {}); } catch (e) {}

  function save() { localStorage.setItem(cfg.key, JSON.stringify(state)); }

  let applyTimer = null;
  function applySoon() { clearTimeout(applyTimer); applyTimer = setTimeout(apply, 120); }

  /* ---------- live mode machinery ---------- */
  let live = null;
  let mouseX = -999, mouseY = -999, easeX = -999, easeY = -999;
  window.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; });

  function stopLive() {
    if (live) { live.canvas.remove(); live = null; }
  }

  function sizeLive() {
    if (!live) return;
    const p = Math.max(3, state.grain);
    live.canvas.width = Math.ceil(window.innerWidth / p);
    live.canvas.height = Math.ceil(window.innerHeight / p);
    live.out = live.ctx.createImageData(live.canvas.width, live.canvas.height);
  }
  window.addEventListener('resize', sizeLive);

  function liveLoop() {
    if (live && state.mode === 'live' && live.out) {
      easeX += (mouseX - easeX) * 0.06;
      easeY += (mouseY - easeY) * 0.06;
      const t = performance.now() / 1000;
      const {tile, canvas, ctx, out} = live;
      const W = canvas.width, H = canvas.height;
      const p = Math.max(3, state.grain);
      const wob = state.drift / 10;
      const mcx = easeX / p, mcy = easeY / p;
      const R = 26;
      const L = state.levels - 1;
      const o = out.data;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let dx = Math.sin(x * 0.06 + t * 0.5 + y * 0.045) * wob;
          let dy = Math.cos(x * 0.05 - t * 0.4 + y * 0.07) * wob;
          const ddx = x - mcx, ddy = y - mcy;
          const dist = Math.sqrt(ddx*ddx + ddy*ddy);
          if (dist < R && dist > 0.01) {
            const push = (1 - dist / R) * 2.2;
            dx += ddx / dist * push;
            dy += ddy / dist * push;
          }
          const sx = ((Math.round(x + dx) % tile.w) + tile.w) % tile.w;
          const sy = ((Math.round(y + dy) % tile.h) + tile.h) % tile.h;
          const si = (sy * tile.w + sx) * 4;
          const oi = (y * W + x) * 4;
          const bt = (BAYER[y % 4][x % 4] + 0.5) / 16 - 0.5;
          for (let ch = 0; ch < 3; ch++) {
            let q = Math.round(tile.data[si + ch] / 255 * L + bt);
            q = q < 0 ? 0 : (q > L ? L : q);
            o[oi + ch] = q / L * 255;
          }
          o[oi + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    }
    requestAnimationFrame(liveLoop);
  }
  requestAnimationFrame(liveLoop);

  /* ---------- apply the chosen backdrop ---------- */
  function smoothTile(img) {
    const w = 190, h = Math.round(w * img.naturalHeight / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h);
    const tone = TONES[state.tone] || TONES.paper;
    const mix = state.mix / 100;
    for (let i = 0; i < d.data.length; i += 4) {
      for (let ch = 0; ch < 3; ch++) {
        d.data[i + ch] = d.data[i + ch] * (1 - mix) + tone[ch] * mix;
      }
    }
    return { canvas: c, ctx: x, imageData: d, w, h };
  }

  function apply() {
    const body = document.body;
    stopLive();
    if (state.mode === 'flat') {
      body.style.backgroundImage = 'none';
      save(); return;
    }
    const img = new Image();
    img.onload = () => {
      if (state.mode === 'raw') {
        body.style.backgroundImage =
          `linear-gradient(rgba(10,9,7,${state.dim / 100}), rgba(10,9,7,${state.dim / 100})), url("${img.src}")`;
        body.style.backgroundSize = 'cover';
        // frame slider decides which part of the photo survives the crop
        body.style.backgroundPosition = `center ${state.pos}%`;
        body.style.backgroundRepeat = 'no-repeat';
        return;
      }
      if (state.mode === 'live') {
        const t = smoothTile(img);
        const canvas = document.createElement('canvas');
        canvas.id = 'bgLiveCanvas';
        /* z-index 0, not -1: body's own background paints over negative-z children */
        canvas.style.cssText =
          'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;image-rendering:pixelated;pointer-events:none;';
        document.body.prepend(canvas);
        live = { tile: { data: t.imageData.data, w: t.w, h: t.h }, canvas, ctx: canvas.getContext('2d'), out: null };
        sizeLive();
        body.style.backgroundImage = 'none';
        return;
      }
      // still dither: quantize the smooth tile once and tile it
      const t = smoothTile(img);
      const d = t.imageData;
      const L = state.levels;
      for (let yy = 0; yy < t.h; yy++) {
        for (let xx = 0; xx < t.w; xx++) {
          const i = (yy * t.w + xx) * 4;
          const bt = (BAYER[yy % 4][xx % 4] + 0.5) / 16 - 0.5;
          for (let ch = 0; ch < 3; ch++) {
            let q = Math.round(d.data[i + ch] / 255 * (L - 1) + bt);
            q = q < 0 ? 0 : (q > L - 1 ? L - 1 : q);
            d.data[i + ch] = q / (L - 1) * 255;
          }
        }
      }
      t.ctx.putImageData(d, 0, 0);
      body.style.backgroundImage = `url(${t.canvas.toDataURL()})`;
      body.style.backgroundSize = state.tile + 'px auto';
      body.style.backgroundPosition = '0 0';
      body.style.backgroundRepeat = 'repeat';
    };
    img.src = `img/web/image-${state.photo}.jpg`;
    save();
  }

  /* ---------- panel ---------- */
  const style = document.createElement('style');
  style.textContent = `
    #bgTunePanel {
      position: fixed; right: 18px; bottom: 44px;
      width: 236px;
      background: #e8e6e1; color: #333;
      border: 1.5px solid #111;
      box-shadow: 3px 3px 0 rgba(0,0,0,0.5);
      font-family: "Courier New", Courier, monospace;
      z-index: 500;
      display: none;
      image-rendering: auto;
    }
    body.bgtune-open #bgTunePanel { display: block; }
    #bgTunePanel .tbar {
      height: 20px; border-bottom: 1.5px solid #111;
      background: repeating-linear-gradient(180deg, #e8e6e1 0 2px, #8f8c84 2px 3px, #e8e6e1 3px 5px);
      display: flex; align-items: center; padding: 0 6px;
    }
    #bgTunePanel .tbar span {
      font-size: 10px; letter-spacing: 2px; background: #e8e6e1; padding: 0 8px; margin: 0 auto;
    }
    #bgTunePanel .tbody { padding: 10px 12px; }
    #bgTunePanel .trow {
      display: grid; grid-template-columns: 46px 1fr 26px;
      align-items: center; gap: 6px; margin-bottom: 6px;
    }
    #bgTunePanel label { font-size: 9px; letter-spacing: 1px; color: #555; }
    #bgTunePanel input[type="range"] { width: 100%; accent-color: #111; }
    #bgTunePanel .tval { font-size: 9px; color: #555; text-align: right; }
    #bgTunePanel .tbtns { display: flex; gap: 4px; grid-column: 2 / 4; flex-wrap: wrap; }
    #bgTunePanel .tbtns button {
      font-family: inherit; font-size: 9px; letter-spacing: 1px;
      padding: 3px 7px; border: 1px solid #111; background: #e8e6e1; color: #333; cursor: pointer;
    }
    #bgTunePanel .tbtns button.on { background: #111; color: #e8e6e1; }
    #bgTunePanel .stepper { display: flex; gap: 8px; align-items: center; justify-content: flex-end; grid-column: 2 / 4; font-size: 10px; }
    #bgTunePanel .stepper button {
      font-family: inherit; font-size: 9px; border: 1px solid #111; background: #e8e6e1;
      width: 20px; height: 16px; cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'bgTunePanel';
  panel.innerHTML = `
    <div class="tbar"><span>backdrop.cpl</span></div>
    <div class="tbody">
      <div class="trow"><label>photo</label>
        <span class="stepper"><button data-s="-1">◀</button><span class="pnum"></span><button data-s="1">▶</button></span>
      </div>
      <div class="trow"><label>mode</label>
        <span class="tbtns" data-group="mode">
          <button data-v="dither">dither</button><button data-v="live">live</button><button data-v="raw">raw</button><button data-v="flat">off</button>
        </span>
      </div>
      <div class="trow"><label>tone</label>
        <span class="tbtns" data-group="tone">
          <button data-v="paper">paper</button><button data-v="dusk">dusk</button><button data-v="warm">warm</button><button data-v="night">night</button>
        </span>
      </div>
      <div class="trow"><label>scale</label><input type="range" data-k="tile" min="240" max="760" step="20"><span class="tval"></span></div>
      <div class="trow"><label>grain</label><input type="range" data-k="grain" min="3" max="12" step="1"><span class="tval"></span></div>
      <div class="trow"><label>tones</label><input type="range" data-k="levels" min="3" max="8" step="1"><span class="tval"></span></div>
      <div class="trow"><label>mix</label><input type="range" data-k="mix" min="0" max="70" step="2"><span class="tval"></span></div>
      <div class="trow"><label>drift</label><input type="range" data-k="drift" min="0" max="30" step="1"><span class="tval"></span></div>
      <div class="trow"><label>dim</label><input type="range" data-k="dim" min="0" max="70" step="2"><span class="tval"></span></div>
      <div class="trow"><label>frame</label><input type="range" data-k="pos" min="0" max="100" step="5"><span class="tval"></span></div>
    </div>
  `;
  document.body.appendChild(panel);

  function refresh() {
    panel.querySelector('.pnum').textContent = state.photo;
    panel.querySelectorAll('.tbtns').forEach(g => {
      const group = g.dataset.group;
      g.querySelectorAll('button').forEach(b => b.classList.toggle('on', state[group] === b.dataset.v));
    });
    panel.querySelectorAll('input[type="range"]').forEach(inp => {
      inp.value = state[inp.dataset.k];
      inp.parentNode.querySelector('.tval').textContent = inp.value;
    });
  }
  refresh();

  panel.querySelectorAll('.stepper button').forEach(b => {
    b.addEventListener('click', () => {
      const i = NUMS.indexOf(state.photo);
      state.photo = NUMS[(i + (+b.dataset.s) + NUMS.length) % NUMS.length];
      refresh(); applySoon();
    });
  });
  panel.querySelectorAll('.tbtns button').forEach(b => {
    b.addEventListener('click', () => {
      state[b.parentNode.dataset.group] = b.dataset.v;
      refresh(); applySoon();
    });
  });
  panel.querySelectorAll('input[type="range"]').forEach(inp => {
    inp.addEventListener('input', () => {
      state[inp.dataset.k] = +inp.value;
      inp.parentNode.querySelector('.tval').textContent = inp.value;
      // grain changes only need a canvas resize when live
      if (inp.dataset.k === 'grain' && state.mode === 'live' && live) { sizeLive(); save(); return; }
      if (inp.dataset.k === 'drift' && state.mode === 'live') { save(); return; }
      applySoon();
    });
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'e' || e.key === 'E') document.body.classList.toggle('bgtune-open');
  });

  apply();
}
