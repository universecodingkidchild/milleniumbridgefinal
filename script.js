/* ===== The Wobble · slideshow engine + bridge simulation ===== */
(() => {
  "use strict";

  /* ---------- slideshow ---------- */
  const slides = [...document.querySelectorAll('.slide')];
  const n = slides.length;
  const dots = document.getElementById('dots');
  const $ = id => document.getElementById(id);
  let i = 0;

  slides.forEach((_, k) => {
    const d = document.createElement('i');
    d.onclick = () => go(k);
    dots.appendChild(d);
  });
  const di = [...dots.children];

  function go(k) {
    i = Math.max(0, Math.min(n - 1, k));
    slides.forEach((s, x) => s.classList.toggle('active', x === i));
    di.forEach((d, x) => d.classList.toggle('on', x === i));
    $('count').textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
    $('bar').style.width = ((i + 1) / n * 100) + '%';
    $('partlbl').innerHTML = slides[i].dataset.part || '';
  }
  const next = () => i < n - 1 && go(i + 1);
  const prev = () => i > 0 && go(i - 1);

  $('nextB').onclick = next;
  $('prev').onclick = prev;

  addEventListener('keydown', e => {
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
    else if (e.key === 'f' || e.key === 'F') toggleFs();
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
  });

  // click-to-advance disabled: only arrow keys / on-screen arrows / dots change slides

  function toggleFs() {
    document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  }
  $('fsBtn').onclick = toggleFs;

  // glossary terms: tap to toggle on touch devices
  document.querySelectorAll('.term').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.term.open').forEach(t => { if (t !== el) t.classList.remove('open'); });
      el.classList.toggle('open');
    });
  });

  go(0);

  /* ---------- bridge simulation ---------- */
  const cv = $('c');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height, midY = H / 2;

  // physics constants (teaching model, tuned to match Arup's findings)
  const f0 = 0.49, w0 = 2 * Math.PI * f0;   // natural frequency of the deck
  const Nc0 = 166;                           // critical crowd (real value, Dallard 2001)
  const kGrow = 0.045;                        // growth-rate scale
  const resBW = 0.10;                         // resonance bandwidth (Hz)
  const AREF = 0.012, CAP = 0.075;            // sync ref / display cap (m)
  const PXM = 1150;                          // metres -> pixels (display)

  let A = 0.0006, ph = 0, x = 0, R = 0;      // sway amplitude (m), phase, display x, sync
  let fStep = 0.95, nP = 180, damped = false, walkers = [];
  const C = { paper: '#e3d7c2', ink: '#181410', red: '#d9341c', rule: '#c3b69c' };

  function build(m) {
    walkers = [];
    for (let j = 0; j < m; j++) walkers.push({
      u: Math.random(), phase: Math.random() * 6.28,
      lane: (Math.random() - .5) * 48, sp: .018 + Math.random() * .013
    });
  }
  build(nP);

  $('freq').oninput = e => { fStep = +e.target.value; $('freqV').textContent = fStep.toFixed(2); };
  $('ppl').oninput = e => { nP = +e.target.value; $('pplV').textContent = nP; build(nP); };
  $('dOff').onclick = () => { damped = false; $('dOff').classList.add('on'); $('dOn').classList.remove('on', 'green'); };
  $('dOn').onclick = () => { damped = true; $('dOn').classList.add('on', 'green'); $('dOff').classList.remove('on'); };

  // one integration substep
  function stp(dt) {
    const ws = 2 * Math.PI * fStep;
    // resonance proximity: 1 when step-freq matches the bridge, ~0 when far off
    const res = Math.exp(-Math.pow((fStep - f0) / resBW, 2));
    // critical crowd: dampers push it out of reach
    const Nc = damped ? 1e6 : Nc0;
    // energy balance: above the critical crowd at resonance the sway grows, else decays
    const rate = kGrow * (nP * res - Nc);
    A += A * rate * dt;
    if (A < 0.0004) A = 0.0004;             // small floor so it can recover
    if (A > CAP) A = CAP;                    // display cap
    ph += w0 * dt;                           // deck oscillates at its natural frequency
    x = A * Math.sin(ph);
    // sync (visual): walkers lock in as the sway grows at resonance
    const Rt = res * Math.min(A / AREF, 1);
    R += (Rt - R) * 2.5 * dt;
    for (const p of walkers) {
      p.phase += ws * dt + 2.6 * R * Math.sin(ph - p.phase) * dt;  // pull toward deck motion
      p.u += p.sp * dt;
      if (p.u > 1.05) { p.u = -0.05; p.lane = (Math.random() - .5) * 48; }
    }
    return A;
  }

  // crowd sync level (0..1)
  function sync() { return R; }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    // water hatch
    ctx.strokeStyle = '#b9ad92'; ctx.lineWidth = 1; ctx.globalAlpha = .5;
    for (let yy = 8; yy < H; yy += 11) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    ctx.globalAlpha = 1;

    const dy = x * PXM, deckY = midY + dy, dH = 48;
    // banks
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, 44, H); ctx.fillRect(W - 44, 0, 44, H);
    ctx.fillStyle = C.paper; ctx.font = "600 8px 'IBM Plex Mono',monospace";
    ctx.save(); ctx.translate(15, H - 10); ctx.rotate(-Math.PI / 2); ctx.fillText("ST PAUL'S", 0, 0); ctx.restore();
    ctx.save(); ctx.translate(W - 29, 38); ctx.rotate(Math.PI / 2); ctx.fillText("TATE MODERN", 0, 0); ctx.restore();
    // natural axis
    ctx.strokeStyle = C.rule; ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(44, midY); ctx.lineTo(W - 44, midY); ctx.stroke(); ctx.setLineDash([]);
    // suspension lines
    ctx.strokeStyle = '#9a8e74'; ctx.lineWidth = 1;
    for (let gx = 88; gx < W - 44; gx += 60) {
      ctx.beginPath();
      ctx.moveTo(gx, deckY - dH / 2); ctx.lineTo(gx, 6);
      ctx.moveTo(gx, deckY + dH / 2); ctx.lineTo(gx, H - 6); ctx.stroke();
    }
    // deck
    ctx.fillStyle = C.paper; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    ctx.fillRect(44, deckY - dH / 2, W - 88, dH); ctx.strokeRect(44, deckY - dH / 2, W - 88, dH);
    ctx.strokeStyle = C.rule; ctx.beginPath(); ctx.moveTo(44, deckY); ctx.lineTo(W - 44, deckY); ctx.stroke();
    // walkers (blue -> red with sync)
    const hot = R;
    for (const p of walkers) {
      const px = 44 + p.u * (W - 88), py = deckY + p.lane + Math.sin(p.phase) * 6;
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 6.3);
      const r = Math.round(63 + (217 - 63) * hot), g = Math.round(107 + (52 - 107) * hot), b = Math.round(122 + (28 - 122) * hot);
      ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fill();
    }
    // sway dimension line
    if (Math.abs(dy) > 5) {
      ctx.strokeStyle = C.red; ctx.lineWidth = 2; const ax = W - 60;
      ctx.beginPath();
      ctx.moveTo(ax, midY); ctx.lineTo(ax, deckY);
      ctx.moveTo(ax - 5, midY); ctx.lineTo(ax + 5, midY);
      ctx.moveTo(ax - 5, deckY); ctx.lineTo(ax + 5, deckY); ctx.stroke();
    }
  }

  let last = performance.now();
  function loop(now) {
    let fr = Math.min((now - last) / 1000, .05); last = now;
    const sub = 8, dt = fr / sub;
    let amp = 0;
    for (let s = 0; s < sub; s++) amp = stp(dt);
    draw();

    const mm = amp * 1000;
    $('ampOut').innerHTML = (mm < 10 ? mm.toFixed(1) : Math.round(mm)) + '&nbsp;mm';
    $('syncOut').textContent = Math.round(sync() * 100) + '%';
    const b = $('badge');
    if (damped && mm < 9) { b.textContent = 'Damped'; b.className = 'badge ok'; }
    else if (mm > 40) { b.textContent = 'Closing!'; b.className = 'badge warn'; }
    else if (mm > 12) { b.textContent = 'Wobbling'; b.className = 'badge warn'; }
    else { b.textContent = 'Stable'; b.className = 'badge'; }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();