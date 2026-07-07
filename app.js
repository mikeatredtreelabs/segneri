/* ═══════════════════════════════════════════════════════════════
   Segneri — Italian Vocab Trainer
   app.js
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Version ─────────────────────────────────────────────────── */
const APP_VERSION = '2.2.3';

/* ── Constants ──────────────────────────────────────────────── */
const STORAGE_KEY   = 'sengeri-progress';
const SETTINGS_KEY  = 'sengeri-settings';
const THEME_KEY     = 'sengeri-theme';
const STREAK_KEY    = 'sengeri-streak';
const XP_KEY        = 'sengeri-xp';
const ERRORS_KEY    = 'sengeri-errors';   // NEW: per-word error counts
const SEEN_KEY      = 'sengeri-seen';     // NEW: per-word seen dates

const PACK_MAP = {
  greet:     { file: 'pack-greet.js',     varName: 'PACK_greet'     },
  food:      { file: 'pack-food.js',      varName: 'PACK_food'      },
  travel:    { file: 'pack-travel.js',    varName: 'PACK_travel'    },
  verbs:     { file: 'pack-verbs.js',     varName: 'PACK_verbs'     },
  adjectives:{ file: 'pack-adjectives.js',varName: 'PACK_adjectives'},
  numbers:   { file: 'pack-numbers.js',   varName: 'PACK_numbers'   },
  family:    { file: 'pack-family.js',    varName: 'PACK_family'    },
  body:      { file: 'pack-body.js',      varName: 'PACK_body'      },
  health:    { file: 'pack-health.js',    varName: 'PACK_health'    },
  shopping:  { file: 'pack-shopping.js',  varName: 'PACK_shopping'  },
  clothing:  { file: 'pack-clothing.js',  varName: 'PACK_clothing'  },
  home:      { file: 'pack-home.js',      varName: 'PACK_home'      },
  nature:    { file: 'pack-nature.js',    varName: 'PACK_nature'    },
  animals:   { file: 'pack-animals.js',   varName: 'PACK_animals'   },
  work:      { file: 'pack-work.js',      varName: 'PACK_work'      },
  tech:      { file: 'pack-tech.js',      varName: 'PACK_tech'      },
  sports:    { file: 'pack-sports.js',    varName: 'PACK_sports'    },
  arts:      { file: 'pack-arts.js',      varName: 'PACK_arts'      },
  emotions:  { file: 'pack-emotions.js',  varName: 'PACK_emotions'  },
  advverbs:  { file: 'pack-advverbs.js',  varName: 'PACK_advverbs'  },
};

/* ── State ──────────────────────────────────────────────────── */
let state = {
  tab:          'home',      // home | flash | quiz | spritzi | progress | listen | cloze | speak
  packId:       null,
  packData:     null,
  packWords:    [],
  allPacksCache:{},          // id → loaded pack data
  progress:     {},          // wordKey → { bucket, lastSeen }
  errors:       {},          // wordKey → count
  seen:         {},          // wordKey → ISO date string
  settings:     { ipa: true, autoSpeak: false, showEn: false },
  theme:        'dark',
  streak:       { count: 0, lastDate: null },
  xp:           0,
  // session
  sessionQueue: [],
  sessionIdx:   0,
  sessionFlipped: false,
  // quiz
  quizScore:    0,
  quizTotal:    0,
  // spritzi
  sprScore:     0,
  sprLives:     3,
  sprStreak:    0,
  sprTimer:     null,
  sprTimeLeft:  15,
  sprRunning:   false,
  // listen
  listenScore:  0,
  listenTotal:  0,
  listenQueue:  [],
  listenIdx:    0,
  // cloze
  clozeScore:   0,
  clozeTotal:   0,
  clozeQueue:   [],
  clozeIdx:     0,
  // speak
  speakQueue:   [],
  speakIdx:     0,
  speakScore:   0,
  speakTotal:   0,
  isListening:  false,
  recognition:  null,
  // daily quiz
  dailyQueue:   [],
  dailyIdx:     0,
  dailyFlipped: false,
  dailyRight:   0,
  dailyWrong:   0,
  // review
  reviewMode:   false,
  reviewWordIds:[],
  // word detail
  detailWord:   null,
};

/* ── localStorage helpers ───────────────────────────────────── */
const load  = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save  = (k, v)   => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function loadPersisted() {
  state.progress = load(STORAGE_KEY, {});
  state.errors   = load(ERRORS_KEY, {});
  state.seen     = load(SEEN_KEY, {});
  state.settings = { ...state.settings, ...load(SETTINGS_KEY, {}) };
  state.streak   = load(STREAK_KEY, { count: 0, lastDate: null });
  state.xp       = load(XP_KEY, 0);
  state.theme    = load(THEME_KEY, 'dark');
}

function savePersisted() {
  save(STORAGE_KEY, state.progress);
  save(ERRORS_KEY,  state.errors);
  save(SEEN_KEY,    state.seen);
  save(SETTINGS_KEY, state.settings);
  save(STREAK_KEY,  state.streak);
  save(XP_KEY,      state.xp);
  save(THEME_KEY,   state.theme);
}

/* ── Word key ───────────────────────────────────────────────── */
const wordKey = (packId, word) => `${packId}:${word.it}`;

/* ── Pack loading ───────────────────────────────────────────── */
async function loadPack(packId) {
  if (state.allPacksCache[packId]) return state.allPacksCache[packId];
  const info = PACK_MAP[packId];
  if (!info) throw new Error(`Unknown pack: ${packId}`);
  // Don't re-inject if script tag already exists
  const existing = document.querySelector(`script[data-pack="${packId}"]`);
  if (existing) {
    const data = window[info.varName];
    if (data) { state.allPacksCache[packId] = data; return data; }
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = info.file + '?v=' + APP_VERSION;
    s.setAttribute('data-pack', packId);
    s.onload = () => {
      const data = window[info.varName];
      if (!data) {
        reject(new Error(`Pack var missing: ${info.varName}`));
        return;
      }
      state.allPacksCache[packId] = data;
      resolve(data);
    };
    s.onerror = (e) => reject(new Error(`Failed to load ${info.file}`));
    document.head.appendChild(s);
  });
}

async function loadAllPacks() {
  const ids = Object.keys(PACK_MAP);
  await Promise.all(ids.map(id => loadPack(id).catch(() => null)));
}

/* ── Spaced repetition / queue building ─────────────────────── */
function getBucket(wordId) {
  return state.progress[wordId]?.bucket ?? 0;
}

function buildWeightedQueue(words, packId, limit = 40) {
  const weighted = [];
  for (const w of words) {
    const k = wordKey(packId, w);
    const b = getBucket(k);
    const weight = Math.max(1, 5 - b); // bucket 0 → weight 5, bucket 4+ → weight 1
    for (let i = 0; i < weight; i++) weighted.push(w);
  }
  const shuffled = shuffle(weighted);
  const seen = new Set();
  const result = [];
  for (const w of shuffled) {
    if (!seen.has(w.it) && result.length < limit) {
      seen.add(w.it);
      result.push(w);
    }
  }
  return result;
}

/* ── Mastery computation ─────────────────────────────────────── */
function getMastery(packId, words) {
  if (!words || words.length === 0) return 0;
  let mastered = 0;
  for (const w of words) {
    const k = wordKey(packId, w);
    if ((state.progress[k]?.bucket ?? 0) >= 2) mastered++;
  }
  return Math.round((mastered / words.length) * 100);
}

/* ── Daily review queue ──────────────────────────────────────── */
function getDueWords() {
  const today = todayStr();
  const due = [];
  for (const [k, data] of Object.entries(state.progress)) {
    if (!data) continue;
    const bucket = data.bucket ?? 0;
    const lastSeen = data.lastSeen;
    // Words in low buckets (0-1) that haven't been seen today
    if (bucket < 2 && lastSeen !== today) {
      due.push(k);
    }
    // Words in bucket 2-3 not seen in 2 days
    if (bucket >= 2 && bucket < 4 && lastSeen) {
      const diff = daysDiff(lastSeen, today);
      if (diff >= 2) due.push(k);
    }
  }
  return due;
}

function buildReviewQueue() {
  const dueKeys = getDueWords();
  const words = [];
  for (const k of dueKeys) {
    const [packId, ...itParts] = k.split(':');
    const it = itParts.join(':');
    const pack = state.allPacksCache[packId];
    if (!pack) continue;
    const w = pack.words.find(w => w.it === it);
    if (w) words.push({ ...w, _packId: packId });
  }
  return shuffle(words).slice(0, 40);
}

/* ── Weak words ─────────────────────────────────────────────── */
function getWeakWords(limit = 50) {
  const entries = Object.entries(state.errors)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  const words = [];
  for (const [k, count] of entries) {
    const [packId, ...itParts] = k.split(':');
    const it = itParts.join(':');
    const pack = state.allPacksCache[packId];
    if (!pack) continue;
    const w = pack.words.find(w => w.it === it);
    if (w) words.push({ ...w, _packId: packId, _errors: count, _bucket: getBucket(k) });
  }
  return words;
}

/* ── Utilities ───────────────────────────────────────────────── */
const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysDiff = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

function pickDistractors(word, pool, n = 3) {
  const others = pool.filter(w => w.it !== word.it);
  return shuffle(others).slice(0, n).map(w => w.en);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
               : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

/* ── TTS ─────────────────────────────────────────────────────── */
let ttsVoice = null;
function initVoices() {
  const set = () => {
    const voices = speechSynthesis.getVoices();
    ttsVoice = voices.find(v => v.lang.startsWith('it')) || null;
  };
  set();
  speechSynthesis.onvoiceschanged = set;
}

function speak(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'it-IT';
  if (ttsVoice) utt.voice = ttsVoice;
  utt.rate = 0.9;
  speechSynthesis.speak(utt);
}

/* ── Streak / XP ─────────────────────────────────────────────── */
function updateStreak() {
  const today = todayStr();
  if (state.streak.lastDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (state.streak.lastDate === yesterday) {
    state.streak.count++;
  } else if (state.streak.lastDate !== today) {
    state.streak.count = 1;
  }
  state.streak.lastDate = today;
  savePersisted();
}

function addXP(n) {
  state.xp += n;
  savePersisted();
}

/* ── Progress recording ─────────────────────────────────────── */
function recordResult(packId, word, correct) {
  const k = wordKey(packId || word._packId, word);
  const today = todayStr();
  if (!state.progress[k]) state.progress[k] = { bucket: 0, lastSeen: null };
  if (correct) {
    state.progress[k].bucket = Math.min(5, (state.progress[k].bucket || 0) + 1);
  } else {
    state.progress[k].bucket = Math.max(0, (state.progress[k].bucket || 0) - 1);
    state.errors[k] = (state.errors[k] || 0) + 1;
  }
  state.progress[k].lastSeen = today;
  state.seen[k] = today;
  savePersisted();
}

/* ── Theme ───────────────────────────────────────────────────── */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
  savePersisted();
}

/* ── Confetti ────────────────────────────────────────────────── */
function confetti() {
  const colors = ['#e63946','#f4a261','#2ec4b6','#4361ee','#fff'];
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(box);
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;width:${size}px;height:${size}px;background:${colors[i%colors.length]};left:${Math.random()*100}%;top:-20px;border-radius:${Math.random()>0.5?'50%':'2px'};opacity:0.9;`;
    p.animate([
      { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
      { transform: `translateY(${window.innerHeight + 40}px) rotate(${360 + Math.random()*360}deg)`, opacity: 0 }
    ], { duration: 1200 + Math.random() * 800, delay: Math.random() * 400, fill: 'forwards' });
    box.appendChild(p);
  }
  setTimeout(() => box.remove(), 2400);
}

/* ── Conjugation tables ──────────────────────────────────────── */
const CONJUGATIONS = {
  essere: { en: 'to be', present: ['sono','sei','è','siamo','siete','sono'], past: ['ero','eri','era','eravamo','eravate','erano'], future: ['sarò','sarai','sarà','saremo','sarete','saranno'] },
  avere:  { en: 'to have', present: ['ho','hai','ha','abbiamo','avete','hanno'], past: ['avevo','avevi','aveva','avevamo','avevate','avevano'], future: ['avrò','avrai','avrà','avremo','avrete','avranno'] },
  fare:   { en: 'to do/make', present: ['faccio','fai','fa','facciamo','fate','fanno'], past: ['facevo','facevi','faceva','facevamo','facevate','facevano'], future: ['farò','farai','farà','faremo','farete','faranno'] },
  andare: { en: 'to go', present: ['vado','vai','va','andiamo','andate','vanno'], past: ['andavo','andavi','andava','andavamo','andavate','andavano'], future: ['andrò','andrai','andrà','andremo','andrete','andranno'] },
  venire: { en: 'to come', present: ['vengo','vieni','viene','veniamo','venite','vengono'], past: ['venivo','venivi','veniva','venivamo','venivate','venivano'], future: ['verrò','verrai','verrà','verremo','verrete','verranno'] },
  potere: { en: 'to be able to', present: ['posso','puoi','può','possiamo','potete','possono'], past: ['potevo','potevi','poteva','potevamo','potevate','potevano'], future: ['potrò','potrai','potrà','potremo','potrete','potranno'] },
  volere: { en: 'to want', present: ['voglio','vuoi','vuole','vogliamo','volete','vogliono'], past: ['volevo','volevi','voleva','volevamo','volevate','volevano'], future: ['vorrò','vorrai','vorrà','vorremo','vorrete','vorranno'] },
  dovere: { en: 'to have to', present: ['devo','devi','deve','dobbiamo','dovete','devono'], past: ['dovevo','dovevi','doveva','dovevamo','dovevate','dovevano'], future: ['dovrò','dovrai','dovrà','dovremo','dovrete','dovranno'] },
  sapere: { en: 'to know', present: ['so','sai','sa','sappiamo','sapete','sanno'], past: ['sapevo','sapevi','sapeva','sapevamo','sapevate','sapevano'], future: ['saprò','saprai','saprà','sapremo','saprete','sapranno'] },
  stare:  { en: 'to stay/be', present: ['sto','stai','sta','stiamo','state','stanno'], past: ['stavo','stavi','stava','stavamo','stavate','stavano'], future: ['starò','starai','starà','staremo','starete','staranno'] },
  dare:   { en: 'to give', present: ['do','dai','dà','diamo','date','danno'], past: ['davo','davi','dava','davamo','davate','davano'], future: ['darò','darai','darà','daremo','darete','daranno'] },
  dire:   { en: 'to say', present: ['dico','dici','dice','diciamo','dite','dicono'], past: ['dicevo','dicevi','diceva','dicevamo','dicevate','dicevano'], future: ['dirò','dirai','dirà','diremo','direte','diranno'] },
  parlare:{ en: 'to speak', present: ['parlo','parli','parla','parliamo','parlate','parlano'], past: ['parlavo','parlavi','parlava','parlavamo','parlavate','parlavano'], future: ['parlerò','parlerai','parlerà','parleremo','parlerete','parleranno'] },
  mangiare:{ en: 'to eat', present: ['mangio','mangi','mangia','mangiamo','mangiate','mangiano'], past: ['mangiavo','mangiavi','mangiava','mangiavamo','mangiavate','mangiavano'], future: ['mangerò','mangerai','mangerà','mangeremo','mangerete','mangeranno'] },
  bere:   { en: 'to drink', present: ['bevo','bevi','beve','beviamo','bevete','bevono'], past: ['bevevo','bevevi','beveva','bevevamo','bevevate','bevevano'], future: ['berrò','berrai','berrà','berremo','berrete','berranno'] },
  capire:    { en: 'to understand', present: ['capisco','capisci','capisce','capiamo','capite','capiscono'], past: ['capivo','capivi','capiva','capivamo','capivate','capivano'], future: ['capirò','capirai','capirà','capiremo','capirete','capiranno'] },
  dormire:   { en: 'to sleep', present: ['dormo','dormi','dorme','dormiamo','dormite','dormono'], past: ['dormivo','dormivi','dormiva','dormivamo','dormivate','dormivano'], future: ['dormirò','dormirai','dormirà','dormiremo','dormirete','dormiranno'] },
  vedere:    { en: 'to see', present: ['vedo','vedi','vede','vediamo','vedete','vedono'], past: ['vedevo','vedevi','vedeva','vedevamo','vedevate','vedevano'], future: ['vedrò','vedrai','vedrà','vedremo','vedrete','vedranno'] },
  comprare:  { en: 'to buy', present: ['compro','compri','compra','compriamo','comprate','comprano'], past: ['compravo','compravi','comprava','compravamo','compravate','compravano'], future: ['comprerò','comprerai','comprerà','compreremo','comprerete','compreranno'] },
  leggere:   { en: 'to read', present: ['leggo','leggi','legge','leggiamo','leggete','leggono'], past: ['leggevo','leggevi','leggeva','leggevamo','leggevate','leggevano'], future: ['leggerò','leggerai','leggerà','leggeremo','leggerete','leggeranno'] },
  scrivere:  { en: 'to write', present: ['scrivo','scrivi','scrive','scriviamo','scrivete','scrivono'], past: ['scrivevo','scrivevi','scriveva','scrivevamo','scrivevate','scrivevano'], future: ['scriverò','scriverai','scriverà','scriveremo','scriverete','scriveranno'] },
  ascoltare: { en: 'to listen', present: ['ascolto','ascolti','ascolta','ascoltiamo','ascoltate','ascoltano'], past: ['ascoltavo','ascoltavi','ascoltava','ascoltavamo','ascoltavate','ascoltavano'], future: ['ascolterò','ascolterai','ascolterà','ascolteremo','ascolterete','ascolteranno'] },
  guardare:  { en: 'to watch/look', present: ['guardo','guardi','guarda','guardiamo','guardate','guardano'], past: ['guardavo','guardavi','guardava','guardavamo','guardavate','guardavano'], future: ['guarderò','guarderai','guarderà','guarderemo','guarderete','guarderanno'] },
  lavorare:  { en: 'to work', present: ['lavoro','lavori','lavora','lavoriamo','lavorate','lavorano'], past: ['lavoravo','lavoravi','lavorava','lavoravamo','lavoravate','lavoravano'], future: ['lavorerò','lavorerai','lavorerà','lavoreremo','lavorerete','lavoreranno'] },
  studiare:  { en: 'to study', present: ['studio','studi','studia','studiamo','studiate','studiano'], past: ['studiavo','studiavi','studiava','studiavamo','studiavate','studiavano'], future: ['studierò','studierai','studierà','studieremo','studierete','studieranno'] },
  imparare:  { en: 'to learn', present: ['imparo','impari','impara','impariamo','imparate','imparano'], past: ['imparavo','imparavi','imparava','imparavamo','imparavate','imparavano'], future: ['imparerò','imparerai','imparerà','impareremo','imparerete','impareranno'] },
  abitare:   { en: 'to live/reside', present: ['abito','abiti','abita','abitiamo','abitate','abitano'], past: ['abitavo','abitavi','abitava','abitavamo','abitavate','abitavano'], future: ['abiterò','abiterai','abiterà','abiteremo','abiterete','abiteranno'] },
  correre:   { en: 'to run', present: ['corro','corri','corre','corriamo','correte','corrono'], past: ['correvo','correvi','correva','correvamo','correvate','correvano'], future: ['correrò','correrai','correrà','correremo','correrete','correranno'] },
  cucinare:  { en: 'to cook', present: ['cucino','cucini','cucina','cuciniamo','cucinate','cucinano'], past: ['cucinavo','cucinavi','cucinava','cucinavamo','cucinavate','cucinavano'], future: ['cucinerò','cucinerai','cucinerà','cucineremo','cucinerete','cucineranno'] },
  aprire:    { en: 'to open', present: ['apro','apri','apre','apriamo','aprite','aprono'], past: ['aprivo','aprivi','apriva','aprivamo','aprivate','aprivano'], future: ['aprirò','aprirai','aprirà','apriremo','aprirete','apriranno'] },
  chiudere:  { en: 'to close', present: ['chiudo','chiudi','chiude','chiudiamo','chiudete','chiudono'], past: ['chiudevo','chiudevi','chiudeva','chiudevamo','chiudevate','chiudevano'], future: ['chiuderò','chiuderai','chiuderà','chiuderemo','chiuderete','chiuderanno'] },
  cercare:   { en: 'to look for', present: ['cerco','cerchi','cerca','cerchiamo','cercate','cercano'], past: ['cercavo','cercavi','cercava','cercavamo','cercavate','cercavano'], future: ['cercherò','cercherai','cercherà','cercheremo','cercherete','cercheranno'] },
  trovare:   { en: 'to find', present: ['trovo','trovi','trova','troviamo','trovate','trovano'], past: ['trovavo','trovavi','trovava','trovavamo','trovavate','trovavano'], future: ['troverò','troverai','troverà','troveremo','troverete','troveranno'] },
  portare:   { en: 'to bring/carry', present: ['porto','porti','porta','portiamo','portate','portano'], past: ['portavo','portavi','portava','portavamo','portavate','portavano'], future: ['porterò','porterai','porterà','porteremo','porterete','porteranno'] },
  prendere:  { en: 'to take', present: ['prendo','prendi','prende','prendiamo','prendete','prendono'], past: ['prendevo','prendevi','prendeva','prendevamo','prendevate','prendevano'], future: ['prenderò','prenderai','prenderà','prenderemo','prenderete','prenderanno'] },
  mettere:   { en: 'to put', present: ['metto','metti','mette','mettiamo','mettete','mettono'], past: ['mettevo','mettevi','metteva','mettevamo','mettevate','mettevano'], future: ['metterò','metterai','metterà','metteremo','metterete','metteranno'] },
  sentire:   { en: 'to hear/feel', present: ['sento','senti','sente','sentiamo','sentite','sentono'], past: ['sentivo','sentivi','sentiva','sentivamo','sentivate','sentivano'], future: ['sentirò','sentirai','sentirà','sentiremo','sentirete','sentiranno'] },
  pensare:   { en: 'to think', present: ['penso','pensi','pensa','pensiamo','pensate','pensano'], past: ['pensavo','pensavi','pensava','pensavamo','pensavate','pensavano'], future: ['penserò','penserai','penserà','penseremo','penserete','penseranno'] },
  credere:   { en: 'to believe', present: ['credo','credi','crede','crediamo','credete','credono'], past: ['credevo','credevi','credeva','credevamo','credevate','credevano'], future: ['crederò','crederai','crederà','crederemo','crederete','crederanno'] },
  sperare:   { en: 'to hope', present: ['spero','speri','spera','speriamo','sperate','sperano'], past: ['speravo','speravi','sperava','speravamo','speravate','speravano'], future: ['spererò','spererai','spererà','spereremo','spererete','spereranno'] },
  ricordare: { en: 'to remember', present: ['ricordo','ricordi','ricorda','ricordiamo','ricordate','ricordano'], past: ['ricordavo','ricordavi','ricordava','ricordavamo','ricordavate','ricordavano'], future: ['ricorderò','ricorderai','ricorderà','ricorderemo','ricorderete','ricorderanno'] },
  aspettare: { en: 'to wait', present: ['aspetto','aspetti','aspetta','aspettiamo','aspettate','aspettano'], past: ['aspettavo','aspettavi','aspettava','aspettavamo','aspettavate','aspettavano'], future: ['aspetterò','aspetterai','aspetterà','aspetteremo','aspetterete','aspetteranno'] },
  conoscere: { en: 'to know (person)', present: ['conosco','conosci','conosce','conosciamo','conoscete','conoscono'], past: ['conoscevo','conoscevi','conosceva','conoscevamo','conoscevate','conoscevano'], future: ['conoscerò','conoscerai','conoscerà','conosceremo','conoscerete','conosceranno'] },
  aiutare:   { en: 'to help', present: ['aiuto','aiuti','aiuta','aiutiamo','aiutate','aiutano'], past: ['aiutavo','aiutavi','aiutava','aiutavamo','aiutavate','aiutavano'], future: ['aiuterò','aiuterai','aiuterà','aiuteremo','aiuterete','aiuteranno'] },
  cominciare:{ en: 'to begin', present: ['comincio','cominci','comincia','cominciamo','cominciate','cominciano'], past: ['cominciavo','cominciavi','cominciava','cominciavamo','cominciavate','cominciavano'], future: ['comincerò','comincerai','comincerà','cominceremo','comincerete','cominceranno'] },
  finire:    { en: 'to finish', present: ['finisco','finisci','finisce','finiamo','finite','finiscono'], past: ['finivo','finivi','finiva','finivamo','finivate','finivano'], future: ['finirò','finirai','finirà','finiremo','finirete','finiranno'] },
  tornare:   { en: 'to return', present: ['torno','torni','torna','torniamo','tornate','tornano'], past: ['tornavo','tornavi','tornava','tornavamo','tornavate','tornavano'], future: ['tornerò','tornerai','tornerà','torneremo','tornerete','torneranno'] },
  partire:   { en: 'to leave/depart', present: ['parto','parti','parte','partiamo','partite','partono'], past: ['partivo','partivi','partiva','partivamo','partivate','partivano'], future: ['partirò','partirai','partirà','partiremo','partirete','partiranno'] },
  arrivare:  { en: 'to arrive', present: ['arrivo','arrivi','arriva','arriviamo','arrivate','arrivano'], past: ['arrivavo','arrivavi','arrivava','arrivavamo','arrivavate','arrivavano'], future: ['arriverò','arriverai','arriverà','arriveremo','arriverete','arriveranno'] },
  entrare:   { en: 'to enter', present: ['entro','entri','entra','entriamo','entrate','entrano'], past: ['entravo','entravi','entrava','entravamo','entravate','entravano'], future: ['entrerò','entrerai','entrerà','entreremo','entrerete','entreranno'] },
  uscire:    { en: 'to go out', present: ['esco','esci','esce','usciamo','uscite','escono'], past: ['uscivo','uscivi','usciva','uscivamo','uscivate','uscivano'], future: ['uscirò','uscirai','uscirà','usciremo','uscirete','usciranno'] },
  pagare:    { en: 'to pay', present: ['pago','paghi','paga','paghiamo','pagate','pagano'], past: ['pagavo','pagavi','pagava','pagavamo','pagavate','pagavano'], future: ['pagherò','pagherai','pagherà','pagheremo','pagherete','pagheranno'] },
  cambiare:  { en: 'to change', present: ['cambio','cambi','cambia','cambiamo','cambiate','cambiano'], past: ['cambiavo','cambiavi','cambiava','cambiavamo','cambiavate','cambiavano'], future: ['cambierò','cambierai','cambierà','cambieremo','cambierete','cambieranno'] },
  preferire: { en: 'to prefer', present: ['preferisco','preferisci','preferisce','preferiamo','preferite','preferiscono'], past: ['preferivo','preferivi','preferiva','preferivamo','preferivate','preferivano'], future: ['preferirò','preferirai','preferirà','preferiremo','preferirete','preferiranno'] },
  amare:     { en: 'to love', present: ['amo','ami','ama','amiamo','amate','amano'], past: ['amavo','amavi','amava','amavamo','amavate','amavano'], future: ['amerò','amerai','amerà','ameremo','amerete','ameranno'] },
  chiamare:  { en: 'to call', present: ['chiamo','chiami','chiama','chiamiamo','chiamate','chiamano'], past: ['chiamavo','chiamavi','chiamava','chiamavamo','chiamavate','chiamavano'], future: ['chiamerò','chiamerai','chiamerà','chiameremo','chiamerete','chiameranno'] },
  rispondere:{ en: 'to answer', present: ['rispondo','rispondi','risponde','rispondiamo','rispondete','rispondono'], past: ['rispondevo','rispondevi','rispondeva','rispondevamo','rispondevate','rispondevano'], future: ['risponderò','risponderai','risponderà','risponderemo','risponderete','risponderanno'] },
  chiedere:  { en: 'to ask', present: ['chiedo','chiedi','chiede','chiediamo','chiedete','chiedono'], past: ['chiedevo','chiedevi','chiedeva','chiedevamo','chiedevate','chiedevano'], future: ['chiederò','chiederai','chiederà','chiederemo','chiederete','chiederanno'] },
  spiegare:  { en: 'to explain', present: ['spiego','spieghi','spiega','spieghiamo','spiegate','spiegano'], past: ['spiegavo','spiegavi','spiegava','spiegavamo','spiegavate','spiegavano'], future: ['spiegherò','spiegherai','spiegherà','spiegheremo','spiegherete','spiegheranno'] },
  viaggiare: { en: 'to travel', present: ['viaggio','viaggi','viaggia','viaggiamo','viaggiate','viaggiano'], past: ['viaggiavo','viaggiavi','viaggiava','viaggiavamo','viaggiavate','viaggiavano'], future: ['viaggerò','viaggerai','viaggerà','viaggeremo','viaggerete','viaggeranno'] },
  perdere:   { en: 'to lose', present: ['perdo','perdi','perde','perdiamo','perdete','perdono'], past: ['perdevo','perdevi','perdeva','perdevamo','perdevate','perdevano'], future: ['perderò','perderai','perderà','perderemo','perderete','perderanno'] },
  vivere:    { en: 'to live', present: ['vivo','vivi','vive','viviamo','vivete','vivono'], past: ['vivevo','vivevi','viveva','vivevamo','vivevate','vivevano'], future: ['vivrò','vivrai','vivrà','vivremo','vivrete','vivranno'] },
  passare:   { en: 'to pass/spend', present: ['passo','passi','passa','passiamo','passate','passano'], past: ['passavo','passavi','passava','passavamo','passavate','passavano'], future: ['passerò','passerai','passerà','passeremo','passerete','passeranno'] },
  restare:   { en: 'to stay/remain', present: ['resto','resti','resta','restiamo','restate','restano'], past: ['restavo','restavi','restava','restavamo','restavate','restavano'], future: ['resterò','resterai','resterà','resteremo','resterete','resteranno'] },
  diventare: { en: 'to become', present: ['divento','diventi','diventa','diventiamo','diventate','diventano'], past: ['diventavo','diventavi','diventava','diventavamo','diventavate','diventavano'], future: ['diventerò','diventerai','diventerà','diventeremo','diventerete','diventeranno'] },
  continuare:{ en: 'to continue', present: ['continuo','continui','continua','continuiamo','continuate','continuano'], past: ['continuavo','continuavi','continuava','continuavamo','continuavate','continuavano'], future: ['continuerò','continuerai','continuerà','continueremo','continuerete','continueranno'] },
  ricevere:  { en: 'to receive', present: ['ricevo','ricevi','riceve','riceviamo','ricevete','ricevono'], past: ['ricevevo','ricevevi','riceveva','ricevevamo','ricevevate','ricevevano'], future: ['riceverò','riceverai','riceverà','riceveremo','riceverete','riceveranno'] },
  mandare:   { en: 'to send', present: ['mando','mandi','manda','mandiamo','mandate','mandano'], past: ['mandavo','mandavi','mandava','mandavamo','mandavate','mandavano'], future: ['manderò','manderai','manderà','manderemo','manderete','manderanno'] },
};
const PERSONS = ['io','tu','lui/lei','noi','voi','loro'];

/* ═══════════════════════════════════════════════════════════════
   RENDER FUNCTIONS
   ═══════════════════════════════════════════════════════════════ */

function render() {
  const app = $('app');
  if (!app) return;
  switch (state.tab) {
    case 'home':     renderHome(app);     break;
    case 'flash':    renderFlash(app);    break;
    case 'quiz':     renderQuiz(app);     break;
    case 'spritzi':  renderSpritzi(app);  break;
    case 'progress': renderProgress(app); break;
    case 'listen':   renderListen(app);   break;
    case 'cloze':    renderCloze(app);    break;
    case 'speak':    renderSpeak(app);    break;
    case 'dailyquiz':renderDailyQuiz(app);break;
    default:         renderHome(app);
  }
  renderTabBar();
}

function renderTabBar() {
  const bar = $('tab-bar');
  if (!bar) return;
  const tabs = [
    { id: 'home',     icon: '🏠', label: 'Home'     },
    { id: 'flash',    icon: '🃏', label: 'Flash'    },
    { id: 'quiz',     icon: '🧠', label: 'Quiz'     },
    { id: 'spritzi',  icon: '⚡', label: 'Spritzi'  },
    { id: 'progress', icon: '📈', label: 'Progress' },
  ];
  bar.innerHTML = tabs.map(t => `
    <button class="tab-btn ${state.tab === t.id || (t.id === 'flash' && ['listen','cloze','speak'].includes(state.tab)) || (t.id === 'quiz' && state.tab === 'dailyquiz') ? 'active' : ''}"
            onclick="setTab('${t.id}')">
      <span class="tab-icon">${t.icon}</span>
      <span class="tab-label">${t.label}</span>
    </button>
  `).join('');
}

/* ── Home Tab ────────────────────────────────────────────────── */
async function renderHome(app) {
  const due = getDueWords();
  const dueCount = due.length;
  const wotd = getWordOfDay();

  app.innerHTML = `
    <div class="page-header">
      <button class="logo logo-btn" onclick="showAboutSheet()">🇮🇹 <span>Segneri</span> <span class="logo-chevron">›</span></button>
      <div class="header-actions">
        <button onclick="toggleTheme()" class="icon-btn" title="Toggle theme">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
      </div>
    </div>

    <div class="stats-strip">
      <div class="stat-pill"><span class="stat-num">${state.streak.count}</span><span class="stat-lbl">🔥 streak</span></div>
      <div class="stat-pill"><span class="stat-num">${state.xp}</span><span class="stat-lbl">⭐ XP</span></div>
      <div class="stat-pill"><span class="stat-num">${Object.keys(state.progress).length}</span><span class="stat-lbl">📚 studied</span></div>
    </div>

    ${dueCount > 0 ? `
    <div class="due-banner" onclick="startReview()">
      <div class="due-banner-inner">
        <div class="due-icon">📅</div>
        <div>
          <div class="due-title">Daily Review Ready</div>
          <div class="due-sub">${dueCount} word${dueCount !== 1 ? 's' : ''} due for review today</div>
        </div>
        <div class="due-arrow">›</div>
      </div>
    </div>
    ` : ''}

    ${wotd ? `
    <div class="wotd-card">
      <div class="wotd-label">Word of the Day</div>
      <div class="wotd-it">${wotd.it} <button class="speak-mini" onclick="speak('${wotd.it.replace(/'/g,"\\'")}')">🔊</button></div>
      ${state.settings.ipa ? `<div class="wotd-ipa">[${wotd.ipa}]</div>` : ''}
      <div class="wotd-en">${wotd.en}</div>
      ${wotd.ex ? `<div class="wotd-ex">"${wotd.ex}"</div>` : ''}
    </div>
    ` : ''}

    <div class="section-title">Study Modes</div>
    <div class="mode-grid">
      ${renderModeCard('flash',   '🃏', 'Flashcards',    'Flip & rate words')}
      ${renderModeCard('quiz',    '🧠', 'Quiz',          '4-choice MCQ')}
      ${renderModeCard('spritzi', '⚡', 'Spritzi',       'Speed game, 3 lives')}
      ${renderModeCard('listen',  '👂', 'Listening',     'Hear & identify')}
      ${renderModeCard('cloze',   '📝', 'Sentences',     'Fill in the blank')}
      ${renderModeCard('speak',   '🎤', 'Speak',         'Pronunciation practice')}
      ${renderModeCard('dailyquiz','🎴','Daily Quiz',    'Flip 10, self-grade')}
    </div>

    <div class="section-title">Vocabulary Packs</div>
    <div class="packs-list" id="packs-list">
      ${renderPackCards()}
    </div>
  `;

  // Enrich pack cards with mastery after render
  enrichMastery();
}

function renderModeCard(id, icon, title, sub) {
  return `
    <div class="mode-card" onclick="setTab('${id}')">
      <div class="mode-icon">${icon}</div>
      <div class="mode-title">${title}</div>
      <div class="mode-sub">${sub}</div>
    </div>
  `;
}

function renderPackCards() {
  return Object.entries(PACK_MAP).map(([id, info]) => {
    const cached = state.allPacksCache[id];
    const wordCount = cached ? cached.words.length : '~100';
    const mastery = cached ? getMastery(id, cached.words) : null;
    const emoji = cached ? cached.emoji : '📦';
    const name  = cached ? cached.name  : id;
    return `
      <div class="pack-card" onclick="openPack('${id}')">
        <div class="pack-left">
          <span class="pack-emoji">${emoji}</span>
          <div class="pack-info">
            <div class="pack-name">${name}</div>
            <div class="pack-count">${wordCount} words</div>
          </div>
        </div>
        <div class="pack-right">
          ${mastery !== null ? `
            <div class="mastery-ring" data-pack="${id}">
              <svg viewBox="0 0 36 36" class="mastery-svg">
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/>
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="3"
                  stroke-dasharray="${Math.round(mastery * 0.942)} 100"
                  stroke-linecap="round" transform="rotate(-90 18 18)"/>
              </svg>
              <span class="mastery-pct">${mastery}%</span>
            </div>
          ` : `<div class="mastery-ring" data-pack="${id}"><span class="mastery-pct">—</span></div>`}
          <span class="pack-arrow">›</span>
        </div>
      </div>
    `;
  }).join('');
}

async function enrichMastery() {
  // Load any not-yet-cached packs in background and update mastery %
  for (const [id] of Object.entries(PACK_MAP)) {
    if (!state.allPacksCache[id]) continue;
    const ring = document.querySelector(`.mastery-ring[data-pack="${id}"]`);
    if (!ring) continue;
    const pack = state.allPacksCache[id];
    const m = getMastery(id, pack.words);
    ring.innerHTML = `
      <svg viewBox="0 0 36 36" class="mastery-svg">
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" stroke-width="3"/>
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="3"
          stroke-dasharray="${Math.round(m * 0.942)} 100"
          stroke-linecap="round" transform="rotate(-90 18 18)"/>
      </svg>
      <span class="mastery-pct">${m}%</span>
    `;
  }
}

function getWordOfDay() {
  const allWords = Object.values(state.allPacksCache).flatMap(p => p ? p.words : []);
  if (!allWords.length) return null;
  const dayIdx = Math.floor(Date.now() / 86400000);
  return allWords[dayIdx % allWords.length];
}

async function openPack(packId) {
  showLoading();
  try {
    const data = await loadPack(packId);
    state.packId   = packId;
    state.packData = data;
    state.packWords = data.words;
    hideLoading();
    showPackModal(data);
  } catch (e) {
    hideLoading();
    showToast('Failed to load pack 😕');
  }
}

function showPackModal(pack) {
  const mastery = getMastery(state.packId, pack.words);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <span class="modal-emoji">${pack.emoji}</span>
        <h2>${pack.name}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="modal-mastery">
        <div class="mastery-bar-wrap">
          <div class="mastery-bar-fill" style="width:${mastery}%"></div>
        </div>
        <span class="mastery-label">${mastery}% mastered · ${pack.words.length} words</span>
      </div>
      <div class="modal-modes">
        <button class="modal-btn" onclick="startMode('flash')">🃏 Flashcards</button>
        <button class="modal-btn" onclick="startMode('quiz')">🧠 Quiz</button>
        <button class="modal-btn" onclick="startMode('spritzi')">⚡ Spritzi</button>
        <button class="modal-btn" onclick="startMode('listen')">👂 Listening</button>
        <button class="modal-btn" onclick="startMode('cloze')">📝 Sentences</button>
        <button class="modal-btn" onclick="startMode('speak')">🎤 Speak</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function startMode(mode) {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  setTab(mode);
}

/* ── Flash Tab ───────────────────────────────────────────────── */
function renderFlash(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'flash', '🃏', 'Flashcards', 'Pick a pack to start flipping.');
  }

  if (!state.sessionQueue.length) {
    state.sessionQueue = buildWeightedQueue(state.packWords, state.packId);
    state.sessionIdx   = 0;
    state.sessionFlipped = false;
    updateStreak();
  }

  const word = state.sessionQueue[state.sessionIdx];
  if (!word) { state.sessionQueue = []; return renderFlash(app); }

  const flipped = state.sessionFlipped;
  const progress = `${state.sessionIdx + 1} / ${state.sessionQueue.length}`;

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSession()">← ${state.packData?.name || 'Pack'}</button>
      <span class="progress-text">${progress}</span>
      <button class="icon-btn" onclick="speak('${word.it.replace(/'/g,"\\'")}')">🔊</button>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.sessionIdx / state.sessionQueue.length) * 100}%"></div></div>

    <div class="flash-card ${flipped ? 'flipped' : ''}" onclick="flipCard()" id="flash-card">
      <div class="flash-front">
        <div class="flash-it">${word.it}</div>
        ${state.settings.ipa ? `<div class="flash-ipa">[${word.ipa}]</div>` : ''}
        <div class="flash-tap">tap to reveal</div>
      </div>
      <div class="flash-back">
        <div class="flash-en">${word.en}</div>
        <div class="flash-cat">${word.cat || ''}</div>
        ${word.ex ? `<div class="flash-ex">"${word.ex}"<div class="flash-exen">${word.exEn || ''}</div></div>` : ''}
        ${word.cat === 'Verb' && CONJUGATIONS[word.it] ? `<button class="conj-inline-btn" onclick="event.stopPropagation(); showConjugation('${word.it}')">📋 Conjugate</button>` : ''}
      </div>
    </div>

    <div class="rating-row">
      <button class="rate-btn hard ${flipped ? '' : 'pre-flip'}" onclick="${flipped ? 'rateCard(0)' : 'flipCard()'}">😓 Hard</button>
      <button class="rate-btn good ${flipped ? '' : 'pre-flip'}" onclick="${flipped ? 'rateCard(1)' : 'flipCard()'}">🙂 Good</button>
      <button class="rate-btn easy ${flipped ? '' : 'pre-flip'}" onclick="${flipped ? 'rateCard(2)' : 'flipCard()'}">😄 Easy</button>
    </div>

    <div class="session-footer">
      <label class="toggle-row">
        <input type="checkbox" ${state.settings.autoSpeak ? 'checked' : ''} onchange="toggleAutoSpeak(this.checked)">
        <span>Auto-speak</span>
      </label>
      <label class="toggle-row">
        <input type="checkbox" ${state.settings.ipa ? 'checked' : ''} onchange="toggleIPA(this.checked)">
        <span>Show IPA</span>
      </label>
  `;

  if (state.settings.autoSpeak) speak(word.it);
}

function flipCard() {
  state.sessionFlipped = !state.sessionFlipped;
  render();
}

function rateCard(rating) {
  const word = state.sessionQueue[state.sessionIdx];
  const correct = rating >= 1;
  recordResult(state.packId, word, correct);
  if (!correct) {} // already recorded
  addXP(rating + 1);
  state.sessionIdx++;
  state.sessionFlipped = false;
  if (state.sessionIdx >= state.sessionQueue.length) {
    state.sessionQueue = [];
  }
  render();
}

function exitSession() {
  state.sessionQueue  = [];
  state.sessionIdx    = 0;
  state.sessionFlipped = false;
  state.listenQueue   = [];
  state.clozeQueue    = [];
  state.speakQueue    = [];
  state.reviewMode    = false;
  state.dailyQueue    = [];
  state.dailyIdx      = 0;
  state.dailyFlipped  = false;
  state.dailyRight    = 0;
  state.dailyWrong    = 0;
  render();
}

/* ── Daily Quiz ──────────────────────────────────────────────── */
async function buildDailyQueue() {
  await loadAllPacks();
  const all = [];
  for (const [packId, pack] of Object.entries(state.allPacksCache)) {
    if (!pack) continue;
    for (const w of pack.words) all.push({ ...w, _packId: packId });
  }
  return shuffle(all).slice(0, 10);
}

async function renderDailyQuiz(app) {
  if (!state.dailyQueue.length) {
    app.innerHTML = `<div class="loading-inline">Preparing your 10 words…</div>`;
    const queue = await buildDailyQueue();
    if (state.tab !== 'dailyquiz') return; // user navigated away mid-load
    state.dailyQueue = queue;
    state.dailyIdx = 0;
    state.dailyFlipped = false;
    state.dailyRight = 0;
    state.dailyWrong = 0;
    updateStreak();
  }

  // Session complete → score screen
  if (state.dailyIdx >= state.dailyQueue.length) {
    return renderDailyScore(app);
  }

  const word = state.dailyQueue[state.dailyIdx];
  const flipped = state.dailyFlipped;
  const progress = `${state.dailyIdx + 1} / ${state.dailyQueue.length}`;

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="quitDaily()">← Daily Quiz</button>
      <span class="progress-text">${progress}</span>
      <span class="progress-text">✅ ${state.dailyRight} · ❌ ${state.dailyWrong}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.dailyIdx / state.dailyQueue.length) * 100}%"></div></div>

    <div class="flash-card ${flipped ? 'flipped' : ''}" onclick="flipDaily()" id="daily-card">
      <div class="flash-front">
        <div class="flash-it">${word.it}</div>
      </div>
      <div class="flash-back">
        <div class="daily-it-small">${word.it} <button class="speak-mini" onclick="event.stopPropagation(); speak('${word.it.replace(/'/g,"\\'")}')">🔊</button></div>
        <div class="flash-en">${word.en}</div>
        ${word.ex ? `<div class="flash-ex">"${word.ex}"<div class="flash-exen">${word.exEn || ''}</div></div>` : ''}
      </div>
    </div>

    <div class="daily-grade-row">
      <button class="daily-btn wrong ${flipped ? '' : 'pre-flip'}" onclick="${flipped ? 'gradeDaily(false)' : 'flipDaily()'}" aria-label="Got it wrong">✕</button>
      <button class="daily-btn right ${flipped ? '' : 'pre-flip'}" onclick="${flipped ? 'gradeDaily(true)' : 'flipDaily()'}" aria-label="Got it right">✓</button>
    </div>
  `;
}

function flipDaily() {
  if (state.dailyFlipped) return;
  state.dailyFlipped = true;
  const word = state.dailyQueue[state.dailyIdx];
  if (word) speak(word.it); // sound always plays on flip
  render();
}

function gradeDaily(correct) {
  const word = state.dailyQueue[state.dailyIdx];
  if (!word) return;
  if (correct) { state.dailyRight++; addXP(2); }
  else         { state.dailyWrong++; }
  recordResult(word._packId, word, correct);
  state.dailyIdx++;
  state.dailyFlipped = false;
  render();
}

function renderDailyScore(app) {
  const right = state.dailyRight;
  const wrong = state.dailyWrong;
  const total = state.dailyQueue.length;
  const perfect = wrong === 0;
  const pct = total ? Math.round((right / total) * 100) : 0;

  app.innerHTML = `
    <div class="score-screen">
      <div class="score-emoji">${perfect ? '🏆' : pct >= 70 ? '💪' : '📖'}</div>
      <h2>${perfect ? 'Perfetto!' : 'Daily Quiz Complete'}</h2>
      <div class="score-big">${right}/${total}</div>
      <div class="score-sub">✅ ${right} right · ❌ ${wrong} wrong</div>
      <div class="score-meter"><div class="score-meter-fill" style="width:${pct}%"></div></div>
      ${perfect
        ? `<div class="score-detail">You nailed all ${total} words. Ready for a fresh set?</div>
           <div class="score-actions">
             <button class="primary-btn" onclick="newDailyRound()">✨ 10 New Words</button>
             <button class="secondary-btn" onclick="quitDaily()">Done</button>
           </div>`
        : `<div class="score-detail">You missed ${wrong} word${wrong !== 1 ? 's' : ''}. Want to run the same 10 again?</div>
           <div class="score-actions">
             <button class="primary-btn" onclick="retryDailyRound()">🔁 Same Words Again</button>
             <button class="secondary-btn" onclick="newDailyRound()">✨ 10 New Words</button>
             <button class="secondary-btn" onclick="quitDaily()">Done</button>
           </div>`}
    </div>
  `;
  if (perfect) confetti();
}

function retryDailyRound() {
  state.dailyQueue = shuffle(state.dailyQueue);
  state.dailyIdx = 0;
  state.dailyFlipped = false;
  state.dailyRight = 0;
  state.dailyWrong = 0;
  render();
}

function quitDaily() {
  state.dailyQueue = [];
  state.dailyIdx = 0;
  state.dailyFlipped = false;
  state.dailyRight = 0;
  state.dailyWrong = 0;
  setTab('home');
}

function newDailyRound() {
  state.dailyQueue = [];
  state.dailyIdx = 0;
  state.dailyFlipped = false;
  state.dailyRight = 0;
  state.dailyWrong = 0;
  render();
}

/* ── Listening Mode ──────────────────────────────────────────── */
function renderListen(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'listen', '👂', 'Listening', 'Pick a pack, then identify what you hear.');
  }

  if (!state.listenQueue.length) {
    state.listenQueue  = buildWeightedQueue(state.packWords, state.packId, 20);
    state.listenIdx    = 0;
    state.listenScore  = 0;
    state.listenTotal  = 0;
    updateStreak();
  }

  if (state.listenIdx >= state.listenQueue.length) {
    return renderListenScore(app);
  }

  const word = state.listenQueue[state.listenIdx];
  const progress = `${state.listenIdx + 1} / ${state.listenQueue.length}`;

  // Build options: word.en + 3 distractors
  const distractors = pickDistractors(word, state.packWords, 3);
  const options = shuffle([word.en, ...distractors]);

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSession()">← ${state.packData?.name || 'Pack'}</button>
      <span class="progress-text">${progress}</span>
      <span class="score-text">⭐ ${state.listenScore}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.listenIdx / state.listenQueue.length) * 100}%"></div></div>

    <div class="listen-center">
      <div class="listen-prompt">What do you hear?</div>
      <button class="listen-play-btn" onclick="speak('${word.it.replace(/'/g,"\\'")}')">
        <span class="listen-icon">🔊</span>
        <span>Tap to play</span>
      </button>
      <div class="listen-hint">Press play, then choose the English meaning</div>
    </div>

    <div class="quiz-options">
      ${options.map(opt => `
        <button class="quiz-opt" onclick="answerListen(this, '${opt.replace(/'/g,"\\'")}', '${word.en.replace(/'/g,"\\'")}', '${word.it.replace(/'/g,"\\'")}')">
          ${opt}
        </button>
      `).join('')}
    </div>
  `;

  // Auto-play
  setTimeout(() => speak(word.it), 300);
}

function answerListen(btn, chosen, correct, it) {
  const isCorrect = chosen === correct;
  const allBtns = document.querySelectorAll('.quiz-opt');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === correct) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  const word = state.listenQueue[state.listenIdx];
  recordResult(state.packId, word, isCorrect);
  if (isCorrect) {
    state.listenScore++;
    addXP(2);
  }
  state.listenTotal++;
  state.listenIdx++;

  setTimeout(() => render(), isCorrect ? 600 : 1200);
}

function renderListenScore(app) {
  const pct = Math.round((state.listenScore / state.listenTotal) * 100) || 0;
  if (pct >= 80) confetti();
  app.innerHTML = scoreScreen('👂', 'Listening Complete!', state.listenScore, state.listenTotal, pct, 'listen');
}

/* ── Cloze / Sentence Mode ───────────────────────────────────── */
function buildClozeQueue(words, packId, limit = 20) {
  // Only use words that have an example sentence
  const withEx = words.filter(w => w.ex && w.ex.toLowerCase().includes(w.it.toLowerCase()));
  return buildWeightedQueue(withEx.length >= 5 ? withEx : words, packId, limit);
}

function renderCloze(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'cloze', '📝', 'Sentences', 'Pick a pack to practice fill-in-the-blank.');
  }

  if (!state.clozeQueue.length) {
    state.clozeQueue  = buildClozeQueue(state.packWords, state.packId);
    state.clozeIdx    = 0;
    state.clozeScore  = 0;
    state.clozeTotal  = 0;
    updateStreak();
  }

  if (state.clozeIdx >= state.clozeQueue.length) {
    return renderClozeScore(app);
  }

  const word = state.clozeQueue[state.clozeIdx];
  const progress = `${state.clozeIdx + 1} / ${state.clozeQueue.length}`;

  // Build the cloze sentence
  const sentence = word.ex || `Usa la parola "${word.it}".`;
  const blank = '___________';
  const regex = new RegExp(word.it.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const clozeSentence = sentence.replace(regex, `<span class="cloze-blank">${blank}</span>`);

  // 4 options
  const distractors = pickDistractors(word, state.packWords, 3);
  const options = shuffle([word.it, ...distractors.map(d => {
    const found = state.packWords.find(w => w.en === d);
    return found ? found.it : d;
  })]);

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSession()">← ${state.packData?.name || 'Pack'}</button>
      <span class="progress-text">${progress}</span>
      <span class="score-text">⭐ ${state.clozeScore}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.clozeIdx / state.clozeQueue.length) * 100}%"></div></div>

    <div class="cloze-center">
      <div class="cloze-label">Fill in the blank</div>
      <div class="cloze-sentence">${clozeSentence}</div>
      ${word.exEn ? `<div class="cloze-translation">${word.exEn.replace(word.en, '<em>' + word.en + '</em>')}</div>` : ''}
      <button class="listen-play-btn small" onclick="speak('${sentence.replace(/'/g,"\\'")}')">🔊 Hear sentence</button>
    </div>

    <div class="quiz-options">
      ${options.map(opt => `
        <button class="quiz-opt" onclick="answerCloze(this, '${opt.replace(/'/g,"\\'")}', '${word.it.replace(/'/g,"\\'")}')">
          ${opt}
        </button>
      `).join('')}
    </div>
  `;
}

function answerCloze(btn, chosen, correct) {
  const isCorrect = chosen.toLowerCase() === correct.toLowerCase();
  const allBtns = document.querySelectorAll('.quiz-opt');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim().toLowerCase() === correct.toLowerCase()) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  const word = state.clozeQueue[state.clozeIdx];
  recordResult(state.packId, word, isCorrect);
  if (isCorrect) {
    state.clozeScore++;
    addXP(3);
  }
  state.clozeTotal++;
  state.clozeIdx++;

  setTimeout(() => render(), isCorrect ? 600 : 1400);
}

function renderClozeScore(app) {
  const pct = Math.round((state.clozeScore / state.clozeTotal) * 100) || 0;
  if (pct >= 80) confetti();
  app.innerHTML = scoreScreen('📝', 'Sentences Complete!', state.clozeScore, state.clozeTotal, pct, 'cloze');
}

/* ── Pronunciation / Speak Mode ──────────────────────────────── */
function renderSpeak(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'speak', '🎤', 'Pronunciation', 'Pick a pack and practice speaking Italian aloud.');
  }

  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    app.innerHTML = `
      <div class="game-header">
        <button class="back-btn" onclick="exitSession()">← Back</button>
      </div>
      <div class="empty-state">
        <div style="font-size:48px">🎤</div>
        <h3>Speech Recognition Unavailable</h3>
        <p>This feature requires Chrome on desktop or Safari on iOS 17+. Try switching browsers.</p>
        <button class="primary-btn" onclick="exitSession()">Go Back</button>
      </div>
    `;
    return;
  }

  if (!state.speakQueue.length) {
    state.speakQueue  = buildWeightedQueue(state.packWords, state.packId, 15);
    state.speakIdx    = 0;
    state.speakScore  = 0;
    state.speakTotal  = 0;
    updateStreak();
  }

  if (state.speakIdx >= state.speakQueue.length) {
    return renderSpeakScore(app);
  }

  const word = state.speakQueue[state.speakIdx];
  const progress = `${state.speakIdx + 1} / ${state.speakQueue.length}`;

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSession()">← ${state.packData?.name || 'Pack'}</button>
      <span class="progress-text">${progress}</span>
      <span class="score-text">⭐ ${state.speakScore}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.speakIdx / state.speakQueue.length) * 100}%"></div></div>

    <div class="speak-center">
      <div class="speak-prompt">Say this word in Italian:</div>
      <div class="speak-en">${word.en}</div>
      ${state.settings.ipa ? `<div class="speak-hint">${word.it} &nbsp;[${word.ipa}]</div>` : `<div class="speak-hint">${word.it}</div>`}
      <button class="listen-play-btn small" onclick="speak('${word.it.replace(/'/g,"\\'")}')">🔊 Hear it first</button>
    </div>

    <div class="speak-controls">
      <div class="speak-status" id="speak-status">${state.isListening ? '🎙️ Listening...' : 'Ready to listen'}</div>
      <button class="mic-btn ${state.isListening ? 'active' : ''}" id="mic-btn" onclick="toggleMic('${word.it.replace(/'/g,"\\'")}', '${word.en.replace(/'/g,"\\'")}')">
        ${state.isListening ? '⏹ Stop' : '🎤 Speak'}
      </button>
      <button class="skip-speak-btn" onclick="skipSpeak()">Skip →</button>
    </div>
    <div id="speak-result"></div>
  `;
}

function toggleMic(target, en) {
  if (state.isListening) {
    if (state.recognition) state.recognition.stop();
    state.isListening = false;
    render();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SpeechRecognition();
  rec.lang = 'it-IT';
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  state.recognition = rec;
  state.isListening = true;

  const statusEl = $('speak-status');
  const micBtn = $('mic-btn');
  if (statusEl) statusEl.textContent = '🎙️ Listening...';
  if (micBtn) { micBtn.textContent = '⏹ Stop'; micBtn.classList.add('active'); }

  rec.onresult = (e) => {
    const alts = Array.from(e.results[0]).map(r => r.transcript.toLowerCase().trim());
    const targetNorm = target.toLowerCase().trim();
    const matched = alts.some(alt => {
      const dist = levenshtein(alt, targetNorm);
      return dist <= Math.max(1, Math.floor(targetNorm.length * 0.25));
    });

    state.isListening = false;
    const word = state.speakQueue[state.speakIdx];
    recordResult(state.packId, word, matched);

    const resultEl = $('speak-result');
    if (resultEl) {
      resultEl.innerHTML = `
        <div class="speak-feedback ${matched ? 'correct' : 'wrong'}">
          ${matched
            ? `✅ Great pronunciation! You said: "<em>${alts[0]}</em>"`
            : `❌ Try again — you said: "<em>${alts[0]}</em>". Target: <strong>${target}</strong>`}
        </div>
      `;
    }

    if (matched) {
      state.speakScore++;
      addXP(4);
    }
    state.speakTotal++;
    state.speakIdx++;

    const micBtn2 = $('mic-btn');
    const statusEl2 = $('speak-status');
    if (micBtn2) { micBtn2.textContent = '🎤 Speak'; micBtn2.classList.remove('active'); }
    if (statusEl2) statusEl2.textContent = matched ? '✅ Correct!' : '❌ Try the next one';

    setTimeout(() => render(), matched ? 800 : 1800);
  };

  rec.onerror = () => {
    state.isListening = false;
    const s = $('speak-status');
    if (s) s.textContent = 'Could not hear — try again';
    const m = $('mic-btn');
    if (m) { m.textContent = '🎤 Speak'; m.classList.remove('active'); }
  };

  rec.onend = () => {
    if (state.isListening) {
      state.isListening = false;
      const m = $('mic-btn');
      if (m) { m.textContent = '🎤 Speak'; m.classList.remove('active'); }
    }
  };

  rec.start();
}

function skipSpeak() {
  if (state.recognition) { try { state.recognition.stop(); } catch {} }
  state.isListening = false;
  state.speakIdx++;
  state.speakTotal++;
  render();
}

function renderSpeakScore(app) {
  const pct = Math.round((state.speakScore / state.speakTotal) * 100) || 0;
  if (pct >= 80) confetti();
  app.innerHTML = scoreScreen('🎤', 'Pronunciation Complete!', state.speakScore, state.speakTotal, pct, 'speak');
}

/* ── Daily Review ────────────────────────────────────────────── */
async function startReview() {
  showLoading();
  await loadAllPacks();
  const queue = buildReviewQueue();
  if (!queue.length) {
    showToast('No words due right now — check back later! 🎉');
    hideLoading();
    return;
  }
  hideLoading();
  // Use first word's packId as context, but mark reviewMode
  state.reviewMode = true;
  // Pick the pack of the first word
  const packId = queue[0]._packId;
  const pack = state.allPacksCache[packId];
  state.packId   = packId;
  state.packData = pack;
  state.packWords = pack ? pack.words : [];
  state.sessionQueue = queue;
  state.sessionIdx   = 0;
  state.sessionFlipped = false;
  setTab('flash');
}

/* ── Quiz Tab ────────────────────────────────────────────────── */
function renderQuiz(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'quiz', '🧠', 'Quiz', 'Pick a pack to start the quiz.');
  }

  if (!state.sessionQueue.length) {
    state.sessionQueue = buildWeightedQueue(state.packWords, state.packId);
    state.sessionIdx   = 0;
    state.quizScore    = 0;
    state.quizTotal    = 0;
    updateStreak();
  }

  if (state.sessionIdx >= state.sessionQueue.length) {
    return renderQuizScore(app);
  }

  const word = state.sessionQueue[state.sessionIdx];
  const progress = `${state.sessionIdx + 1} / ${state.sessionQueue.length}`;
  const distractors = pickDistractors(word, state.packWords, 3);
  const options = shuffle([word.en, ...distractors]);
  const itSafe = word.it.replace(/'/g, "\'");

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSession()">← ${state.packData?.name || 'Pack'}</button>
      <span class="progress-text">${progress}</span>
      <span class="score-text">⭐ ${state.quizScore}/${state.quizTotal}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(state.sessionIdx / state.sessionQueue.length) * 100}%"></div></div>

    <div class="quiz-word-card">
      <div class="quiz-it">${word.it}</div>
      ${state.settings.ipa ? `<div class="quiz-ipa">[${word.ipa}]</div>` : ''}
      <div class="quiz-card-actions">
        <button class="speak-mini" onclick="speak('${itSafe}')">🔊</button>
        ${word.cat === 'Verb' && CONJUGATIONS[word.it] ? `<button class="conj-inline-btn" onclick="showConjugation('${word.it}')">📋 Conjugate</button>` : ''}
      </div>
    </div>

    <div class="quiz-options">
      ${options.map(opt => `
        <button class="quiz-opt" onclick="answerQuiz(this, '${opt.replace(/'/g,"\\'")}', '${word.en.replace(/'/g,"\\'")}')">
          ${opt}
        </button>
      `).join('')}
    </div>
  `;
}

function answerQuiz(btn, chosen, correct) {
  const isCorrect = chosen === correct;
  const allBtns = document.querySelectorAll('.quiz-opt');
  allBtns.forEach(b => {
    b.disabled = true;
    if (b.textContent.trim() === correct) b.classList.add('correct');
  });
  if (!isCorrect) btn.classList.add('wrong');

  const word = state.sessionQueue[state.sessionIdx];
  recordResult(state.packId, word, isCorrect);
  if (isCorrect) { state.quizScore++; addXP(2); }
  state.quizTotal++;
  state.sessionIdx++;
  setTimeout(() => render(), isCorrect ? 600 : 1200);
}

function renderQuizScore(app) {
  const pct = Math.round((state.quizScore / state.quizTotal) * 100) || 0;
  if (pct >= 80) confetti();
  app.innerHTML = scoreScreen('🧠', 'Quiz Complete!', state.quizScore, state.quizTotal, pct, 'quiz');
  state.sessionQueue = [];
}

/* ── Spritzi Tab ─────────────────────────────────────────────── */
function renderSpritzi(app) {
  if (!state.packId) {
    return renderModeSelector(app, 'spritzi', '⚡', 'Spritzi', 'Pick a pack for the speed game.');
  }

  if (!state.sprRunning && !state.sessionQueue.length) {
    return renderSprStart(app);
  }

  if (!state.sprRunning && state.sprLives <= 0) {
    return renderSprGameOver(app);
  }

  if (!state.sessionQueue.length) {
    return renderSprGameOver(app);
  }

  if (!state.sprRunning) {
    state.sprRunning = true;
    startSprTimer();
  }

  const word = state.sessionQueue[state.sessionIdx % state.sessionQueue.length];
  const distractors = pickDistractors(word, state.packWords, 4);
  const options = shuffle([word.en, ...distractors]).slice(0, 5);

  app.innerHTML = `
    <div class="game-header">
      <button class="back-btn" onclick="exitSpritzi()">✕</button>
      <div class="spr-lives">${'❤️'.repeat(state.sprLives)}${'🖤'.repeat(3 - state.sprLives)}</div>
      <div class="spr-score">⭐ ${state.sprScore} | 🔥 ${state.sprStreak}</div>
    </div>

    <div class="spr-timer-bar">
      <div class="spr-timer-fill" id="spr-timer-fill" style="width:${(state.sprTimeLeft / 15) * 100}%"></div>
    </div>

    <div class="spr-word-card">
      <div class="spr-it">${word.it}</div>
      ${state.settings.ipa ? `<div class="spr-ipa">[${word.ipa}]</div>` : ''}
      <button class="speak-mini" onclick="speak('${word.it.replace(/'/g,"\\'")}')">🔊</button>
    </div>

    <div class="spr-options">
      ${options.map(opt => `
        <button class="spr-opt" onclick="answerSpritzi(this, '${opt.replace(/'/g,"\\'")}', '${word.en.replace(/'/g,"\\'")}')">
          ${opt}
        </button>
      `).join('')}
    </div>
  `;
}

function renderSprStart(app) {
  state.sessionQueue = buildWeightedQueue(state.packWords, state.packId, 50);
  state.sessionIdx   = 0;
  state.sprScore     = 0;
  state.sprLives     = 3;
  state.sprStreak    = 0;
  state.sprTimeLeft  = 15;
  app.innerHTML = `
    <div class="game-header"><button class="back-btn" onclick="exitSession()">← Back</button></div>
    <div class="empty-state">
      <div style="font-size:56px">⚡</div>
      <h2>Spritzi Speed Game</h2>
      <p>5 choices · 3 lives · 15 second timer per word</p>
      <p><em>${state.packData?.name}</em></p>
      <button class="primary-btn" onclick="state.sprRunning=true; render()">Start!</button>
    </div>
  `;
}

function startSprTimer() {
  clearInterval(state.sprTimer);
  state.sprTimeLeft = 15;
  state.sprTimer = setInterval(() => {
    state.sprTimeLeft--;
    const fill = $('spr-timer-fill');
    if (fill) fill.style.width = `${(state.sprTimeLeft / 15) * 100}%`;
    if (state.sprTimeLeft <= 0) {
      clearInterval(state.sprTimer);
      loseLife();
    }
  }, 1000);
}

function loseLife() {
  state.sprLives--;
  state.sprStreak = 0;
  state.sessionIdx++;
  if (state.sprLives <= 0) {
    state.sprRunning = false;
    render();
  } else {
    startSprTimer();
    render();
  }
}

function answerSpritzi(btn, chosen, correct) {
  clearInterval(state.sprTimer);
  const isCorrect = chosen === correct;
  const allBtns = document.querySelectorAll('.spr-opt');
  allBtns.forEach(b => { b.disabled = true; if (b.textContent.trim() === correct) b.classList.add('correct'); });
  if (!isCorrect) btn.classList.add('wrong');

  const word = state.sessionQueue[state.sessionIdx % state.sessionQueue.length];
  recordResult(state.packId, word, isCorrect);

  if (isCorrect) {
    state.sprScore++;
    state.sprStreak++;
    addXP(3 + Math.floor(state.sprStreak / 3));
    if (state.sprStreak > 0 && state.sprStreak % 5 === 0) confetti();
  } else {
    state.sprLives--;
    state.sprStreak = 0;
  }
  state.sessionIdx++;

  if (state.sprLives <= 0) {
    state.sprRunning = false;
    setTimeout(() => render(), 800);
  } else {
    setTimeout(() => {
      startSprTimer();
      render();
    }, isCorrect ? 400 : 900);
  }
}

function renderSprGameOver(app) {
  state.sprRunning = false;
  const hi = Math.max(state.sprScore, parseInt(localStorage.getItem('spr-hi') || '0'));
  localStorage.setItem('spr-hi', hi);
  if (state.sprScore >= hi && state.sprScore > 0) confetti();
  app.innerHTML = `
    <div class="score-screen">
      <div class="score-emoji">⚡</div>
      <h2>Game Over!</h2>
      <div class="score-big">${state.sprScore}</div>
      <div class="score-sub">points scored</div>
      <div class="score-detail">Personal best: ${hi}</div>
      <div class="score-actions">
        <button class="primary-btn" onclick="resetSpritzi()">Play Again</button>
        <button class="secondary-btn" onclick="exitSession()">Back to Packs</button>
      </div>
    </div>
  `;
}

function exitSpritzi() {
  clearInterval(state.sprTimer);
  state.sprRunning = false;
  exitSession();
}

function resetSpritzi() {
  state.sessionQueue = [];
  state.sprRunning   = false;
  state.sprLives     = 3;
  state.sprScore     = 0;
  state.sprStreak    = 0;
  state.sprTimeLeft  = 15;
  render();
}

/* ── Progress Tab ────────────────────────────────────────────── */
function renderProgress(app) {
  const totalWords = Object.values(state.allPacksCache).reduce((s, p) => s + (p ? p.words.length : 0), 0);
  const studiedWords = Object.keys(state.progress).length;
  const masteredWords = Object.values(state.progress).filter(p => p?.bucket >= 2).length;
  const weakWords = getWeakWords(50);

  app.innerHTML = `
    <div class="page-header">
      <h2>Progress</h2>
      <button onclick="toggleTheme()" class="icon-btn">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
    </div>

    <div class="progress-stats-grid">
      <div class="prog-stat">
        <div class="prog-num">${state.streak.count}</div>
        <div class="prog-lbl">🔥 Day Streak</div>
      </div>
      <div class="prog-stat">
        <div class="prog-num">${state.xp}</div>
        <div class="prog-lbl">⭐ Total XP</div>
      </div>
      <div class="prog-stat">
        <div class="prog-num">${studiedWords}</div>
        <div class="prog-lbl">📚 Seen</div>
      </div>
      <div class="prog-stat">
        <div class="prog-num">${masteredWords}</div>
        <div class="prog-lbl">✅ Mastered</div>
      </div>
    </div>

    <div class="section-title">
      ❌ Weak Words
      <span class="section-sub">(most errors first)</span>
    </div>

    ${weakWords.length === 0 ? `
      <div class="empty-state small">
        <p>No mistakes yet — keep studying! 💪</p>
      </div>
    ` : `
      <div class="weak-list">
        ${weakWords.map(w => `
          <div class="weak-card" onclick="showWordDetail('${w.it.replace(/'/g,"\\'")}', '${(w._packId || state.packId || '')}')">
            <div class="weak-left">
              <div class="weak-it">${w.it}</div>
              <div class="weak-en">${w.en}</div>
            </div>
            <div class="weak-right">
              <span class="weak-errors">${w._errors} ✗</span>
              <span class="weak-bucket">lvl ${w._bucket}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="secondary-btn center-btn" onclick="startWeakWordsPractice()">
        Practice Weak Words
      </button>
    `}

    <div class="section-title">Pack Mastery</div>
    <div class="pack-mastery-list">
      ${Object.entries(PACK_MAP).map(([id]) => {
        const pack = state.allPacksCache[id];
        if (!pack) return '';
        const m = getMastery(id, pack.words);
        return `
          <div class="pack-mastery-row">
            <span class="pack-mastery-emoji">${pack.emoji}</span>
            <div class="pack-mastery-info">
              <div class="pack-mastery-name">${pack.name}</div>
              <div class="pack-mastery-bar-wrap">
                <div class="pack-mastery-bar-fill" style="width:${m}%"></div>
              </div>
            </div>
            <span class="pack-mastery-pct">${m}%</span>
          </div>
        `;
      }).join('')}
    </div>

    <div class="section-title">Conjugation Tables</div>
    <div class="conj-list">
      ${Object.entries(CONJUGATIONS).map(([verb, data]) => `
        <button class="conj-btn" onclick="showConjugation('${verb}')">
          ${verb} <span class="conj-en">${data.en}</span>
        </button>
      `).join('')}
    </div>
  `;
}

async function startWeakWordsPractice() {
  showLoading();
  await loadAllPacks();
  const weak = getWeakWords(40);
  if (!weak.length) { showToast('No weak words yet!'); hideLoading(); return; }
  hideLoading();
  const packId = weak[0]._packId;
  const pack = state.allPacksCache[packId];
  state.packId    = packId;
  state.packData  = pack;
  state.packWords = pack ? pack.words : [];
  state.sessionQueue = weak;
  state.sessionIdx = 0;
  state.sessionFlipped = false;
  setTab('flash');
}

function showConjugation(verb) {
  const data = CONJUGATIONS[verb];
  if (!data) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal conj-modal">
      <div class="modal-header">
        <h2>${verb}</h2>
        <span class="modal-subtitle">${data.en}</span>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      ${['present','past','future'].map(tense => `
        <div class="conj-tense">
          <div class="conj-tense-label">${tense.charAt(0).toUpperCase() + tense.slice(1)}</div>
          <div class="conj-grid">
            ${PERSONS.map((p, i) => `
              <div class="conj-row">
                <span class="conj-person">${p}</span>
                <span class="conj-form">${data[tense][i]}</span>
                <button class="conj-speak" onclick="speak('${data[tense][i]}')">🔊</button>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function showWordDetail(it, packId) {
  const pack = state.allPacksCache[packId];
  if (!pack) return;
  const word = pack.words.find(w => w.it === it);
  if (!word) return;
  const k = wordKey(packId, word);
  const errors = state.errors[k] || 0;
  const bucket = getBucket(k);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2>${word.it}</h2>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div class="word-detail">
        <div class="wd-row"><span class="wd-lbl">English</span><span class="wd-val">${word.en}</span></div>
        <div class="wd-row"><span class="wd-lbl">IPA</span><span class="wd-val">[${word.ipa}]</span></div>
        <div class="wd-row"><span class="wd-lbl">Category</span><span class="wd-val">${word.cat || '—'}</span></div>
        <div class="wd-row"><span class="wd-lbl">Level</span><span class="wd-val">Bucket ${bucket} / 5</span></div>
        <div class="wd-row"><span class="wd-lbl">Errors</span><span class="wd-val">${errors}</span></div>
        ${word.ex ? `
        <div class="wd-example">
          <div class="wd-lbl">Example</div>
          <div class="wd-ex-it">${word.ex}</div>
          <div class="wd-ex-en">${word.exEn || ''}</div>
        </div>` : ''}
        ${word.cat === 'Verb' && CONJUGATIONS[word.it] ? `<button class="secondary-btn" onclick="showConjugation('${word.it}')">📋 Conjugate ${word.it}</button>` : ''}
        <button class="primary-btn" onclick="speak('${word.it.replace(/'/g,"\\'")}')">🔊 Hear it</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

/* ── Mode Selector (no pack chosen) ─────────────────────────── */
function renderModeSelector(app, mode, icon, title, desc) {
  app.innerHTML = `
    <div class="page-header">
      <h2>${icon} ${title}</h2>
      <button onclick="toggleTheme()" class="icon-btn">${state.theme === 'dark' ? '☀️' : '🌙'}</button>
    </div>
    <div class="empty-state">
      <div style="font-size:52px">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
    </div>
    <div class="section-title">Choose a Pack</div>
    <div class="packs-list">
      ${Object.entries(PACK_MAP).map(([id]) => {
        const pack = state.allPacksCache[id];
        const emoji = pack ? pack.emoji : '📦';
        const name = pack ? pack.name : id;
        const m = pack ? getMastery(id, pack.words) : null;
        return `
          <div class="pack-card" onclick="selectPackForMode('${id}', '${mode}')">
            <div class="pack-left">
              <span class="pack-emoji">${emoji}</span>
              <div class="pack-info">
                <div class="pack-name">${name}</div>
                <div class="pack-count">${pack ? pack.words.length : '~100'} words</div>
              </div>
            </div>
            <div class="pack-right">
              ${m !== null ? `<span class="pack-mastery-badge">${m}%</span>` : ''}
              <span class="pack-arrow">›</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function selectPackForMode(packId, mode) {
  showLoading();
  try {
    const data = await loadPack(packId);
    state.packId    = packId;
    state.packData  = data;
    state.packWords = data.words;
    state.sessionQueue = [];
    state.listenQueue  = [];
    state.clozeQueue   = [];
    state.speakQueue   = [];
    hideLoading();
    render();
  } catch (e) {
    hideLoading();
    showToast('Failed to load pack 😕');
  }
}

/* ── Score screen helper ─────────────────────────────────────── */
function scoreScreen(icon, title, score, total, pct, mode) {
  return `
    <div class="score-screen">
      <div class="score-emoji">${icon}</div>
      <h2>${title}</h2>
      <div class="score-big">${score}/${total}</div>
      <div class="score-sub">${pct}% correct</div>
      <div class="score-meter">
        <div class="score-meter-fill" style="width:${pct}%"></div>
      </div>
      <div class="score-actions">
        <button class="primary-btn" onclick="resetMode('${mode}')">Try Again</button>
        <button class="secondary-btn" onclick="exitSession()">Back to Packs</button>
      </div>
    </div>
  `;
}

function resetMode(mode) {
  state.sessionQueue = [];
  state.listenQueue  = [];
  state.clozeQueue   = [];
  state.speakQueue   = [];
  state.sessionIdx   = 0;
  render();
}

/* ── Loading / Toast ─────────────────────────────────────────── */
function showLoading() {
  let l = $('loading-overlay');
  if (!l) {
    l = document.createElement('div');
    l.id = 'loading-overlay';
    l.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(l);
  }
  l.style.display = 'flex';
}

function hideLoading() {
  const l = $('loading-overlay');
  if (l) l.style.display = 'none';
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}

/* ── About / Settings sheet ──────────────────────────────────── */
function showAboutSheet() {
  const totalWords = Object.values(state.allPacksCache).reduce((s, p) => s + (p ? p.words.length : 0), 0);
  const studiedWords = Object.keys(state.progress).length;
  const masteredWords = Object.values(state.progress).filter(p => p?.bucket >= 2).length;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal about-modal">
      <div class="modal-header">
        <span class="modal-emoji">🇮🇹</span>
        <div>
          <h2>Segneri</h2>
          <div class="modal-subtitle">Italian Vocabulary Trainer</div>
        </div>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>

      <div class="about-version-row">
        <span class="about-version-badge">v${APP_VERSION}</span>
        <span class="about-version-date">June 2026</span>
      </div>

      <div class="about-stats-row">
        <div class="about-stat">
          <div class="about-stat-num">${totalWords || '2,005'}</div>
          <div class="about-stat-lbl">Words</div>
        </div>
        <div class="about-stat">
          <div class="about-stat-num">20</div>
          <div class="about-stat-lbl">Packs</div>
        </div>
        <div class="about-stat">
          <div class="about-stat-num">${studiedWords}</div>
          <div class="about-stat-lbl">Studied</div>
        </div>
        <div class="about-stat">
          <div class="about-stat-num">${masteredWords}</div>
          <div class="about-stat-lbl">Mastered</div>
        </div>
      </div>

      <div class="about-section-label">App</div>
      <div class="about-menu">
        <a href="demo.html" class="about-row">
          <span class="about-row-icon">▶️</span>
          <span class="about-row-label">App Demo</span>
          <span class="about-row-value muted">See how it works</span>
        </a>
        <a href="whats-new.html" class="about-row">
          <span class="about-row-icon">✨</span>
          <span class="about-row-label">What's New in v${APP_VERSION}</span>
          <span class="about-row-arrow">›</span>
        </a>
        <div class="about-row" onclick="toggleThemeFromSheet(this)">
          <span class="about-row-icon">${state.theme === 'dark' ? '☀️' : '🌙'}</span>
          <span class="about-row-label">Appearance</span>
          <span class="about-row-value">${state.theme === 'dark' ? 'Dark' : 'Light'}</span>
        </div>
        <div class="about-row" onclick="toggleIPAFromSheet(this)">
          <span class="about-row-icon">🔤</span>
          <span class="about-row-label">Show IPA</span>
          <div class="about-toggle ${state.settings.ipa ? 'on' : ''}" id="ipa-toggle"></div>
        </div>
        <div class="about-row" onclick="toggleAutoSpeakFromSheet(this)">
          <span class="about-row-icon">🔊</span>
          <span class="about-row-label">Auto-speak in Flashcards</span>
          <div class="about-toggle ${state.settings.autoSpeak ? 'on' : ''}" id="autospeak-toggle"></div>
        </div>
      </div>

      <div class="about-section-label">Support</div>
      <div class="about-menu">
        <div class="about-row" onclick="hardRefresh()">
          <span class="about-row-icon">🔄</span>
          <span class="about-row-label">Force Refresh App</span>
          <span class="about-row-value muted">Clears cache &amp; reloads</span>
        </div>
        <div class="about-row danger" onclick="confirmResetProgress()">
          <span class="about-row-icon">🗑️</span>
          <span class="about-row-label">Reset All Progress</span>
          <span class="about-row-arrow">›</span>
        </div>
      </div>

      <div class="about-section-label">Privacy</div>
      <div class="about-privacy">
        <p>Segneri stores your progress, streak, and XP <strong>only on this device</strong> using localStorage. No account, no server, no data ever leaves your phone. Clearing your browser data or uninstalling will erase your progress.</p>
        <p>The app uses your microphone only when you tap the 🎤 Speak button — it is never accessed in the background.</p>
        <p>Text-to-speech uses your device's built-in voice engine. No audio is recorded or transmitted.</p>
      </div>

      <div class="about-footer">
        Made with ❤️ &nbsp;·&nbsp; No ads &nbsp;·&nbsp; No account needed
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function toggleThemeFromSheet(row) {
  toggleTheme();
  const icon = row.querySelector('.about-row-icon');
  const val  = row.querySelector('.about-row-value');
  if (icon) icon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  if (val)  val.textContent  = state.theme === 'dark' ? 'Dark' : 'Light';
}

function toggleIPAFromSheet(row) {
  state.settings.ipa = !state.settings.ipa;
  savePersisted();
  const toggle = row.querySelector('.about-toggle');
  if (toggle) toggle.classList.toggle('on', state.settings.ipa);
}

function toggleAutoSpeakFromSheet(row) {
  state.settings.autoSpeak = !state.settings.autoSpeak;
  savePersisted();
  const toggle = row.querySelector('.about-toggle');
  if (toggle) toggle.classList.toggle('on', state.settings.autoSpeak);
}

async function hardRefresh() {
  showToast('Clearing cache…');
  try {
    // 1. Unregister all service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    // 2. Delete all caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch(e) {}
  // 3. Redirect with cache-bust param so browser fetches fresh HTML
  window.location.href = window.location.pathname + '?v=' + Date.now();
}

function confirmResetProgress() {
  const confirm = document.createElement('div');
  confirm.className = 'modal-overlay';
  confirm.style.zIndex = '600';
  confirm.innerHTML = `
    <div class="modal" style="padding-bottom: calc(env(safe-area-inset-bottom) + 24px);">
      <div class="modal-header"><h2>Reset Progress?</h2></div>
      <p style="color:var(--muted);font-size:14px;margin-bottom:24px;line-height:1.5;">
        This will permanently delete your streak, XP, and all word progress. Your vocabulary packs stay intact.
      </p>
      <div style="display:flex;gap:10px;">
        <button class="secondary-btn" style="flex:1" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="primary-btn" style="flex:1;background:var(--accent)" onclick="resetAllProgress()">Reset</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirm);
  confirm.addEventListener('click', e => { if (e.target === confirm) confirm.remove(); });
}

function resetAllProgress() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ERRORS_KEY);
  localStorage.removeItem(SEEN_KEY);
  localStorage.removeItem(STREAK_KEY);
  localStorage.removeItem(XP_KEY);
  state.progress = {};
  state.errors   = {};
  state.seen     = {};
  state.streak   = { count: 0, lastDate: null };
  state.xp       = 0;
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
  showToast('Progress reset ✓');
  render();
}

/* ── Navigation ──────────────────────────────────────────────── */
function setTab(tab) {
  // Clear game state when switching away from active modes
  clearInterval(state.sprTimer);
  state.sprRunning = false;
  if (state.recognition) { try { state.recognition.stop(); } catch {} }
  state.isListening = false;

  state.tab = tab;
  render();
  window.scrollTo(0, 0);
}

/* ── Settings toggles ────────────────────────────────────────── */
function toggleAutoSpeak(val) { state.settings.autoSpeak = val; savePersisted(); }
function toggleIPA(val)       { state.settings.ipa = val; savePersisted(); render(); }

/* ── Keyboard shortcuts ──────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (state.tab === 'flash') {
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    if (e.key === 'ArrowLeft')  rateCard(0);
    if (e.key === 'ArrowDown')  rateCard(1);
    if (e.key === 'ArrowRight') rateCard(2);
  }
});

/* ── PWA install prompt ──────────────────────────────────────── */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(() => showInstallBanner(), 3000);
});

function showInstallBanner() {
  if (!deferredPrompt) return;
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <span>📱 Add Segneri to your home screen!</span>
    <button onclick="installApp()">Install</button>
    <button onclick="this.parentNode.remove()">✕</button>
  `;
  document.body.appendChild(banner);
}

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  document.querySelector('.install-banner')?.remove();
}

/* ── Service Worker ──────────────────────────────────────────── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

/* ── Init ────────────────────────────────────────────────────── */
async function init() {
  loadPersisted();
  applyTheme();
  initVoices();
  render();

  // Eagerly load packs in background so mastery % shows immediately
  loadAllPacks().then(() => {
    // Refresh home if still on it
    if (state.tab === 'home') renderHome($('app'));
  });
}

document.addEventListener('DOMContentLoaded', init);
