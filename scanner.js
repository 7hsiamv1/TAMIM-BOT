/* ════════════════════════════════════════════════
   TradeSignal Scanner  –  scanner.js
   GitHub Pages compatible (no build, no deps)
   ════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── CONSTANTS ─────────────────────────────── */
  const SIGNAL_INTERVAL_MS = 60 * 1000; // 1 minute
  const SYMBOLS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT',
                   'XRP/USDT','ADA/USDT','DOGE/USDT','AVAX/USDT',
                   'MATIC/USDT','DOT/USDT','LINK/USDT','UNI/USDT'];
  const MARKETS = ['S&P 500','NASDAQ','GOLD','OIL','DXY','VIX'];

  /* ── STATE ──────────────────────────────────── */
  let currentSignal = null;   // 'UP' | 'DOWN'
  let signalTime    = null;   // Date when last signal was generated
  let signalHistory = [];     // rolling log
  let nextTickAt    = null;   // next minute boundary (Date)
  let countdownRAF  = null;

  /* ── DOM REFS ──────────────────────────────── */
  const $btn        = document.getElementById('signal-btn');
  const $arrow      = document.getElementById('btn-arrow');
  const $btnLabel   = document.getElementById('btn-label');
  const $result     = document.getElementById('signal-result');
  const $sub        = document.getElementById('signal-sub');
  const $clock      = document.getElementById('clock');
  const $nextTick   = document.getElementById('next-tick');
  const $cdWrap     = document.getElementById('countdown-wrap');
  const $cdBar      = document.getElementById('countdown-bar');
  const $cdText     = document.getElementById('countdown-text');
  const $prompt     = document.getElementById('prompt-text');
  const $logBox     = document.getElementById('log-box');
  const $movers     = document.getElementById('movers-list');
  const $volume     = document.getElementById('volume-list');
  const $market     = document.getElementById('market-list');
  const $history    = document.getElementById('history-list');
  const $ticker     = document.getElementById('ticker');
  const $bgCanvas   = document.getElementById('bg-canvas');
  const $miniChart  = document.getElementById('mini-chart');

  /* ── UTILITIES ─────────────────────────────── */
  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }
  function fmt(n, decimals = 2) {
    return n.toFixed(decimals);
  }
  function fmtTime(d) {
    let h = d.getHours(), m = d.getMinutes(), s = d.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(h)}:${pad(m)}:${pad(s)} ${ampm}`;
  }
  function fmtShort(d) {
    let h = d.getHours(), m = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${pad(h)}:${pad(m)} ${ampm}`;
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  /* ── CLOCK ─────────────────────────────────── */
  function tickClock() {
    const now = new Date();
    $clock.textContent = fmtTime(now);

    // Update next-tick display
    if (nextTickAt) {
      const diff = Math.max(0, nextTickAt - now);
      const secs = Math.ceil(diff / 1000);
      const mm = pad(Math.floor(secs / 60));
      const ss = pad(secs % 60);
      $nextTick.textContent = `next roll: ${mm}:${ss}`;

      // Progress bar (counts DOWN from 60 to 0)
      const pct = (diff / SIGNAL_INTERVAL_MS) * 100;
      $cdBar.style.width = pct + '%';
      $cdBar.style.background = pct > 40
        ? 'var(--accent)'
        : pct > 15 ? '#f0a500' : 'var(--down)';
      $cdText.textContent = `Next signal in ${mm}:${ss}`;
    }
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ── RANDOM SIGNAL (minute-boundary roll) ──── */
  function getNextMinuteBoundary() {
    const now  = new Date();
    const next = new Date(now);
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return next;
  }

  function rollSignal() {
    currentSignal = Math.random() < 0.5 ? 'UP' : 'DOWN';
    signalTime    = new Date();
    return currentSignal;
  }

  /* ── DISPLAY SIGNAL ─────────────────────────── */
  function showSignal(sig, animate) {
    // Button state
    $btn.classList.remove('up-state', 'down-state');
    $btn.classList.add(sig === 'UP' ? 'up-state' : 'down-state');

    // Result text
    $result.classList.remove('up', 'down');
    $result.classList.add(sig === 'UP' ? 'up' : 'down');
    $result.textContent = sig === 'UP' ? '▲ UP' : '▼ DOWN';

    $sub.textContent = 'SIGNAL ACTIVE — ' + fmtShort(new Date());
    $prompt.style.display = 'none';
    $cdWrap.style.display = 'block';

    // Confidence (pseudo)
    const conf = randInt(62, 94);
    addLog(sig, conf);
    updateHistory(sig, conf);

    // Mini chart update
    pushChartPoint(sig);

    if (animate) {
      $result.style.transform = 'scale(1.15)';
      setTimeout(() => { $result.style.transform = 'scale(1)'; }, 300);
    }
  }

  /* ── COUNTDOWN LOOP ─────────────────────────── */
  function startCountdown() {
    nextTickAt = getNextMinuteBoundary();

    function check() {
      const now  = new Date();
      if (now >= nextTickAt) {
        rollSignal();
        showSignal(currentSignal, true);
        nextTickAt = getNextMinuteBoundary();
      }
      countdownRAF = setTimeout(check, 500);
    }
    check();
  }

  /* ── BUTTON CLICK (first interaction) ──────── */
  let activated = false;
  $btn.addEventListener('click', () => {
    rollSignal();
    showSignal(currentSignal, true);

    if (!activated) {
      activated = true;
      startCountdown();
    } else {
      // Manual re-roll allowed anytime
      nextTickAt = getNextMinuteBoundary();
    }
  });

  /* ── ROLLING LOG ────────────────────────────── */
  function addLog(sig, conf) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML =
      `<span class="log-time">${fmtShort(new Date())}</span>` +
      `<span class="log-sig ${sig.toLowerCase()}">${sig === 'UP' ? '▲ LONG' : '▼ SHORT'}</span>` +
      `<span class="log-conf">${conf}% conf</span>`;
    $logBox.insertBefore(entry, $logBox.firstChild);
    // Keep only 5 entries visible
    while ($logBox.children.length > 5) {
      $logBox.removeChild($logBox.lastChild);
    }
  }

  /* ── SIGNAL HISTORY PANEL ───────────────────── */
  function updateHistory(sig, conf) {
    signalHistory.unshift({ sig, conf, time: new Date() });
    if (signalHistory.length > 6) signalHistory.pop();

    $history.innerHTML = signalHistory.map(h =>
      `<div class="stat-row">
        <span class="sym">${fmtShort(h.time)}</span>
        <span class="val ${h.sig.toLowerCase()}">${h.sig === 'UP' ? '▲' : '▼'} ${h.sig}</span>
      </div>`
    ).join('');
  }

  /* ═══════════════════════════════════════════
     SIDE PANEL DATA (randomized, refreshed)
  ═══════════════════════════════════════════ */
  function generatePanelData() {
    // Movers
    const movers = [...SYMBOLS].sort(() => .5 - Math.random()).slice(0, 6);
    $movers.innerHTML = movers.map(sym => {
      const chg = rand(-8, 8);
      const dir = chg >= 0 ? 'up' : 'down';
      return `<div class="stat-row">
        <span class="sym">${sym.split('/')[0]}</span>
        <span class="val ${dir}">${chg >= 0 ? '+' : ''}${fmt(chg)}%</span>
      </div>`;
    }).join('');

    // Volume
    const vols = [...SYMBOLS].sort(() => .5 - Math.random()).slice(0, 5);
    $volume.innerHTML = vols.map(sym => {
      const v = rand(10, 999);
      const unit = v > 500 ? 'M' : 'K';
      const val  = v > 500 ? fmt(v / 1000, 1) + 'B' : fmt(v, 0) + unit;
      return `<div class="stat-row">
        <span class="sym">${sym.split('/')[0]}</span>
        <span class="val">${val}</span>
      </div>`;
    }).join('');

    // Markets
    $market.innerHTML = MARKETS.map(m => {
      const chg = rand(-2.5, 2.5);
      const dir = chg >= 0 ? 'up' : 'down';
      return `<div class="stat-row">
        <span class="sym">${m}</span>
        <span class="val ${dir}">${chg >= 0 ? '+' : ''}${fmt(chg)}%</span>
      </div>`;
    }).join('');
  }
  generatePanelData();
  setInterval(generatePanelData, 7000);

  /* ── TICKER TAPE ────────────────────────────── */
  function buildTicker() {
    const items = SYMBOLS.map(sym => {
      const price = rand(0.1, 50000);
      const chg   = rand(-6, 6);
      const dir   = chg >= 0 ? 'up' : 'down';
      const pFmt  = price > 100 ? price.toFixed(2) : price.toFixed(4);
      return `<span class="tick-item">
        <span class="tick-sym">${sym}</span>
        <span class="tick-val">${pFmt}</span>
        <span class="tick-chg ${dir}">${chg >= 0 ? '+' : ''}${fmt(chg)}%</span>
      </span>`;
    }).join('');
    $ticker.innerHTML = items + items; // duplicate for seamless loop
  }
  buildTicker();
  setInterval(buildTicker, 15000);

  /* ═══════════════════════════════════════════
     BACKGROUND CANDLESTICK CANVAS
  ═══════════════════════════════════════════ */
  (function initBgCanvas() {
    const ctx    = $bgCanvas.getContext('2d');
    let candles  = [];
    let W, H;

    function resize() {
      W = $bgCanvas.width  = window.innerWidth;
      H = $bgCanvas.height = window.innerHeight - 74;
      generateCandles();
    }

    function generateCandles() {
      candles = [];
      const candleW = 10, gap = 4;
      const cols    = Math.floor(W / (candleW + gap)) + 1;
      let price     = rand(0.4, 0.6) * H;

      for (let i = 0; i < cols; i++) {
        const open  = price;
        const delta = rand(-20, 20);
        price      += delta;
        price       = Math.max(H * 0.1, Math.min(H * 0.9, price));
        const close = price;
        const high  = Math.min(open, close) - rand(2, 12);
        const low   = Math.max(open, close) + rand(2, 12);
        candles.push({ x: i * (candleW + gap), open, close, high, low, w: candleW });
      }
    }

    function drawBg() {
      ctx.clearRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(28,45,74,.25)';
      ctx.lineWidth   = 1;
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      // Candles
      candles.forEach(c => {
        const bull = c.close < c.open;
        ctx.strokeStyle = bull ? 'rgba(0,230,118,.6)' : 'rgba(255,23,68,.6)';
        ctx.fillStyle   = bull ? 'rgba(0,230,118,.4)' : 'rgba(255,23,68,.4)';
        ctx.lineWidth   = 1;

        // Wick
        const midX = c.x + c.w / 2;
        ctx.beginPath();
        ctx.moveTo(midX, c.high);
        ctx.lineTo(midX, c.low);
        ctx.stroke();

        // Body
        ctx.fillRect(c.x, Math.min(c.open, c.close),
                     c.w, Math.abs(c.open - c.close) || 1);
        ctx.strokeRect(c.x, Math.min(c.open, c.close),
                       c.w, Math.abs(c.open - c.close) || 1);
      });
    }

    // Animate — slowly shift candles left
    let offset = 0;
    function animate() {
      offset += 0.3;
      if (offset >= 14) {
        offset = 0;
        // Add new candle on right, remove leftmost
        candles.shift();
        const last = candles[candles.length - 1];
        const prev = last ? last.close : H / 2;
        const open  = prev;
        const delta = rand(-20, 20);
        const close = Math.max(H * 0.1, Math.min(H * 0.9, prev + delta));
        candles.push({
          x: (last ? last.x + 14 : 0),
          open, close,
          high: Math.min(open, close) - rand(2, 12),
          low:  Math.max(open, close) + rand(2, 12),
          w: 10
        });
      }
      // Shift all x positions
      const shifted = candles.map((c, i) => ({ ...c, x: i * 14 - offset }));
      ctx.clearRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(28,45,74,.2)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      shifted.forEach(c => {
        if (c.x + c.w < 0 || c.x > W) return;
        const bull = c.close < c.open;
        ctx.strokeStyle = bull ? 'rgba(0,230,118,.5)' : 'rgba(255,23,68,.5)';
        ctx.fillStyle   = bull ? 'rgba(0,230,118,.25)' : 'rgba(255,23,68,.25)';
        ctx.lineWidth   = 1;
        const midX = c.x + c.w / 2;
        ctx.beginPath(); ctx.moveTo(midX, c.high); ctx.lineTo(midX, c.low); ctx.stroke();
        ctx.fillRect(c.x, Math.min(c.open, c.close), c.w, Math.abs(c.open - c.close) || 1);
        ctx.strokeRect(c.x, Math.min(c.open, c.close), c.w, Math.abs(c.open - c.close) || 1);
      });

      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
  })();

  /* ═══════════════════════════════════════════
     MINI LINE CHART (signal history)
  ═══════════════════════════════════════════ */
  const miniCtx   = $miniChart.getContext('2d');
  const miniPoints = Array.from({ length: 40 }, () => rand(20, 80));

  function resizeMini() {
    $miniChart.width  = $miniChart.offsetWidth;
    $miniChart.height = $miniChart.offsetHeight;
    drawMini();
  }

  function pushChartPoint(sig) {
    const last = miniPoints[miniPoints.length - 1];
    const next = sig === 'UP'
      ? Math.min(95, last + rand(5, 20))
      : Math.max(5,  last - rand(5, 20));
    miniPoints.push(next);
    if (miniPoints.length > 60) miniPoints.shift();
    drawMini();
  }

  function drawMini() {
    const W = $miniChart.width, H = $miniChart.height;
    const ctx = miniCtx;
    ctx.clearRect(0, 0, W, H);

    const pts = miniPoints;
    const min = Math.min(...pts), max = Math.max(...pts);
    const range = max - min || 1;

    const toX = i => (i / (pts.length - 1)) * W;
    const toY = v => H - ((v - min) / range) * (H * 0.8) - H * 0.1;

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(41,121,255,.25)');
    grad.addColorStop(1, 'rgba(41,121,255,.0)');

    ctx.beginPath();
    pts.forEach((v, i) => {
      if (i === 0) ctx.moveTo(toX(i), toY(v));
      else ctx.lineTo(toX(i), toY(v));
    });
    ctx.strokeStyle = 'rgba(41,121,255,.8)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.lineTo(toX(pts.length - 1), H);
    ctx.lineTo(0, H);
    ctx.fillStyle = grad;
    ctx.fill();

    // Latest dot
    const lx = toX(pts.length - 1), ly = toY(pts[pts.length - 1]);
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#2979ff';
    ctx.fill();
  }

  window.addEventListener('resize', resizeMini);
  setTimeout(resizeMini, 100);

  // Mini chart drifts on its own
  setInterval(() => {
    const last = miniPoints[miniPoints.length - 1];
    miniPoints.push(Math.max(5, Math.min(95, last + rand(-6, 6))));
    if (miniPoints.length > 60) miniPoints.shift();
    drawMini();
  }, 1200);

  /* ── FLOATING NUMBERS (ambient) ─────────────── */
  (function spawnFloaters() {
    function spawn() {
      const el = document.createElement('div');
      el.className = 'float-num';
      el.textContent = rand(0.001, 99999).toFixed(randInt(0, 4));
      el.style.left  = rand(0, 100) + 'vw';
      el.style.bottom = rand(30, 80) + 'px';
      el.style.animationDuration = rand(4, 9) + 's';
      el.style.animationDelay   = rand(0, 3) + 's';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 9000);
    }
    setInterval(spawn, 400);
  })();

})();
