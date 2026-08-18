/* APPETITE sound: everything synthesized live, nothing recorded.
   little machine noises — typing ticks, cuts, chews, water —
   plus a very low room drone that differs from page to page.
   browsers only allow audio after a user gesture, so the kitchen
   hums to life at the first click. */

(function () {
  let ctx = null, master = null;
  let enabled = localStorage.getItem('appetite-v2-sound') !== 'off';
  let roomStarted = false, waterStarted = false;

  /* which room hums at which pitch */
  const path = location.pathname;
  const ROOM = path.includes('dialog') ? 82
    : path.includes('cabinet') ? 87
    : path.includes('kitchen') ? 110
    : path.includes('receipt') ? 73
    : path.includes('dining') ? 98
    : path.includes('aquarium') ? 65
    : 110; /* entry */
  const WATER = path.includes('aquarium');

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ctx.createGain();
      master.gain.value = enabled ? 1 : 0;
      master.connect(ctx.destination);
      startRoom();
      if (WATER) startWater();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  window.addEventListener('pointerdown', ensure);
  window.addEventListener('keydown', ensure);

  function tone(freq, dur, type, vol, glideTo) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function crunch(dur, vol, freq) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  function startRoom() {
    if (roomStarted || !ctx) return;
    roomStarted = true;
    const g = ctx.createGain(); g.gain.value = 0.012; g.connect(master);
    [ROOM, ROOM * 1.5 + 1.3].forEach(fr => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      o.connect(g); o.start();
    });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.005;
    lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
  }

  function startWater() {
    if (waterStarted || !ctx) return;
    waterStarted = true;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = 0.028;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 160;
    lfo.connect(lfoG); lfoG.connect(f.frequency); lfo.start();
    setInterval(() => {
      if (Math.random() < 0.5) tone(240 + Math.random() * 120, 0.16, 'sine', 0.02, 620 + Math.random() * 300);
    }, 2400);
  }

  window.sfx = {
    type()  { tone(1300 + Math.random() * 700, 0.028, 'square', 0.012); },
    click() { tone(680, 0.045, 'square', 0.028); tone(1020, 0.03, 'square', 0.016); },
    cut()   { tone(175, 0.06, 'sine', 0.1, 58); tone(2500, 0.012, 'square', 0.02); crunch(0.045, 0.05, 2600); },
    punch() { crunch(0.06, 0.1, 1200); tone(160, 0.1, 'sine', 0.05, 80); },
    plop()  { tone(280, 0.13, 'sine', 0.06, 88); },
    chew()  { crunch(0.05, 0.11, 800 + Math.random() * 300); },
    print() { tone(2100 + Math.random() * 300, 0.018, 'square', 0.014); },
    toggle() {
      enabled = !enabled;
      localStorage.setItem('appetite-v2-sound', enabled ? 'on' : 'off');
      if (master) master.gain.value = enabled ? 1 : 0;
      return enabled;
    },
    isOn() { return enabled; }
  };

  /* gentle click on every button and link */
  document.addEventListener('click', e => {
    if (e.target.closest('button, a')) window.sfx.click();
  }, true);

  /* the little speaker in the status bar */
  function addToggle() {
    const status = document.getElementById('status');
    if (!status) return;
    const s = document.createElement('span');
    s.style.cssText = 'cursor:pointer;margin-left:14px;user-select:none;';
    s.textContent = enabled ? '♪ on' : '♪ off';
    s.addEventListener('click', () => { s.textContent = window.sfx.toggle() ? '♪ on' : '♪ off'; });
    status.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addToggle);
  else addToggle();
})();
