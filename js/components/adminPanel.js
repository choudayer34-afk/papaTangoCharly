// Panneau d'administration technique (retour de Charles-Henri, vague 22 quater : "je n'ai pas
// de console d'administration qui ne doit être visible que pour mon compte
// ch-houdayer@hotmail.fr [...] tous les liens vers les applications tierces, le lien pour
// copier l'url de l'appli elle-même et [...] la modale de tuto qui va bien [...] appli par
// appli") — même principe que sur EnVie/eProtec (CSSCT) : un point d'accès unique vers les
// services tiers dont dépend l'appli, chacun avec un lien direct ET une explication pas-à-pas
// des tâches d'administration courantes propres à ce service précis.
//
// Visible uniquement pour son propre compte : les autres personnes autorisées à utiliser
// Pilotage (liste blanche, voir js/services/firebase.js#isEmailAllowed) n'ont aucune raison de
// voir ni de toucher aux réglages d'infrastructure (hébergement, base de données, code source).
// Ce n'est volontairement PAS un mécanisme de sécurité — juste un bouton masqué pour les autres
// — la vraie protection des données reste les règles Firestore, indépendantes de cette UI.

import { openModal } from "./modal.js";
import { showToast } from "./toast.js";
import { getCurrentUser, ADMIN_EMAIL } from "../services/firebase.js";

// Une entrée par application tierce. `tutorialHtml` répond à un besoin concret et récurrent
// pour CETTE application précise plutôt qu'à une checklist générique — pour Firebase, c'est la
// gestion de la liste blanche tout juste livrée ; pour Cloudflare et GitHub, les questions les
// plus probables une fois l'appli en ligne (vérifier un déploiement, retrouver l'historique).
const THIRD_PARTY_APPS = [
  {
    key: "firebase",
    emoji: "🔥",
    name: "Firebase",
    description: "Comptes autorisés et données (Firestore + Authentification).",
    url: "https://console.firebase.google.com/project/papatangocharly/overview",
    tutorialTitle: "Firebase — gérer les comptes autorisés",
    tutorialHtml: `
      <p><strong>Autoriser une nouvelle personne à utiliser Pilotage :</strong></p>
      <ol style="padding-left:20px;">
        <li>Ouvre <strong>Firestore Database</strong> → onglet <strong>Data</strong>.</li>
        <li>Ouvre (ou crée) la collection <code>allowedUsers</code>.</li>
        <li>Clique <strong>Ajouter un document</strong> : comme ID de document, mets son email
          <strong>en minuscules</strong> (ex. <code>alice.dupont@gmail.com</code>). Le contenu
          du document n'a pas d'importance, seule son existence compte.</li>
      </ol>
      <p><strong>Retirer un accès :</strong> supprime son document dans <code>allowedUsers</code>.
        Si la personne a déjà une session ouverte dans son navigateur, ça ne coupe qu'à sa
        prochaine reconnexion, pas immédiatement.</p>
      <p><strong>Créer un compte email/mot de passe</strong> (si la personne n'a pas de compte
        Google) : <strong>Authentication</strong> → <strong>Users</strong> →
        <strong>Add user</strong>. Sans ça, elle se connecte simplement avec
        "Continuer avec Google".</p>
      <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Les règles de
        sécurité Firestore (onglet <strong>Rules</strong>) sont ce qui protège réellement les
        données de chacun — cette liste blanche seule n'est qu'un confort d'usage.</p>
    `,
  },
  {
    key: "cloudflare",
    emoji: "☁️",
    name: "Cloudflare Pages",
    description: "Hébergement de l'application — se met à jour tout seul.",
    url: "https://dash.cloudflare.com",
    tutorialTitle: "Cloudflare Pages — vérifier une mise en ligne",
    tutorialHtml: `
      <p>Chaque nouvelle version du code envoyée sur GitHub est automatiquement mise en ligne
        ici — il n'y a normalement rien à faire de ce côté.</p>
      <p><strong>Pour vérifier qu'une mise à jour s'est bien passée :</strong></p>
      <ol style="padding-left:20px;">
        <li><strong>Workers & Pages</strong> → le projet <strong>papatangocharly</strong>.</li>
        <li>L'onglet <strong>Deployments</strong> liste les mises en ligne récentes, la plus
          récente en haut, avec son statut.</li>
      </ol>
      <p><strong>Pour rattacher un nom de domaine à toi :</strong> onglet
        <strong>Custom domains</strong>.</p>
    `,
  },
  {
    key: "github",
    emoji: "🐙",
    name: "GitHub",
    description: "Code source de l'application.",
    url: "https://github.com/choudayer34-afk/papaTangoCharly",
    tutorialTitle: "GitHub — historique du code",
    tutorialHtml: `
      <p>C'est ici que vit le code de Pilotage. Tu n'as normalement pas besoin d'y toucher
        directement : chaque évolution arrive sous forme de fichier prêt à l'emploi (patch ou
        zip) dans la conversation, avec les instructions pour l'appliquer.</p>
      <p><strong>Pour consulter l'historique des évolutions passées :</strong> onglet
        <strong>Commits</strong>, sur la page du dépôt.</p>
    `,
  },
];

export function mountAdminButton() {
  if (document.querySelector(".admin-fab")) return;
  const user = getCurrentUser();
  if (!user || (user.email || "").toLowerCase() !== ADMIN_EMAIL) return;

  const btn = document.createElement("button");
  btn.className = "help-fab admin-fab";
  btn.setAttribute("aria-label", "Administration");
  btn.textContent = "🔧";
  btn.addEventListener("click", openAdminPanel);
  document.body.appendChild(btn);
}

function openAdminPanel() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="admin-app-url">Lien de l'application</label>
      <div style="display:flex;gap:8px;">
        <input id="admin-app-url" type="text" readonly value="${window.location.origin}" style="flex:1;" />
        <button type="button" id="admin-copy-app-url" class="btn btn-secondary">📋 Copier</button>
      </div>
    </div>
    <div class="field">
      <label>Applications tierces</label>
      <div id="admin-apps-list"></div>
    </div>
  `;

  const listEl = body.querySelector("#admin-apps-list");
  THIRD_PARTY_APPS.forEach((app) => {
    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "10px";
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <div style="font-weight:600;">${app.emoji} ${app.name}</div>
          <div class="item-meta">${app.description}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn btn-ghost btn-sm admin-tuto-btn" title="Comment faire ?">❓</button>
          <button type="button" class="btn btn-secondary btn-sm admin-open-btn">Ouvrir ↗</button>
        </div>
      </div>
    `;
    row.querySelector(".admin-open-btn").addEventListener("click", () => {
      window.open(app.url, "_blank", "noopener");
    });
    row.querySelector(".admin-tuto-btn").addEventListener("click", () => {
      openAppTutorial(app);
    });
    listEl.appendChild(row);
  });

  const { bodyEl } = openModal({
    title: "🔧 Administration",
    body,
    dismissible: true,
  });

  bodyEl.querySelector("#admin-copy-app-url").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      showToast("Lien copié");
    } catch {
      showToast("Impossible de copier — sélectionne et copie-le manuellement");
    }
  });
}

// Modale dédiée par application (plutôt qu'un simple lien) : Charles-Henri veut retrouver, au
// clic, le mode d'emploi des tâches d'administration qui reviennent le plus souvent pour CETTE
// application précise (ex. "comment ajouter un nouveau compte" pour Firebase) — pas juste être
// redirigé sans explication vers une console tierce qu'il n'ouvre qu'occasionnellement.
function openAppTutorial(app) {
  const body = document.createElement("div");
  body.innerHTML = app.tutorialHtml;
  openModal({
    title: app.tutorialTitle,
    body,
    dismissible: true,
    actions: [
      // "← Retour" plutôt qu'un simple "Fermer" : rouvre le panneau d'administration derrière,
      // puisque l'ouvrir a fermé cette modale-ci (une seule modale à la fois, voir modal.js) —
      // évite d'avoir à recliquer sur 🔧 pour consulter le tuto d'une autre application tierce.
      { label: "← Retour", variant: "ghost", onClick: () => openAdminPanel() },
      {
        label: `Ouvrir ${app.name} ↗`,
        variant: "primary",
        onClick: () => window.open(app.url, "_blank", "noopener"),
      },
    ],
  });
}
