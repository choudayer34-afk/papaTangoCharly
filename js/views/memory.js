// "🧠 Mémoire & TDAH" — demande explicite de Charles-Henri (01/09/2026, à la suite de la
// discussion sur la mémoire de travail et l'immédiateté du quotidien) : "une rubrique pour
// travailler sur les éléments du TDAH ou la mémoire avec des exercices ou des trucs ludiques".
// Cadrage posé avant construction (AskUserQuestion) : un MÉLANGE varié plutôt qu'un seul type
// d'exercice — trois formats courts, volontairement différents : un jeu de mémoire (paires),
// un exercice d'attention/concentration (respiration guidée), un entraînement de mémoire de
// travail (rappel de séquence). Pas un programme d'entraînement sérieux avec suivi de
// progression — juste une pause ludique, cohérent avec "pas de nouvelle décision à prendre
// pour que ça marche" : rien n'est enregistré d'une visite à l'autre (pas de score persistant,
// volontairement, pour rester léger — voir doc de suivi si Charles-Henri en redemande).
//
// Accessible depuis un bouton sur l'Accueil (pas depuis ❓ Aide, qui est réservé aux pages de
// référence Guide/Nouveautés) — cohérent avec le principe "réduire les silos de navigation" :
// ça vit là où Charles-Henri regarde déjà tous les jours plutôt que dans un endroit à retenir.

import { showToast } from "../components/toast.js";

const PAIR_EMOJIS = ["🍎", "🚗", "🎈", "🐳", "⭐", "🎧", "🌵", "🍩", "🎲", "🦊"];
const SEQUENCE_EMOJIS = ["🔵", "🟢", "🟡", "🟣", "🔴", "🟠"];
const BREATH_PHASES = [
  { label: "Inspire", seconds: 4 },
  { label: "Retiens", seconds: 4 },
  { label: "Expire", seconds: 4 },
  { label: "Retiens", seconds: 4 },
];

// Un seul minuteur actif à la fois (respiration) — nettoyé au changement d'exercice et à la
// sortie de la vue (valeur de retour de renderMemoryTraining, consommée par currentCleanup
// dans js/app.js, même contrat que les autres vues).
let activeInterval = null;
function stopActiveInterval() {
  if (activeInterval) {
    clearInterval(activeInterval);
    activeInterval = null;
  }
}

const EXERCISES = [
  { id: "pairs", icon: "🧩", title: "Jeu des paires", desc: "Un petit memory classique — retrouve les paires d'emojis cachées." },
  { id: "breathing", icon: "🌬️", title: "Respiration guidée", desc: "4 secondes pour inspirer, 4 pour retenir, 4 pour expirer, 4 pour retenir — le temps de souffler entre deux tâches." },
  { id: "sequence", icon: "🔢", title: "Rappel de séquence", desc: "Une suite de couleurs s'affiche brièvement — reproduis-la dans le bon ordre. La longueur augmente à chaque réussite." },
];

export function renderMemoryTraining(container) {
  stopActiveInterval();
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>🧠 Mémoire &amp; TDAH</h1>
        <div class="subtitle">Trois pauses courtes et ludiques, à faire quand tu en as besoin</div>
      </div>
      <a href="#/dashboard" class="btn btn-secondary btn-sm">← Retour</a>
    </div>
    <div class="view" id="memory-body"></div>
  `;

  const body = container.querySelector("#memory-body");
  body.innerHTML = `
    <p class="item-meta" style="font-size:var(--font-size-md);margin-bottom:16px;">
      Pas un programme d'entraînement sérieux avec suivi de progression — juste de quoi
      souffler deux minutes. Rien n'est enregistré d'une visite à l'autre : l'idée est de
      jouer, pas de battre un score.
    </p>
    <div id="memory-picker" style="display:flex;flex-direction:column;gap:10px;"></div>
    <div id="memory-play" style="margin-top:16px;"></div>
  `;

  const picker = body.querySelector("#memory-picker");
  const playArea = body.querySelector("#memory-play");

  for (const ex of EXERCISES) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.dataset.exercise = ex.id;
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${ex.icon} ${ex.title}</div>
        <div class="item-meta">${ex.desc}</div>
      </div>
    `;
    row.addEventListener("click", () => {
      stopActiveInterval();
      playArea.innerHTML = "";
      if (ex.id === "pairs") renderPairsGame(playArea);
      else if (ex.id === "breathing") renderBreathingExercise(playArea);
      else if (ex.id === "sequence") renderSequenceGame(playArea);
    });
    picker.appendChild(row);
  }

  // Nettoyage à la sortie de la vue — évite qu'un minuteur de respiration continue de tourner
  // en arrière-plan après avoir changé d'écran (même contrat que currentCleanup, js/app.js).
  return () => stopActiveInterval();
}

// ============================================================
// --- 🧩 Jeu des paires ---
// ============================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderPairsGame(container) {
  const PAIR_COUNT = 6;
  let deck = [];
  let flipped = [];
  let matchedCount = 0;
  let moves = 0;
  let busy = false;

  function buildDeck() {
    const chosen = shuffle(PAIR_EMOJIS).slice(0, PAIR_COUNT);
    deck = shuffle([...chosen, ...chosen]).map((emoji) => ({ emoji, matched: false }));
    flipped = [];
    matchedCount = 0;
    moves = 0;
    busy = false;
  }

  buildDeck();

  container.innerHTML = `
    <div class="card">
      <div class="item-title" style="margin-bottom:8px;">🧩 Jeu des paires</div>
      <div class="item-meta" id="pairs-status" style="margin-bottom:10px;"></div>
      <div id="pairs-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;max-width:340px;"></div>
      <button id="pairs-restart" class="btn btn-secondary btn-sm" style="margin-top:12px;">🔄 Recommencer</button>
    </div>
  `;

  const grid = container.querySelector("#pairs-grid");
  const status = container.querySelector("#pairs-status");

  function updateStatus() {
    status.textContent = `${matchedCount}/${PAIR_COUNT} paires trouvées — ${moves} coup${moves === 1 ? "" : "s"}`;
  }

  function renderGrid() {
    grid.innerHTML = "";
    deck.forEach((card, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary";
      btn.dataset.index = String(i);
      btn.dataset.emoji = card.emoji;
      const isRevealed = card.matched || flipped.includes(i);
      btn.textContent = isRevealed ? card.emoji : "❓";
      btn.style.fontSize = "22px";
      btn.style.aspectRatio = "1";
      btn.style.opacity = card.matched ? "0.55" : "1";
      btn.disabled = card.matched;
      btn.addEventListener("click", () => onCardClick(i));
      grid.appendChild(btn);
    });
  }

  function onCardClick(i) {
    if (busy || flipped.includes(i) || deck[i].matched) return;
    flipped.push(i);
    renderGrid();
    if (flipped.length === 2) {
      moves++;
      updateStatus();
      const [a, b] = flipped;
      if (deck[a].emoji === deck[b].emoji) {
        deck[a].matched = true;
        deck[b].matched = true;
        matchedCount++;
        flipped = [];
        renderGrid();
        updateStatus();
        if (matchedCount === PAIR_COUNT) {
          showToast(`🎉 Terminé en ${moves} coups !`);
        }
      } else {
        busy = true;
        setTimeout(() => {
          flipped = [];
          busy = false;
          renderGrid();
        }, 700);
      }
    }
  }

  container.querySelector("#pairs-restart").addEventListener("click", () => {
    buildDeck();
    renderGrid();
    updateStatus();
  });

  renderGrid();
  updateStatus();
}

// ============================================================
// --- 🌬️ Respiration guidée ---
// ============================================================

function renderBreathingExercise(container) {
  let phaseIndex = 0;
  let secondsLeft = BREATH_PHASES[0].seconds;
  let running = false;

  container.innerHTML = `
    <div class="card" style="text-align:center;">
      <div class="item-title" style="margin-bottom:12px;">🌬️ Respiration guidée</div>
      <div id="breathing-circle" class="breathing-circle">
        <span id="breathing-phase">Prêt</span>
        <span id="breathing-count" class="item-meta"></span>
      </div>
      <button id="breathing-toggle" class="btn btn-primary" style="margin-top:16px;">▶️ Démarrer</button>
    </div>
  `;

  const phaseEl = container.querySelector("#breathing-phase");
  const countEl = container.querySelector("#breathing-count");
  const circleEl = container.querySelector("#breathing-circle");
  const toggleBtn = container.querySelector("#breathing-toggle");

  function tick() {
    secondsLeft--;
    if (secondsLeft <= 0) {
      phaseIndex = (phaseIndex + 1) % BREATH_PHASES.length;
      secondsLeft = BREATH_PHASES[phaseIndex].seconds;
    }
    render();
  }

  function render() {
    const phase = BREATH_PHASES[phaseIndex];
    phaseEl.textContent = phase.label;
    countEl.textContent = String(secondsLeft);
    circleEl.classList.toggle("breathing-in", phase.label === "Inspire");
    circleEl.classList.toggle("breathing-out", phase.label === "Expire");
  }

  toggleBtn.addEventListener("click", () => {
    running = !running;
    if (running) {
      phaseIndex = 0;
      secondsLeft = BREATH_PHASES[0].seconds;
      render();
      toggleBtn.textContent = "⏹️ Arrêter";
      stopActiveInterval();
      activeInterval = setInterval(tick, 1000);
    } else {
      stopActiveInterval();
      toggleBtn.textContent = "▶️ Démarrer";
      phaseEl.textContent = "Prêt";
      countEl.textContent = "";
      circleEl.classList.remove("breathing-in", "breathing-out");
    }
  });
}

// ============================================================
// --- 🔢 Rappel de séquence ---
// ============================================================

function renderSequenceGame(container) {
  let length = 3;
  let sequence = [];
  let answer = [];
  let showingAnswerButtons = false;

  container.innerHTML = `
    <div class="card">
      <div class="item-title" style="margin-bottom:8px;">🔢 Rappel de séquence</div>
      <div class="item-meta" id="sequence-status" style="margin-bottom:10px;">Longueur actuelle : ${length}</div>
      <div id="sequence-display" style="display:flex;gap:8px;margin-bottom:12px;min-height:44px;"></div>
      <div id="sequence-answer" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
      <button id="sequence-start" class="btn btn-primary btn-sm" style="margin-top:12px;">▶️ Lancer</button>
    </div>
  `;

  const statusEl = container.querySelector("#sequence-status");
  const displayEl = container.querySelector("#sequence-display");
  const answerEl = container.querySelector("#sequence-answer");
  const startBtn = container.querySelector("#sequence-start");

  function renderChip(el, emoji) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = emoji;
    chip.style.fontSize = "20px";
    el.appendChild(chip);
  }

  function startRound() {
    sequence = Array.from({ length }, () => shuffle(SEQUENCE_EMOJIS)[0]);
    answer = [];
    showingAnswerButtons = false;
    statusEl.textContent = `Longueur actuelle : ${length} — mémorise l'ordre...`;
    displayEl.innerHTML = "";
    answerEl.innerHTML = "";
    startBtn.disabled = true;
    for (const emoji of sequence) renderChip(displayEl, emoji);

    setTimeout(() => {
      displayEl.innerHTML = "";
      sequence.forEach(() => renderChip(displayEl, "❓"));
      statusEl.textContent = `Longueur actuelle : ${length} — reproduis l'ordre ci-dessous`;
      renderAnswerButtons();
    }, 1200 + length * 500);
  }

  function renderAnswerButtons() {
    showingAnswerButtons = true;
    answerEl.innerHTML = "";
    for (const emoji of shuffle(SEQUENCE_EMOJIS)) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-secondary btn-sm";
      btn.textContent = emoji;
      btn.style.fontSize = "18px";
      btn.addEventListener("click", () => onAnswerClick(emoji));
      answerEl.appendChild(btn);
    }
  }

  function onAnswerClick(emoji) {
    if (!showingAnswerButtons) return;
    answer.push(emoji);
    const idx = answer.length - 1;
    if (answer[idx] !== sequence[idx]) {
      showingAnswerButtons = false;
      showToast("Presque ! On repart à une séquence plus courte pour repartir sur de bonnes bases.");
      length = 3;
      startBtn.disabled = false;
      startBtn.textContent = "▶️ Réessayer";
      statusEl.textContent = `Longueur actuelle : ${length}`;
      displayEl.innerHTML = "";
      answerEl.innerHTML = "";
      return;
    }
    if (answer.length === sequence.length) {
      showingAnswerButtons = false;
      showToast(`🎉 Bien joué ! Séquence de ${length} retenue.`);
      length++;
      startBtn.disabled = false;
      startBtn.textContent = "▶️ Continuer";
      statusEl.textContent = `Longueur actuelle : ${length}`;
      answerEl.innerHTML = "";
    }
  }

  startBtn.addEventListener("click", () => startRound());
}
