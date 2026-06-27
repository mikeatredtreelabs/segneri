/* ═══════════════════════════════════════════════════════════════════
   Italiano Vocab Trainer — app.js
   2000 words, 20 packs, lazy-loaded
   ═══════════════════════════════════════════════════════════════════ */

const PACKS_META = [
  { id:'greet',      name:'Greetings & Basics',     emoji:'👋' },
  { id:'food',       name:'At the Restaurant',       emoji:'🍝' },
  { id:'travel',     name:'Getting Around',          emoji:'🚂' },
  { id:'verbs',      name:'Everyday Verbs',          emoji:'⚡' },
  { id:'adjectives', name:'Describing Things',       emoji:'🎨' },
  { id:'numbers',    name:'Numbers & Time',          emoji:'🔢' },
  { id:'family',     name:'Family & Relationships',  emoji:'👨‍👩‍👧' },
  { id:'body',       name:'The Human Body',          emoji:'🫀' },
  { id:'health',     name:'Health & Medical',        emoji:'🏥' },
  { id:'shopping',   name:'Shopping & Money',        emoji:'🛍️' },
  { id:'clothing',   name:'Clothing & Fashion',      emoji:'👗' },
  { id:'home',       name:'Home & Furniture',        emoji:'🏠' },
  { id:'nature',     name:'Nature & Weather',        emoji:'🌿' },
  { id:'animals',    name:'Animals',                 emoji:'🐾' },
  { id:'work',       name:'Work & Business',         emoji:'💼' },
  { id:'tech',       name:'Technology & Media',      emoji:'💻' },
  { id:'sports',     name:'Sports & Leisure',        emoji:'⚽' },
  { id:'arts',       name:'Arts & Culture',          emoji:'🎭' },
  { id:'emotions',   name:'Emotions & Personality',  emoji:'❤️' },
  { id:'advverbs',   name:'Advanced Verbs',          emoji:'🔥' },
];

/* ── Conjugation data for key verbs ─────────────────────────────── */
const CONJ = {
  'essere':   { pres:['sono','sei','è','siamo','siete','sono'],         past:['sono stato','sei stato','è stato','siamo stati','siete stati','sono stati'] },
  'avere':    { pres:['ho','hai','ha','abbiamo','avete','hanno'],        past:['ho avuto','hai avuto','ha avuto','abbiamo avuto','avete avuto','hanno avuto'] },
  'fare':     { pres:['faccio','fai','fa','facciamo','fate','fanno'],    past:['ho fatto','hai fatto','ha fatto','abbiamo fatto','avete fatto','hanno fatto'] },
  'andare':   { pres:['vado','vai','va','andiamo','andate','vanno'],     past:['sono andato','sei andato','è andato','siamo andati','siete andati','sono andati'] },
  'venire':   { pres:['vengo','vieni','viene','veniamo','venite','vengono'], past:['sono venuto','sei venuto','è venuto','siamo venuti','siete venuti','sono venuti'] },
  'parlare':  { pres:['parlo','parli','parla','parliamo','parlate','parlano'], past:['ho parlato','hai parlato','ha parlato','abbiamo parlato','avete parlato','hanno parlato'] },
  'mangiare': { pres:['mangio','mangi','mangia','mangiamo','mangiate','mangiano'], past:['ho mangiato','hai mangiato','ha mangiato','abbiamo mangiato','avete mangiato','hanno mangiato'] },
  'bere':     { pres:['bevo','bevi','beve','beviamo','bevete','bevono'], past:['ho bevuto','hai bevuto','ha bevuto','abbiamo bevuto','avete bevuto','hanno bevuto'] },
  'dormire':  { pres:['dormo','dormi','dorme','dormiamo','dormite','dormono'], past:['ho dormito','hai dormito','ha dormito','abbiamo dormito','avete dormito','hanno dormito'] },
  'capire':   { pres:['capisco','capisci','capisce','capiamo','capite','capiscono'], past:['ho capito','hai capito','ha capito','abbiamo capito','avete capito','hanno capito'] },
  'volere':   { pres:['voglio','vuoi','vuole','vogliamo','volete','vogliono'], past:['ho voluto','hai voluto','ha voluto','abbiamo voluto','avete voluto','hanno voluto'] },
  'potere':   { pres:['posso','puoi','può','possiamo','potete','possono'], past:['ho potuto','hai potuto','ha potuto','abbiamo potuto','avete potuto','hanno potuto'] },
  'sapere':   { pres:['so','sai','sa','sappiamo','sapete','sanno'],      past:['ho saputo','hai saputo','ha saputo','abbiamo saputo','avete saputo','hanno saputo'] },
  'vedere':   { pres:['vedo','vedi','vede','vediamo','vedete','vedono'], past:['ho visto','hai visto','ha visto','abbiamo visto','avete visto','hanno visto'] },
  'comprare': { pres:['compro','compri','compra','compriamo','comprate','comprano'], past:['ho comprato','hai comprato','ha comprato','abbiamo comprato','avete comprato','hanno comprato'] },
  'leggere':  { pres:['leggo','leggi','legge','leggiamo','leggete','leggono'], past:['ho letto','hai letto','ha letto','abbiamo letto','avete letto','hanno letto'] },
};
const CONJ_SUBJECTS = ['io','tu','lui/lei','noi','voi','loro'];

/* ── Storage helpers ─────────────────────────────────────────────── */
const Store = {
  get(k, def) { try { const v = localStorage.getItem('it_'+k); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(k, v)   { try { localStorage.setItem('it_'+k, JSON.stringify(v)); } catch {} },
};

/* ══════════════════════════════════════════════════════════════════
   Main App object
══════════════════════════════════════════════════════════════════ */
const App = (() => {
  /* state */
  let loadedPacks = {};       // id → words[]
  let progress    = Store.get('progress', {});    // wordKey → {seen,correct,bucket}
  let stats       = Store.get('stats', {totalSeen:0, totalCorrect:0, xpToday:0, streak:0, lastDay:''});
  let theme       = Store.get('theme', 'dark');

  /* session state */
  let session = null;

  /* ── Init ──────────────────────────────────────────────────────── */
  function init() {
    applyTheme();
    renderPackGrid();
    renderWotd();
    updateStatsBar();
    bindKeyboard();
    document.getElementById('theme-btn').onclick = toggleTheme;
    document.getElementById('search-btn').onclick = () => toast('Search coming soon!');
    checkStreak();
  }

  /* ── Theme ─────────────────────────────────────────────────────── */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-btn').textContent = theme === 'dark' ? '🌙' : '☀️';
  }
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    Store.set('theme', theme);
    applyTheme();
  }

  /* ── Pack lazy loader ──────────────────────────────────────────── */
  function loadPack(id) {
    return new Promise((resolve, reject) => {
      if (loadedPacks[id]) return resolve(loadedPacks[id]);
      const s = document.createElement('script');
      s.src = `pack-${id}.js`;
      s.onload = () => {
        const pack = window[`PACK_${id}`];
        if (pack) { loadedPacks[id] = pack.words; resolve(pack.words); }
        else reject(new Error(`Pack ${id} failed`));
      };
      s.onerror = () => reject(new Error(`Script ${id} not found`));
      document.head.appendChild(s);
    });
  }

  async function loadPacks(ids) {
    return (await Promise.all(ids.map(loadPack))).flat();
  }

  /* ── Pack grid ─────────────────────────────────────────────────── */
  function renderPackGrid() {
    const grid = document.getElementById('pack-grid');
    grid.innerHTML = '';
    PACKS_META.forEach(m => {
      const seenInPack = countSeenInPack(m.id);
      const pct = Math.round(seenInPack / 100 * 100);
      const complete = pct >= 80;
      const card = document.createElement('div');
      card.className = 'pack-card' + (complete ? ' complete' : '');
      card.innerHTML = `
        <div class="pack-emoji">${m.emoji}</div>
        <div class="pack-name">${m.name}</div>
        <div class="pack-count">${seenInPack}/100 seen</div>
        <div class="pack-progress-bar" style="width:${pct}%"></div>
      `;
      card.onclick = () => openPackMenu(m.id);
      grid.appendChild(card);
    });
  }

  function countSeenInPack(packId) {
    return Object.keys(progress).filter(k => k.startsWith(packId + '_') && progress[k].seen > 0).length;
  }

  /* ── Word of the day ───────────────────────────────────────────── */
  async function renderWotd() {
    try {
      const today = new Date().toDateString();
      const wotdKey = Store.get('wotdKey', '');
      let cached = Store.get('wotdWord', null);
      if (!cached || Store.get('wotdDay', '') !== today) {
        const id = PACKS_META[Math.floor(Math.random() * PACKS_META.length)].id;
        const words = await loadPack(id);
        const w = words[Math.floor(Math.random() * words.length)];
        cached = { ...w, packId: id };
        Store.set('wotdWord', cached);
        Store.set('wotdDay', today);
      }
      document.getElementById('wotd-it').textContent  = cached.it;
      document.getElementById('wotd-en').textContent  = cached.en;
      document.getElementById('wotd-ipa').textContent = cached.ipa || '';
      document.getElementById('wotd-ex').textContent  = cached.ex || '';
      document.getElementById('wotd').onclick = () => openWordModal(cached);
    } catch {}
  }

  /* ── Stats bar ─────────────────────────────────────────────────── */
  function updateStatsBar() {
    const allKeys  = Object.keys(progress);
    const seenKeys = allKeys.filter(k => progress[k].seen > 0);
    const known    = allKeys.filter(k => progress[k].bucket >= 3).length;
    const packsDone = PACKS_META.filter(m => countSeenInPack(m.id) >= 80).length;
    document.getElementById('stat-total').textContent  = seenKeys.length;
    document.getElementById('stat-known').textContent  = known;
    document.getElementById('stat-streak').textContent = stats.streak;
    document.getElementById('stat-packs').textContent  = `${packsDone}/20`;
    document.getElementById('stat-xp').textContent     = stats.xpToday;
  }

  function checkStreak() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (stats.lastDay === today) return;
    if (stats.lastDay === yesterday) { stats.streak++; }
    else if (stats.lastDay !== today) { stats.streak = stats.lastDay ? 1 : (stats.streak || 0); }
    stats.xpToday = 0;
    stats.lastDay = today;
    Store.set('stats', stats);
  }

  function addXP(n) {
    stats.xpToday  = (stats.xpToday || 0) + n;
    stats.lastDay  = new Date().toDateString();
    Store.set('stats', stats);
    updateStatsBar();
  }

  /* ── Screens ───────────────────────────────────────────────────── */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  /* ── Pack menu ─────────────────────────────────────────────────── */
  async function openPackMenu(id) {
    const m = PACKS_META.find(p => p.id === id);
    document.getElementById('menu-emoji').textContent = m.emoji;
    document.getElementById('menu-title').textContent = m.name;
    document.getElementById('menu-info').textContent  = `${countSeenInPack(id)}/100 words seen`;
    session = { packIds: [id], mode: null };
    showScreen('pack-menu-screen');
    // Pre-load
    const card = document.querySelector(`.pack-card`);
    try { await loadPack(id); } catch {}
  }

  function startMode(mode) {
    session.mode = mode;
    if (mode === 'flash' || mode === 'challenge') startFlash(mode);
    else if (mode === 'quiz')     startQuiz();
    else if (mode === 'spritzi') startSpritzi();
  }

  async function startAllPacks(mode) {
    session = { packIds: PACKS_META.map(m => m.id), mode };
    if (mode === 'flash')   startFlash('flash');
    else if (mode === 'quiz')     startQuiz();
    else if (mode === 'spritzi') startSpritzi();
  }

  async function showWeakWords() {
    // Collect words with bucket < 2 that have been seen
    const allWords = await loadPacks(PACKS_META.map(m => m.id));
    const weak = allWords.filter(w => {
      const key = wordKey(w);
      const p = progress[key];
      return !p || p.bucket < 2;
    }).slice(0, 100);
    session = { packIds: PACKS_META.map(m => m.id), mode: 'flash', fixedWords: weak };
    startFlash('flash');
  }

  /* ── Word key ──────────────────────────────────────────────────── */
  function wordKey(w) {
    // derive pack from cat + it
    const pack = PACKS_META.find(m => window[`PACK_${m.id}`] && window[`PACK_${m.id}`].words.includes(w));
    const packId = pack ? pack.id : 'x';
    return `${packId}_${w.it.replace(/\s/g,'_')}`;
  }

  /* ── Spaced-repetition deck ────────────────────────────────────── */
  function buildDeck(words, maxCards = 50) {
    // Weight: unseen=4, bucket0=3, bucket1=2, bucket2=1, bucket≥3=0.3
    const weighted = words.map(w => {
      const key = wordKey(w);
      const p = progress[key] || { seen:0, correct:0, bucket:0 };
      let weight = [4, 3, 2, 1][Math.min(p.bucket, 3)] || 0.3;
      return { w, weight };
    });
    weighted.sort((a, b) => b.weight - a.weight);
    const top = weighted.slice(0, maxCards);
    return shuffle(top.map(x => x.w));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── FLASHCARD SESSION ─────────────────────────────────────────── */
  async function startFlash(mode) {
    showScreen('flash-screen');
    document.getElementById('flash-title').textContent = mode === 'challenge' ? 'Challenge ✍️' : 'Flashcards 🃏';
    document.getElementById('card-area').innerHTML = '<div class="loading-spinner"></div>';

    let words;
    if (session.fixedWords) {
      words = session.fixedWords;
    } else {
      try {
        const raw = await loadPacks(session.packIds);
        words = buildDeck(raw, 50);
      } catch {
        toast('Failed to load pack'); showScreen('home-screen'); return;
      }
    }

    session.words   = words;
    session.mode    = mode;
    session.index   = 0;
    session.seen    = 0;
    session.correct = 0;
    session.xp      = 0;

    // Rebuild card area
    document.getElementById('card-area').innerHTML = `
      <div class="flashcard" id="flashcard" onclick="App.flipCard()">
        <div class="card-face card-front">
          <div class="card-category" id="card-cat">–</div>
          <div class="card-it" id="card-it">–</div>
          <div class="card-ipa" id="card-ipa">–</div>
          <div class="card-hint">tap to reveal</div>
          <button class="tts-btn" onclick="event.stopPropagation();App.speak(document.getElementById('card-it').textContent)">🔊</button>
        </div>
        <div class="card-face card-back">
          <div class="card-category" id="card-cat-back">–</div>
          <div class="card-en" id="card-en">–</div>
          <div class="card-ex" id="card-ex">–</div>
          <div class="card-ex-en" id="card-ex-en">–</div>
          <button class="tts-btn" onclick="event.stopPropagation();App.speak(document.getElementById('card-it').textContent)">🔊</button>
        </div>
      </div>`;

    // Challenge mode vs normal
    const isChallenge = (mode === 'challenge');
    document.getElementById('challenge-area').style.display = isChallenge ? 'flex' : 'none';
    document.getElementById('card-actions').style.display   = isChallenge ? 'none' : 'flex';

    showFlashCard();
  }

  function showFlashCard() {
    const w = session.words[session.index];
    if (!w) return endSession(true);
    const total = session.words.length;
    const pos   = session.index + 1;

    document.getElementById('flash-pos').textContent    = pos;
    document.getElementById('flash-total').textContent  = total;
    document.getElementById('flash-progress').style.width = `${(pos / total) * 100}%`;

    document.getElementById('card-cat').textContent     = w.cat || '';
    document.getElementById('card-cat-back').textContent= w.cat || '';
    document.getElementById('card-it').textContent      = w.it;
    document.getElementById('card-ipa').textContent     = w.ipa || '';
    document.getElementById('card-en').textContent      = w.en;
    document.getElementById('card-ex').textContent      = w.ex || '';
    document.getElementById('card-ex-en').textContent   = w.exEn || '';

    const card = document.getElementById('flashcard');
    if (card) card.classList.remove('flipped');
    document.getElementById('card-actions').classList.add('hidden');

    if (session.mode === 'challenge') {
      const inp = document.getElementById('challenge-input');
      inp.value = '';
      inp.className = 'challenge-input';
      inp.disabled = false;
      inp.focus();
    }

    // Mark as seen
    markSeen(w);
  }

  function flipCard() {
    if (session.mode === 'challenge') return;
    const card = document.getElementById('flashcard');
    if (!card) return;
    card.classList.toggle('flipped');
    const flipped = card.classList.contains('flipped');
    if (flipped) {
      document.getElementById('card-actions').classList.remove('hidden');
      speak(document.getElementById('card-it').textContent);
    }
  }

  function rateCard(score) {
    const w = session.words[session.index];
    updateProgress(w, score === 1);
    if (score === 1) { session.correct++; session.xp += 5; addXP(5); }
    session.seen++;
    session.index++;
    if (session.index >= session.words.length) return endSession(true);
    showFlashCard();
  }

  function submitChallenge() {
    const w = session.words[session.index];
    const inp = document.getElementById('challenge-input');
    const answer = inp.value.trim().toLowerCase();
    const target = w.it.toLowerCase();
    const correct = answer === target || target.includes(answer) || levenshtein(answer, target) <= 1;
    inp.className = 'challenge-input ' + (correct ? 'correct' : 'wrong');
    inp.disabled = true;

    if (correct) {
      toast('✓ Corretto!');
      updateProgress(w, true);
      session.correct++; session.xp += 8; addXP(8);
    } else {
      toast(`✗ "${w.it}"`);
      updateProgress(w, false);
    }
    session.seen++;
    session.index++;
    setTimeout(() => {
      if (session.index >= session.words.length) endSession(true);
      else showFlashCard();
    }, 800);
  }

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m+1 }, (_, i) => Array.from({ length: n+1 }, (_, j) => i || j));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  /* ── QUIZ SESSION ──────────────────────────────────────────────── */
  async function startQuiz() {
    showScreen('quiz-screen');
    let words;
    try {
      const raw = await loadPacks(session.packIds);
      words = buildDeck(raw, 20);
    } catch { toast('Failed to load pack'); showScreen('home-screen'); return; }

    session.words   = words;
    session.allWords = await loadPacks(session.packIds);
    session.index   = 0;
    session.seen    = 0;
    session.correct = 0;
    session.xp      = 0;
    showQuizQuestion();
  }

  function showQuizQuestion() {
    const words = session.words;
    if (session.index >= words.length) return endSession(true);
    const w = words[session.index];
    const pos = session.index + 1;
    document.getElementById('quiz-pos').textContent      = pos;
    document.getElementById('quiz-total').textContent    = words.length;
    document.getElementById('quiz-progress').style.width = `${(pos/words.length)*100}%`;
    document.getElementById('quiz-word').textContent     = w.it;
    document.getElementById('quiz-ipa').textContent      = w.ipa || '';

    // 4 options (1 correct + 3 random)
    const others = shuffle(session.allWords.filter(x => x.it !== w.it)).slice(0, 3);
    const options = shuffle([w, ...others]);

    const container = document.getElementById('quiz-options');
    container.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-option';
      btn.textContent = opt.en;
      btn.onclick = () => handleQuizAnswer(btn, opt.it === w.it, w);
      container.appendChild(btn);
    });
    markSeen(w);
  }

  function handleQuizAnswer(btn, correct, word) {
    const opts = document.querySelectorAll('.quiz-option');
    opts.forEach(b => { b.disabled = true; });
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (!correct) {
      opts.forEach(b => { if (b.textContent === word.en) b.classList.add('correct'); });
    }
    updateProgress(word, correct);
    if (correct) { session.correct++; session.xp += 5; addXP(5); }
    session.seen++;
    session.index++;
    setTimeout(() => {
      if (session.index >= session.words.length) endSession(true);
      else showQuizQuestion();
    }, correct ? 600 : 1200);
  }

  /* ── SPRITZI SESSION ────────────────────────────────────────────── */
  async function startSpritzi() {
    showScreen('spritzi-screen');
    let words;
    try {
      const raw = await loadPacks(session.packIds);
      words = shuffle(raw);
    } catch { toast('Failed to load pack'); showScreen('home-screen'); return; }

    session.words    = words;
    session.allWords = words;
    session.index    = 0;
    session.lives    = 3;
    session.score    = 0;
    session.streak   = 0;
    session.seen     = 0;
    session.correct  = 0;
    session.xp       = 0;

    renderSpritziLives();
    showSpritziQuestion();
  }

  function renderSpritziLives() {
    const hearts = ['❤️','❤️','❤️'].map((h,i) => i < session.lives ? h : '🖤').join('');
    document.getElementById('spritzi-lives').textContent = hearts;
  }

  function showSpritziQuestion() {
    if (session.lives <= 0 || session.index >= session.words.length) return endSession(true);
    const w = session.words[session.index];

    document.getElementById('spritzi-it').textContent   = w.it;
    document.getElementById('spritzi-ipa').textContent  = w.ipa || '';
    document.getElementById('spritzi-score-disp').textContent = `Score: ${session.score}`;
    document.getElementById('spritzi-streak').textContent = `🔥 ${session.streak}`;

    // 5 options
    const others = shuffle(session.allWords.filter(x => x.it !== w.it)).slice(0, 4);
    const options = shuffle([w, ...others]);

    const container = document.getElementById('spritzi-options');
    container.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'spritzi-opt';
      btn.textContent = opt.en;
      btn.onclick = () => handleSpritziAnswer(btn, opt.it === w.it, w);
      container.appendChild(btn);
    });
    markSeen(w);
  }

  function handleSpritziAnswer(btn, correct, word) {
    const opts = document.querySelectorAll('.spritzi-opt');
    opts.forEach(b => b.disabled = true);
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (!correct) {
      opts.forEach(b => { if (b.textContent === word.en) b.classList.add('correct'); });
      session.lives--;
      session.streak = 0;
      renderSpritziLives();
    } else {
      session.streak++;
      const bonus = session.streak > 3 ? 15 : 10;
      session.score += bonus;
      session.xp += bonus;
      addXP(bonus);
    }
    updateProgress(word, correct);
    if (correct) session.correct++;
    session.seen++;
    session.index++;

    if (session.lives <= 0) {
      setTimeout(() => endSession(true), 800);
    } else {
      setTimeout(() => {
        if (session.index >= session.words.length) endSession(true);
        else showSpritziQuestion();
      }, correct ? 400 : 900);
    }
  }

  /* ── Progress tracking ─────────────────────────────────────────── */
  function markSeen(w) {
    const key = wordKey(w);
    if (!progress[key]) progress[key] = { seen:0, correct:0, bucket:0 };
    progress[key].seen++;
    stats.totalSeen++;
    Store.set('progress', progress);
    Store.set('stats', stats);
  }

  function updateProgress(w, correct) {
    const key = wordKey(w);
    if (!progress[key]) progress[key] = { seen:0, correct:0, bucket:0 };
    progress[key].correct += correct ? 1 : 0;
    if (correct) {
      progress[key].bucket = Math.min(5, progress[key].bucket + 1);
      stats.totalCorrect++;
    } else {
      progress[key].bucket = Math.max(0, progress[key].bucket - 1);
    }
    Store.set('progress', progress);
    Store.set('stats', stats);
  }

  /* ── Session end ───────────────────────────────────────────────── */
  function endSession(completed = false) {
    if (!session) { showScreen('home-screen'); return; }
    const seen    = session.seen || 0;
    const correct = session.correct || 0;
    const xp      = session.xp || 0;
    const pct     = seen > 0 ? Math.round((correct / seen) * 100) : 0;

    let trophy = '🎯', title = 'Session Complete!', sub = `${pct}% correct`;
    if (pct >= 90) { trophy = '🏆'; title = 'Perfetto!'; }
    else if (pct >= 70) { trophy = '⭐'; title = 'Molto bene!'; }
    else if (pct >= 50) { trophy = '👍'; title = 'Bene!'; }
    else { trophy = '💪'; title = 'Keep practising!'; }

    if (session.mode === 'spritzi') {
      sub = `Score: ${session.score || 0}`;
    }

    document.getElementById('summary-trophy').textContent = trophy;
    document.getElementById('summary-title').textContent  = title;
    document.getElementById('summary-sub').textContent    = sub;
    document.getElementById('sum-seen').textContent       = seen;
    document.getElementById('sum-correct').textContent    = correct;
    document.getElementById('sum-xp').textContent         = `+${xp}`;

    if (pct >= 80 && seen >= 10) fireConfetti();
    renderPackGrid();
    updateStatsBar();
    showScreen('summary-screen');
  }

  function replaySession() {
    if (!session) return showScreen('home-screen');
    const mode = session.mode;
    const packIds = session.packIds;
    session = { packIds, mode };
    startMode(mode);
  }

  /* ── Word detail modal ─────────────────────────────────────────── */
  function openWordModal(w) {
    document.getElementById('modal-it').textContent   = w.it;
    document.getElementById('modal-en').textContent   = w.en;
    document.getElementById('modal-ipa').textContent  = w.ipa || '';
    document.getElementById('modal-ex').textContent   = w.ex || '';
    document.getElementById('modal-ex-en').textContent= w.exEn || '';

    // Conjugation?
    const base = w.it.split(' ').pop();
    const conj = CONJ[base];
    const section = document.getElementById('modal-conj-section');
    if (conj) {
      section.style.display = 'block';
      const tbl = document.getElementById('modal-conj-table');
      tbl.innerHTML = '<tr><th>Pronoun</th><th>Present</th><th>Past</th></tr>' +
        CONJ_SUBJECTS.map((s, i) =>
          `<tr><td>${s}</td><td>${conj.pres[i]}</td><td>${conj.past[i]}</td></tr>`
        ).join('');
    } else {
      section.style.display = 'none';
    }
    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  /* ── TTS ───────────────────────────────────────────────────────── */
  function speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 0.85;
    // Prefer Italian voice
    const voices = window.speechSynthesis.getVoices();
    const itVoice = voices.find(v => v.lang.startsWith('it'));
    if (itVoice) utt.voice = itVoice;
    window.speechSynthesis.speak(utt);
  }

  /* ── Keyboard shortcuts ────────────────────────────────────────── */
  function bindKeyboard() {
    document.addEventListener('keydown', e => {
      const active = document.querySelector('.screen.active')?.id;
      if (active === 'flash-screen') {
        if (e.code === 'Space') { e.preventDefault(); flipCard(); }
        if (e.code === 'ArrowRight') rateCard(1);
        if (e.code === 'ArrowLeft')  rateCard(0);
      }
      if (e.code === 'Escape') closeModal();
    });
  }

  /* ── Confetti ──────────────────────────────────────────────────── */
  function fireConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      r: 4 + Math.random() * 6,
      d: 2 + Math.random() * 3,
      c: ['#e8c468','#c45c3a','#4ea8a0','#eeeae0','#5dbe8a'][Math.floor(Math.random()*5)],
      s: (Math.random() - 0.5) * 2,
    }));
    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();
        p.y += p.d; p.x += p.s;
      });
      frame++;
      if (frame < 120) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    draw();
  }

  /* ── Toast ─────────────────────────────────────────────────────── */
  function toast(msg, dur = 1800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), dur);
  }

  /* ── Tab navigation ─────────────────────────────────────────────── */
  function navTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.classList.add('active');
    if (tab === 'home') {
      showScreen('home-screen');
    } else if (tab === 'flash') {
      session = { packIds: PACKS_META.map(m => m.id), mode: 'flash' };
      startFlash('flash');
    } else if (tab === 'quiz') {
      session = { packIds: PACKS_META.map(m => m.id), mode: 'quiz' };
      startQuiz();
    } else if (tab === 'spritzi') {
      session = { packIds: PACKS_META.map(m => m.id), mode: 'spritzi' };
      startSpritzi();
    } else if (tab === 'progress') {
      showProgressScreen();
    }
  }

  function showProgressScreen() {
    showScreen('progress-screen');
    const allKeys  = Object.keys(progress);
    const seenKeys = allKeys.filter(k => progress[k].seen > 0);
    const known    = allKeys.filter(k => progress[k].bucket >= 3).length;
    document.getElementById('prog-seen').textContent   = seenKeys.length;
    document.getElementById('prog-known').textContent  = known;
    document.getElementById('prog-streak').textContent = stats.streak;
    const list = document.getElementById('progress-pack-list');
    list.innerHTML = '';
    PACKS_META.forEach(m => {
      const seen = countSeenInPack(m.id);
      const pct  = Math.round(seen / 100 * 100);
      const div  = document.createElement('div');
      div.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 14px;';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:0.88rem;font-weight:600">${m.emoji} ${m.name}</span>
          <span style="font-size:0.78rem;color:var(--text3)">${seen}/100</span>
        </div>
        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${pct>=80?'var(--green)':'var(--accent)'};border-radius:3px;transition:width 0.4s"></div>
        </div>`;
      list.appendChild(div);
    });
  }

  function resetProgress() {
    if (!confirm('Reset all progress? This cannot be undone.')) return;
    progress = {};
    stats = { totalSeen:0, totalCorrect:0, xpToday:0, streak:0, lastDay:'' };
    Store.set('progress', progress);
    Store.set('stats', stats);
    updateStatsBar();
    renderPackGrid();
    showProgressScreen();
    toast('Progress reset.');
  }

  /* ── Public API ─────────────────────────────────────────────────── */
  return {
    init, showScreen, openPackMenu, startMode, startAllPacks, showWeakWords,
    flipCard, rateCard, submitChallenge,
    endSession, replaySession,
    openWordModal, closeModal,
    speak, toast, navTab, resetProgress,
  };
})();

/* Voices need a moment to load */
window.speechSynthesis && window.speechSynthesis.addEventListener('voiceschanged', () => {});

/* Boot */
document.addEventListener('DOMContentLoaded', () => App.init());

/* ── Service Worker registration (PWA / offline support) ────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  });
}

/* ── iOS "Add to Home Screen" one-time tip ──────────────────────── */
(function showInstallPrompt() {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone;
  if (isIOS && !isStandalone && !localStorage.getItem('it_install_shown')) {
    setTimeout(() => {
      App.toast('📲 Tap Share → "Add to Home Screen" to install!', 4500);
      localStorage.setItem('it_install_shown', '1');
    }, 3000);
  }
})();

