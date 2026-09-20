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

import { openModal, confirmDelete } from "./modal.js";
import { showToast } from "./toast.js";
import { getCurrentUser, ADMIN_EMAIL } from "../services/firebase.js";
import * as usageTrackingApi from "../services/usageTracking.js";
import * as accountAdminApi from "../services/accountAdmin.js";
import * as tagsApi from "../domain/tags.js";
import * as preferencesApi from "../domain/preferences.js";

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
          du document n'a pas d'importance au moment de la création, seule son existence compte.</li>
      </ol>
      <p><strong>Fermer/ouvrir un accès, ou supprimer tout le contenu d'un compte :</strong> ça
        se fait maintenant directement dans l'app, depuis "👥 Comptes" juste au-dessus. Fermer un
        accès ne coupe qu'à la prochaine reconnexion si la personne a déjà une session ouverte
        dans son navigateur, pas immédiatement.</p>
      <p><strong>Créer un compte email/mot de passe</strong> (si la personne n'a pas de compte
        Google) : <strong>Authentication</strong> → <strong>Users</strong> →
        <strong>Add user</strong>. Sans ça, elle se connecte simplement avec
        "Continuer avec Google".</p>
      <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Les règles de
        sécurité Firestore (onglet <strong>Rules</strong>) sont ce qui protège réellement les
        données de chacun — cette liste blanche seule n'est qu'un confort d'usage.</p>
      <p><strong>Règle à poser pour que "👥 Comptes" fonctionne</strong> — le texte de
        référence est désormais versionné dans <code>firestore.rules</code> à la racine du
        dépôt (source unique, voir TODO_TECHNIQUE.md → TODO-001 : avant ce fichier, ce texte
        n'existait que recopié ici, sans garantie de rester synchronisé avec ce qui est
        réellement déployé). Colle-le dans <strong>Rules</strong>, à l'intérieur du bloc
        <code>service cloud.firestore { match /databases/{database}/documents { ... } }</code>
        déjà en place (ne remplace rien d'autre que les blocs <code>allowedUsers</code> et
        <code>users/{uid}</code> déjà présents) :</p>
      <pre style="background:var(--color-bg-alt);padding:10px;border-radius:var(--radius-sm);overflow-x:auto;font-size:var(--font-size-sm);">match /allowedUsers/{email} {
  allow get: if request.auth != null
              && request.auth.token.email.lower() == email;
  allow list: if request.auth != null
                && request.auth.token.email.lower() == "${ADMIN_EMAIL}";
  allow write: if request.auth != null
                && request.auth.token.email.lower() == "${ADMIN_EMAIL}";
}

match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null && request.auth.uid == uid
                        && get(/databases/$(database)/documents/allowedUsers/$(request.auth.token.email.lower())).data.disabled != true;
  allow read, write: if request.auth != null
                        && request.auth.token.email.lower() == "${ADMIN_EMAIL}";
}</pre>
      <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">Chacun ne peut
        désormais consulter que son propre statut dans <code>allowedUsers</code> (seul toi peux
        lister tous les comptes) ; fermer un compte depuis "👥 Comptes" coupe aussi son accès
        direct à Firestore, pas seulement l'écran de connexion.</p>
      <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">La deuxième règle
        de <code>users/{uid}</code> donne à ton propre compte un accès de secours à TOUTES les
        données de tout le monde — nécessaire pour exporter/supprimer le contenu d'un compte
        depuis "👥 Comptes". Décision actée le 15/09/2026 : cet accès permanent et large est
        conservé et assumé comme choix d'architecture, ce n'est pas une exception temporaire à
        retirer plus tard.</p>
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
    <div class="field">
      <label>Suivi d'usage</label>
      <button type="button" id="admin-usage-btn" class="btn btn-secondary">📊 Voir l'activité des comptes</button>
    </div>
    <div class="field">
      <label>Comptes</label>
      <button type="button" id="admin-accounts-btn" class="btn btn-secondary">👥 Comptes</button>
    </div>
    <div class="field">
      <label>Tags</label>
      <button type="button" id="admin-tags-btn" class="btn btn-secondary">🏷️ Gérer les tags</button>
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
    // Bouton "Fermer" explicite (retour de Charles-Henri, 13/09/2026 : "je suis parfois bloqué
    // comme sur administration") : cette modale n'avait jamais eu de bouton d'action, et son
    // champ "Lien de l'application" (readonly) désactivait par erreur le clic en dehors (voir
    // le correctif dans js/components/modal.js) — ne laissant plus que la touche Échap, jamais
    // suggérée à l'écran, pour en sortir. Toutes les modales de ce panneau (tutoriels, usage)
    // en ont une ("← Retour") ; celle-ci n'en avait pas, précisément parce qu'elle est la
    // première ouverte et n'a nulle part où "retourner".
    actions: [{ label: "Fermer", variant: "ghost" }],
  });

  bodyEl.querySelector("#admin-copy-app-url").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      showToast("Lien copié");
    } catch {
      showToast("Impossible de copier — sélectionne et copie-le manuellement");
    }
  });

  bodyEl.querySelector("#admin-usage-btn").addEventListener("click", () => {
    openUsagePanel();
  });
  bodyEl.querySelector("#admin-accounts-btn").addEventListener("click", () => {
    openAccountsAdminModal();
  });
  bodyEl.querySelector("#admin-tags-btn").addEventListener("click", () => {
    openTagsAdminModal();
  });
}

/**
 * Gestion des comptes (retour de Charles-Henri, 14/09/2026 : "en tant qu'administrateur je veux
 * pouvoir fermer / ouvrir un compte puis supprimer tout son contenu pour libérer l'espace sur
 * firebase si besoin") — voir js/services/accountAdmin.js pour toute la logique et les garde-fous
 * (compte fermé + sauvegarde téléchargée avant toute suppression). Même structure que
 * "🏷️ Gérer les tags" juste au-dessus : une liste de cartes, "← Retour" vers le panneau.
 */
async function openAccountsAdminModal() {
  const body = document.createElement("div");
  body.innerHTML = `<div class="empty-state" style="padding:16px;">Chargement…</div>`;
  const { bodyEl } = openModal({
    title: "👥 Comptes",
    body,
    dismissible: true,
    actions: [{ label: "← Retour", variant: "ghost", onClick: () => openAdminPanel() }],
  });

  await renderAccountsList(bodyEl);
}

async function renderAccountsList(bodyEl) {
  let accounts;
  try {
    accounts = await accountAdminApi.listAccounts();
  } catch {
    bodyEl.innerHTML = `<div class="empty-state" style="padding:16px;">Impossible de charger les comptes — vérifie la règle de sécurité Firestore pour "allowedUsers" (voir le tutoriel 🔥 Firebase, "← Retour" puis clique 🔥 Firebase).</div>`;
    return;
  }
  if (!accounts.length) {
    bodyEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun compte autorisé pour l'instant (voir le tutoriel 🔥 Firebase pour en inviter un).</div>`;
    return;
  }

  bodyEl.innerHTML = `
    <p class="item-meta" style="margin-bottom:16px;">
      <strong>Fermer</strong> : empêche une prochaine connexion (une session déjà ouverte ailleurs n'est coupée qu'à sa reconnexion suivante).
      <strong>Supprimer tout son contenu</strong> : irréversible, disponible uniquement une fois le compte fermé.
    </p>
    <div id="admin-accounts-list"></div>
  `;
  const listEl = bodyEl.querySelector("#admin-accounts-list");
  for (const acc of accounts) {
    const row = document.createElement("div");
    row.className = "card";
    row.style.marginBottom = "10px";
    const statusLabel = acc.disabled ? "🔒 Fermé" : "🔓 Ouvert";
    const wipedLabel = acc.contentWipedAt ? ` · 🗑️ vidé le ${formatDate(acc.contentWipedAt)}` : "";
    const seenLabel = acc.lastSeen ? `Dernière activité : ${formatDateTime(acc.lastSeen)}` : "Jamais connecté";
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <div style="font-weight:600;${acc.disabled ? "color:var(--color-text-muted);" : ""}">${escapeHtml(acc.email)}</div>
          <div class="item-meta">${statusLabel}${wipedLabel} · ${seenLabel}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn btn-secondary btn-sm admin-account-toggle">${acc.disabled ? "🔓 Ouvrir" : "🔒 Fermer"}</button>
          ${acc.disabled && acc.uid ? `<button type="button" class="btn btn-ghost btn-sm admin-account-wipe">🗑️ Supprimer tout son contenu</button>` : ""}
        </div>
      </div>
    `;
    row.querySelector(".admin-account-toggle").addEventListener("click", async () => {
      if (acc.disabled) await accountAdminApi.reopenAccount(acc.email);
      else await accountAdminApi.closeAccount(acc.email);
      renderAccountsList(bodyEl);
    });
    row.querySelector(".admin-account-wipe")?.addEventListener("click", () => {
      openDeleteAccountContentModal(acc);
    });
    listEl.appendChild(row);
  }
}

/**
 * Confirmation renforcée avant suppression définitive — bien plus qu'un simple `confirmDelete()`
 * (voir js/components/modal.js), volontairement, puisqu'il s'agit ici de la TOTALITÉ des
 * données de quelqu'un d'autre plutôt que d'un seul élément. Deux verrous cumulatifs avant que
 * le bouton "Supprimer définitivement" ne s'active : une sauvegarde JSON doit avoir été
 * téléchargée dans CETTE modale, ET l'email du compte doit être retapé à l'identique.
 */
function openDeleteAccountContentModal(account) {
  const body = document.createElement("div");
  body.innerHTML = `
    <p>Supprime définitivement TOUT le contenu applicatif de <strong>${escapeHtml(account.email)}</strong> :
      tâches, projets, personnes, suivis, ressources, réunions, décisions, objectifs, tags,
      éléments liés, historique de fiches, préférences, prompts et éléments Inbox.
      Cette action est irréversible.</p>
    <p class="item-meta">L'historique d'activité (connexions, écrans consultés, visible dans
      "📊 Voir l'activité des comptes") n'est pas supprimé et reste consultable.</p>
    <div class="field">
      <button type="button" id="admin-wipe-backup-btn" class="btn btn-secondary">📥 Télécharger une sauvegarde (JSON) d'abord</button>
      <div id="admin-wipe-backup-status" class="item-meta" style="margin-top:6px;">Sauvegarde non téléchargée — requise avant de pouvoir supprimer.</div>
    </div>
    <div class="field">
      <label for="admin-wipe-confirm-email">Tape l'email du compte pour confirmer</label>
      <input id="admin-wipe-confirm-email" type="text" placeholder="${escapeHtml(account.email)}" autocomplete="off" />
    </div>
    <div class="field">
      <button type="button" id="admin-wipe-confirm-btn" class="btn btn-danger" disabled>Supprimer définitivement</button>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "🗑️ Supprimer tout le contenu",
    body,
    dismissible: true,
    actions: [{ label: "Annuler", variant: "ghost" }],
  });

  let backupDownloaded = false;
  const emailInput = bodyEl.querySelector("#admin-wipe-confirm-email");
  const confirmBtn = bodyEl.querySelector("#admin-wipe-confirm-btn");
  const backupStatus = bodyEl.querySelector("#admin-wipe-backup-status");

  function updateConfirmState() {
    const typed = emailInput.value.trim().toLowerCase();
    confirmBtn.disabled = !(backupDownloaded && typed === account.email.toLowerCase());
  }

  bodyEl.querySelector("#admin-wipe-backup-btn").addEventListener("click", async (e) => {
    e.target.disabled = true;
    try {
      await accountAdminApi.downloadAccountBackup(account);
      backupDownloaded = true;
      backupStatus.textContent = "✅ Sauvegarde téléchargée.";
      updateConfirmState();
    } catch (err) {
      showToast(err.message || "Impossible de générer la sauvegarde — vérifie la règle de sécurité Firestore (tutoriel 🔥 Firebase).");
      e.target.disabled = false;
    }
  });

  emailInput.addEventListener("input", updateConfirmState);

  confirmBtn.addEventListener("click", async () => {
    confirmBtn.disabled = true;
    try {
      const count = await accountAdminApi.deleteAccountContent(account);
      showToast(`Contenu supprimé (${count} document${count > 1 ? "s" : ""}).`);
      close();
      openAccountsAdminModal();
    } catch (err) {
      showToast(err.message || "Échec de la suppression.");
      confirmBtn.disabled = false;
    }
  });
}

/**
 * Gestion des tags (retour de Charles-Henri, 13/09/2026 : "je dois pouvoir en admin désactiver
 * ou supprimer des tags") — les tags eux-mêmes (js/domain/tags.js) n'ont pas de fiche propre à
 * ouvrir comme les 9 autres types de l'app : ce panneau technique est le seul endroit adapté pour
 * les administrer globalement, dans le même esprit que 📊 Suivi d'usage juste au-dessus (une
 * vue d'ensemble, pas une fiche par élément).
 *
 * Deux actions bien distinctes, pour ne jamais confondre un simple nettoyage de suggestions avec
 * une suppression réelle :
 * - "Désactivé" (case à cocher, réversible) : le tag n'est plus proposé en autocomplétion nulle
 *   part (js/components/tagsEditor.js, recherche globale) mais reste posé sur les fiches qui
 *   l'ont déjà et reste trouvable par la recherche — un tag créé par erreur ou une faute de
 *   frappe qu'on ne veut plus voir ressurgir à la saisie, sans toucher aux fiches existantes.
 * - "🗑️ Supprimer" (irréversible, confirmation) : retire réellement ce tag de TOUTES les fiches
 *   qui le portent (`tagsApi.deleteTagEverywhere`) — pour un tag qu'on ne veut plus voir du tout.
 */
async function openTagsAdminModal() {
  const body = document.createElement("div");
  body.innerHTML = `<div class="empty-state" style="padding:16px;">Chargement…</div>`;
  const { bodyEl } = openModal({
    title: "🏷️ Gérer les tags",
    body,
    dismissible: true,
    actions: [{ label: "← Retour", variant: "ghost", onClick: () => openAdminPanel() }],
  });

  async function render() {
    const [allTags, prefs] = await Promise.all([tagsApi.listAll(), preferencesApi.getPreferences()]);
    const groups = tagsApi.groupByName(allTags);
    const disabledSet = new Set(prefs.disabledTags || []);

    if (!groups.length) {
      bodyEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun tag posé pour l'instant, sur aucune fiche.</div>`;
      return;
    }

    bodyEl.innerHTML = `
      <p class="item-meta" style="margin-bottom:16px;">
        <strong>Désactivé</strong> : n'apparaît plus en suggestion à la saisie, mais reste sur les fiches qui l'ont déjà et reste trouvable par la recherche.
        <strong>Supprimer</strong> : retire ce tag de toutes les fiches qui le portent — irréversible.
      </p>
      <div id="admin-tags-list"></div>
    `;
    const listEl = bodyEl.querySelector("#admin-tags-list");
    for (const group of groups) {
      const disabled = disabledSet.has(group.key);
      const row = document.createElement("div");
      row.className = "card";
      row.style.marginBottom = "10px";
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div>
            <div style="font-weight:600;${disabled ? "color:var(--color-text-muted);" : ""}">#${escapeHtml(group.displayName)}</div>
            <div class="item-meta">${group.count} fiche${group.count > 1 ? "s" : ""}${disabled ? " · désactivé" : ""}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
            <label style="display:flex;align-items:center;gap:4px;font-size:var(--font-size-sm);margin:0;">
              <input type="checkbox" class="admin-tag-disable" style="width:auto;" ${disabled ? "checked" : ""} /> Désactivé
            </label>
            <button type="button" class="btn btn-ghost btn-sm admin-tag-delete">🗑️ Supprimer</button>
          </div>
        </div>
      `;
      row.querySelector(".admin-tag-disable").addEventListener("change", async (e) => {
        const next = new Set(prefs.disabledTags || []);
        if (e.target.checked) next.add(group.key);
        else next.delete(group.key);
        await preferencesApi.setDisabledTags([...next]);
        render(); // re-render simple : pas de confirmDelete ici, `bodyEl` reste attaché au document.
      });
      row.querySelector(".admin-tag-delete").addEventListener("click", () => {
        // confirmDelete() ouvre sa propre modale — une seule modale active à la fois (voir
        // modal.js), donc celle-ci (🏷️ Gérer les tags) est détruite dès l'ouverture de la
        // confirmation, pas juste masquée derrière. On la rouvre entièrement après confirmation
        // (même principe que "← Retour" ailleurs dans ce panneau) plutôt que de réutiliser
        // `bodyEl`, qui ne fait plus partie du document à ce moment-là.
        confirmDelete({
          title: "Supprimer ce tag ?",
          message: `"#${group.displayName}" sera retiré de ${group.count} fiche${group.count > 1 ? "s" : ""}. Cette action est irréversible.`,
          onConfirm: async () => {
            await tagsApi.deleteTagEverywhere(group.displayName);
            showToast("Tag supprimé");
            openTagsAdminModal();
          },
        });
      });
      listEl.appendChild(row);
    }
  }

  render();
}

// Suivi d'usage superadmin (retour de Charles-Henri, 06/09/2026 : "est-ce que je peux avoir un
// mode superadmin [...] avec des KPI sympa pour voir ce qui est utilisé, comment et quand ?") —
// portée et logique d'agrégation détaillées dans js/services/usageTracking.js. Cette section
// reste volontairement DANS 🔧 Administration plutôt qu'un nouvel onglet/écran (décision
// explicite de Charles-Henri) — même bouton "← Retour" que openAppTutorial() pour rouvrir le
// panneau derrière, puisque l'ouvrir a refermé cette modale-ci (une seule modale à la fois).
async function openUsagePanel() {
  const body = document.createElement("div");
  body.innerHTML = `<div class="empty-state" style="padding:16px;">Chargement…</div>`;
  const { bodyEl } = openModal({
    title: "📊 Usage",
    body,
    dismissible: true,
    actions: [{ label: "← Retour", variant: "ghost", onClick: () => openAdminPanel() }],
  });

  const events = await usageTrackingApi.fetchUsageEvents();
  const stats = usageTrackingApi.computeUsageStats(events);
  renderUsageStats(bodyEl, stats);
}

function renderUsageStats(bodyEl, stats) {
  if (stats.totalEvents === 0) {
    bodyEl.innerHTML = `<div class="empty-state" style="padding:16px;">Aucune donnée pour l'instant — reviens une fois que les comptes autorisés auront ouvert l'appli.</div>`;
    return;
  }

  const accountRows = stats.accounts
    .map(
      (acc) => `
    <div class="card" style="margin-bottom:10px;">
      <div style="font-weight:600;">${escapeHtml(acc.email)}</div>
      <div class="item-meta">Dernière activité : ${formatDateTime(acc.lastSeen)}</div>
      <div class="item-meta">${acc.loginCount} connexion${acc.loginCount > 1 ? "s" : ""} · ${acc.viewCount} écran${acc.viewCount > 1 ? "s" : ""} consulté${acc.viewCount > 1 ? "s" : ""}</div>
      ${acc.topScreens.length ? `<div class="item-meta">Le plus consulté : ${acc.topScreens.map((s) => `${escapeHtml(s.label)} (${s.count})`).join(", ")}</div>` : ""}
    </div>
  `
    )
    .join("");

  const globalRows = stats.topScreensGlobal.map((s) => `<li>${escapeHtml(s.label)} — ${s.count}</li>`).join("");

  bodyEl.innerHTML = `
    <p class="item-meta">Suivi depuis le ${formatDate(stats.since)} · ${stats.totalEvents} événement${stats.totalEvents > 1 ? "s" : ""}.</p>
    <div class="field">
      <label>Par compte</label>
      ${accountRows}
    </div>
    <div class="field">
      <label>Écrans les plus consultés (tous comptes)</label>
      <ol style="padding-left:20px;">${globalRows}</ol>
    </div>
  `;
}

function formatDateTime(ts) {
  return ts ? new Date(ts).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
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
