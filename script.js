// Demo Aviator Predictor (vanilla JS)
// Simple heuristic predictor using recent rounds (demo only).
// Persist prediction history in localStorage under key 'aviator_pred_history'.

(function(){
  // Config
  const RECENT_COUNT = 20;
  const STORAGE_KEY = 'aviator_pred_history_v1';

  // State
  let recentRounds = [];
  let history = loadHistory();

  // Elements
  const multiplierEl = document.getElementById('multiplier');
  const multiplierSubEl = document.getElementById('multiplierSub');
  const bestGuessEl = document.getElementById('bestGuess');
  const guessConfidenceEl = document.getElementById('guessConfidence');
  const confidenceFillEl = document.getElementById('confidenceFill');
  const recentListEl = document.getElementById('recentList');
  const historyListEl = document.getElementById('historyList');
  const predictBtn = document.getElementById('predictBtn');
  const resetBtn = document.getElementById('resetBtn');
  const simulateRoundBtn = document.getElementById('simulateRound');
  const seedRoundsBtn = document.getElementById('seedRounds');

  // Initialize
  seedDemoRounds();
  renderRecent();
  renderHistory();
  updateMultiplierUI( getLatestRound() || null );
  // wire events
  predictBtn.addEventListener('click', onPredict);
  resetBtn.addEventListener('click', onReset);
  simulateRoundBtn.addEventListener('click', onSimulateRound);
  seedRoundsBtn.addEventListener('click', () => { seedDemoRounds(); renderRecent(); });

  // Utilities
  function saveHistory(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch(e){}
  }
  function loadHistory(){
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e){ return []; }
  }

  function seededRandom(){
    return Math.random();
  }

  // Create simulated round with heavy tail distribution typical for crash games (demo only)
  function makeRound(){
    const r = seededRandom();
    if (r < 0.78) return +(1 + seededRandom()*0.9).toFixed(2);        // frequent low crashes ~1.0-1.9
    if (r < 0.93) return +(1.8 + seededRandom()*3.2).toFixed(2);     // less frequent mid 2-5
    if (r < 0.99) return +(5 + seededRandom()*20).toFixed(2);        // rare bigger multipliers
    return +(25 + seededRandom()*200).toFixed(2);                    // very rare jackpots
  }

  function seedDemoRounds(){
    recentRounds = [];
    for(let i=0;i<RECENT_COUNT;i++){
      recentRounds.unshift(makeRound()); // add older first, latest last
    }
  }

  function getLatestRound(){ return recentRounds[recentRounds.length-1]; }

  // UI rendering
  function renderRecent(){
    recentListEl.innerHTML = '';
    for(let i=recentRounds.length-1;i>=0;i--){
      const m = recentRounds[i];
      const li = document.createElement('li');
      li.innerHTML = `<span>Round ${recentRounds.length - i}</span><strong>${m}x</strong>`;
      recentListEl.appendChild(li);
    }
  }

  function renderHistory(){
    historyListEl.innerHTML = '';
    if(history.length === 0){
      historyListEl.innerHTML = '<li class="muted small">No predictions yet — press Generate Prediction.</li>';
      return;
    }
    history.slice().reverse().forEach(entry => {
      const li = document.createElement('li');
      const ts = new Date(entry.t).toLocaleString();
      li.innerHTML = `<span>${ts}</span><strong>${entry.pred.toFixed(2)}x · ${Math.round(entry.conf)}%</strong>`;
      historyListEl.appendChild(li);
    });
  }

  function updateMultiplierUI(value){
    if(value == null){
      multiplierEl.textContent = '—';
      multiplierSubEl.textContent = 'Demo rounds';
      return;
    }
    // animate numeric change
    const start = parseFloat(multiplierEl.dataset.current || 0) || 0;
    const end = value;
    animateNumber(start, end, 650, v => {
      multiplierEl.textContent = `${v.toFixed(2)}x`;
      multiplierEl.dataset.current = v;
    });
    multiplierSubEl.textContent = `Latest round: ${value}x`;
  }

  // prediction algorithm (very simple heuristic)
  function makePrediction(){
    if(recentRounds.length === 0) return {pred:1.1, conf:20};
    const arr = recentRounds.slice();
    const mean = arr.reduce((s,x)=>s+x,0)/arr.length;
    const variance = arr.reduce((s,x)=> s + Math.pow(x-mean,2), 0) / arr.length;
    const std = Math.sqrt(variance);
    const cv = std / Math.max(mean, 0.0001); // coefficient of variation

    // Heuristic: if cv is low (consistent rounds), slightly boost expected multiplier from mean.
    // Otherwise be conservative (closer to 1).
    const stabilityFactor = Math.max(0, 1 - cv); // 0..1
    let baseline = mean * (0.8 + 0.4 * stabilityFactor); // bias toward mean but shifted
    // Add small randomness, but clipped
    const noise = (seededRandom()-0.5)*0.15*baseline;
    let pred = Math.max(1.01, baseline + noise);
    // Occasionally pick a slightly higher tail to show tradeoff
    if(seededRandom() > 0.96) pred = Math.max(pred, mean * (1 + seededRandom()*2));

    // Confidence: inverse of CV mapped to 10..90%
    let conf = (1 - Math.min(1, cv)) * 75 + 10;
    conf = Math.max(8, Math.min(95, conf));

    return {pred: +pred, conf: +conf};
  }

  // Button handlers
  function onPredict(){
    const {pred, conf} = makePrediction();
    const entry = {pred: +pred, conf: +conf, t: Date.now()};
    history.push(entry);
    saveHistory();
    renderHistory();
    showPrediction(entry);
  }

  function onReset(){
    if(!confirm('Clear prediction history?')) return;
    history = [];
    saveHistory();
    renderHistory();
    // clear best guess
    bestGuessEl.textContent = '— x';
    guessConfidenceEl.textContent = '—%';
    confidenceFillEl.style.width = '0%';
  }

  function onSimulateRound(){
    const r = makeRound();
    recentRounds.push(r);
    if(recentRounds.length > RECENT_COUNT) recentRounds.shift();
    renderRecent();
    updateMultiplierUI(r);
  }

  function showPrediction(entry){
    const pred = entry.pred;
    const conf = entry.conf;
    // animate best guess
    animateNumber(parseFloat(bestGuessEl.dataset.value||0), pred, 700, v => {
      bestGuessEl.textContent = `${v.toFixed(2)} x`;
      bestGuessEl.dataset.value = v;
    });
    guessConfidenceEl.textContent = `${Math.round(conf)}%`;
    confidenceFillEl.style.width = `${Math.round(conf)}%`;
    // color change based on confidence
    confidenceFillEl.style.background = conf > 60 ? 'linear-gradient(90deg,var(--accent),var(--accent-2))' : 'linear-gradient(90deg,#ff8b6b,#ffc371)';
    // Also update multiplier display with last round for context
    updateMultiplierUI(getLatestRound());
  }

  // small numeric animation helper
  function animateNumber(from, to, duration, onFrame){
    const start = performance.now();
    function step(ts){
      const t = Math.min(1, (ts - start) / duration);
      const eased = easeOutCubic(t);
      const value = from + (to - from) * eased;
      onFrame(value);
      if(t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }

  // Start by showing last saved history entry as best guess (if any)
  if(history.length){
    showPrediction(history[history.length - 1]);
  }
})();
