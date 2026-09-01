// Onboarding — visite guidée au premier lancement + bouton Aide toujours accessible.
// Constat de Charles-Henri : l'appli n'expliquait nulle part comment s'en servir, ni la
// distinction Tâche/Suivi qui structure tout le reste. Ce module ne crée aucune nouvelle
// donnée métier : il se contente d'expliquer ce qui existe déjà, et de mémoriser (via
// js/domain/preferences.js) que la visite a été vue pour ne pas la reproposer à chaque fois.

import { openModal, closeModal } from "./modal.js";
import * as preferencesApi from "../domain/preferences.js";

const TOUR_STEPS = [
  {
    emoji: "🧭",
    title: "Bienvenue dans Pilotage",
    text: "Une info arrive ? Un seul geste : le bouton + en bas à droite, n'importe où dans l'appli. Le reste peut attendre dans l'Inbox, sans pression — capturer et traiter sont deux choses différentes.",
  },
  {
    emoji: "📥",
    title: "L'Inbox : le sas d'entrée",
    text: "Chaque capture attend d'être qualifiée en un des 9 types (Action, Suivi, Projet, Réunion, Décision, Ressource, Information, Idée, Archiver). Une capture en attente n'est jamais un retard.",
  },
  {
    emoji: "✅",
    title: "Une Tâche, c'est moi qui la fais",
    text: "Toutes tes tâches vivent dans Pilotage (le Kanban) — pas besoin de te chercher comme « collaborateur », tout ce qui s'y trouve est déjà à toi.",
  },
  {
    emoji: "👀",
    title: "Un Suivi, c'est quelqu'un d'autre",
    text: "Un collaborateur ou un manager s'engage à faire quelque chose : tu le retrouves sur sa fiche dans Équipe, avec une date à laquelle TOI tu dois vérifier ou relancer.",
  },
  {
    emoji: "📣",
    title: "Rien à retenir par cœur",
    text: "Les suivis en retard de contrôle remontent seuls sur l'Accueil. L'historique de chaque fiche garde la trace de tout ce qui a été fait, modifié ou décidé — même des mois plus tard.",
  },
  {
    emoji: "🎉",
    title: "C'est parti",
    text: "Tu peux revoir cette visite, la distinction Tâche/Suivi, ou ouvrir le guide complet (casquette par casquette, cas d'usage détaillés) à tout moment avec le bouton ❓ en bas à gauche.",
  },
];

export function openTour() {
  let index = 0;

  function renderStep() {
    const step = TOUR_STEPS[index];
    const isLast = index === TOUR_STEPS.length - 1;

    const body = document.createElement("div");
    body.style.textAlign = "center";
    body.innerHTML = `
      <div style="font-size:2.6rem;margin-bottom:12px;">${step.emoji}</div>
      <p style="font-size:1.02rem;line-height:1.55;margin:0 0 18px;">${step.text}</p>
      <div style="display:flex;justify-content:center;gap:6px;">
        ${TOUR_STEPS.map(
          (_, i) =>
            `<span style="width:7px;height:7px;border-radius:50%;display:inline-block;background:${i === index ? "var(--color-primary)" : "var(--color-surface-alt)"};"></span>`
        ).join("")}
      </div>
    `;

    openModal({
      title: step.title,
      body,
      actions: [
        { label: "Passer", variant: "ghost" },
        isLast
          ? { label: "C'est compris", variant: "primary" }
          : {
              label: "Suivant",
              variant: "primary",
              closesModal: false,
              onClick: () => {
                index++;
                renderStep();
              },
            },
      ],
    });
  }

  renderStep();
}

/** Affiche la visite une seule fois, au tout premier lancement (§ mémorisé via preferences). */
export async function maybeShowFirstRunTour() {
  const prefs = await preferencesApi.getPreferences();
  if (prefs.seenTour) return;
  await preferencesApi.markTourSeen();
  openTour();
}

function openHelpModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <p style="margin-top:0;">Transformer ce qui arrive dans ton travail en actions suivies, sans rien oublier — sans avoir à être toi-même rigoureux pour que ça marche.</p>

    <div class="section-title" style="margin-top:0;">Tâche ou Suivi ?</div>
    <p><strong>✅ Tâche</strong> — c'est moi qui agis. Va dans Pilotage (Kanban).<br>
    <strong>👀 Suivi</strong> — quelqu'un d'autre s'engage. Va sur sa fiche dans Équipe, avec une date à laquelle je dois vérifier.</p>

    <div class="section-title">Le cycle d'une info</div>
    <p>➕ Capturer (n'importe où) → 📥 Inbox (en attente) → Qualifier (9 choix) → ça devient une vraie fiche, jamais perdue.</p>

    <div class="section-title">S'y retrouver plus tard</div>
    <p>Chaque fiche garde son 🕒 Historique. Le bouton 🕒 Tout l'historique sur l'Accueil ouvre le fil complet, tous types confondus.</p>

    <a id="full-guide-link" href="#/guide" class="btn btn-secondary btn-block" style="margin-top:8px;text-decoration:none;">📖 Ouvrir le guide complet</a>
    <a id="whatsnew-link" href="#/whatsnew" class="btn btn-secondary btn-block" style="margin-top:8px;text-decoration:none;">🆕 Voir les nouveautés</a>
    <button id="replay-tour-btn" class="btn btn-secondary btn-block" style="margin-top:8px;">🧭 Revoir la visite guidée</button>
  `;

  openModal({
    title: "❓ Aide",
    body,
    actions: [{ label: "Fermer", variant: "ghost" }],
  });

  // Le guide vit désormais dans l'app (route #/guide, hors ligne compatible — retour de
  // Charles-Henri) plutôt que sur une page externe : un simple changement de hash suffit,
  // pas besoin d'ouvrir un nouvel onglet ni de perdre la connexion pour y accéder.
  body.querySelector("#full-guide-link").addEventListener("click", () => closeModal());
  body.querySelector("#whatsnew-link").addEventListener("click", () => closeModal());
  body.querySelector("#replay-tour-btn").addEventListener("click", () => {
    closeModal();
    openTour();
  });
}

export function mountHelpButton() {
  if (document.querySelector(".help-fab")) return;
  const btn = document.createElement("button");
  btn.className = "help-fab";
  btn.type = "button";
  btn.setAttribute("aria-label", "Aide");
  btn.textContent = "?";
  btn.addEventListener("click", openHelpModal);
  document.body.appendChild(btn);
}
