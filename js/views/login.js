// Écran de connexion — nécessaire car les données vivent maintenant dans Firestore,
// donc scopées à un utilisateur authentifié (users/{uid}/...). Rien d'autre dans
// l'application ne devrait avoir besoin de connaître Firebase Auth au-delà de ce fichier
// et de js/app.js (qui décide d'afficher cet écran ou l'app normale).

import { signInGoogle, signInEmail } from "../services/firebase.js";
import { showToast } from "../components/toast.js";

export function renderLogin(container) {
  container.innerHTML = `
    <div class="view" style="padding-top: 15vh;">
      <div class="card" style="max-width:360px;margin:0 auto;text-align:center;">
        <h1 style="margin-top:0;">Pilotage</h1>
        <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">
          Connecte-toi pour retrouver tes données.
        </p>
        <button id="login-google" class="btn btn-primary btn-block" style="margin-bottom:16px;">
          Continuer avec Google
        </button>
        <div style="color:var(--color-text-muted);font-size:var(--font-size-xs);margin-bottom:12px;">— ou —</div>
        <div class="field" style="text-align:left;">
          <label for="login-email">Email</label>
          <input id="login-email" type="email" autocomplete="username" />
        </div>
        <div class="field" style="text-align:left;">
          <label for="login-password">Mot de passe</label>
          <input id="login-password" type="password" autocomplete="current-password" />
        </div>
        <button id="login-email-submit" class="btn btn-secondary btn-block">Se connecter</button>
      </div>
    </div>
  `;

  container.querySelector("#login-google").addEventListener("click", async () => {
    try {
      await signInGoogle();
    } catch (err) {
      showToast("Connexion Google impossible : " + friendlyError(err));
    }
  });

  container.querySelector("#login-email-submit").addEventListener("click", async () => {
    const email = container.querySelector("#login-email").value.trim();
    const password = container.querySelector("#login-password").value;
    if (!email || !password) return;
    try {
      await signInEmail(email, password);
    } catch (err) {
      showToast("Connexion impossible : " + friendlyError(err));
    }
  });

  return null; // rien à nettoyer
}

// Écran affiché à la place de l'app ou du login normal quand quelqu'un s'authentifie avec
// succès via Firebase mais n'est pas sur la liste blanche `allowedUsers` (retour de
// Charles-Henri : "quelques personnes précises que je choisis" — voir
// js/services/firebase.js#isEmailAllowed). js/app.js a déjà déconnecté la personne avant
// d'afficher cet écran, donc "Continuer avec Google" ci-dessus ne réapparaît pas : se
// reconnecter avec le même compte non autorisé ramènerait immédiatement ici.
export function renderRestricted(container, email) {
  container.innerHTML = `
    <div class="view" style="padding-top: 15vh;">
      <div class="card" style="max-width:360px;margin:0 auto;text-align:center;">
        <h1 style="margin-top:0;">Accès restreint</h1>
        <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">
          ${email ? `Le compte <strong>${escapeHtml(email)}</strong> n'est` : "Ce compte n'est"} pas autorisé à utiliser cette application.
        </p>
        <p style="color:var(--color-text-muted);font-size:var(--font-size-sm);">
          Demande à la personne qui gère les accès de t'ajouter, puis reconnecte-toi.
        </p>
      </div>
    </div>
  `;
  return null; // rien à nettoyer
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function friendlyError(err) {
  const code = err?.code || "";
  if (code.includes("operation-not-allowed")) return "cette méthode n'est pas activée dans Firebase";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "identifiants incorrects";
  if (code.includes("user-not-found")) return "compte inconnu";
  if (code.includes("popup-closed")) return "fenêtre fermée avant la fin";
  return err?.message || "erreur inconnue";
}
