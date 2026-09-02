// Toast — repris du pattern EnVie (pastille sombre, bas d'écran, auto-dismiss).
//
// `actionLabel`/`onAction` (audit de simplification du 02/09/2026, retour de Charles-Henri :
// un geste involontaire — glisser une carte au calendrier au mauvais endroit — doit pouvoir se
// rattraper tout de suite, sans devoir rouvrir la fiche pour remettre la date d'avant à la
// main). Un bouton optionnel dans le toast lui-même plutôt qu'une confirmation avant l'action :
// ne ralentit jamais le geste normal, seulement le cas où il faut revenir en arrière. La durée
// d'affichage s'allonge automatiquement quand une action est proposée, pour laisser le temps de
// cliquer.
//
// `triggerLastUndo()` (vague 20, retour de Charles-Henri : "Annuler au clavier : Ctrl+Z") :
// rejoue la même `onAction` que le bouton du toast, tant que sa fenêtre d'affichage est encore
// active — voir js/services/shortcuts.js, qui l'appelle sur Ctrl+Z (jamais dans un champ de
// texte, où Ctrl+Z reste l'annulation native du navigateur).

let currentTimeout = null;
let lastUndo = null;

export function showToast(message, { duration, actionLabel, onAction } = {}) {
  document.querySelector(".toast")?.remove();
  clearTimeout(currentTimeout);
  lastUndo = actionLabel && onAction ? onAction : null;

  const toast = document.createElement("div");
  toast.className = "toast";
  const text = document.createElement("span");
  text.textContent = message;
  toast.appendChild(text);

  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      clearTimeout(currentTimeout);
      toast.remove();
      lastUndo = null;
      onAction();
    });
    toast.appendChild(btn);
  }

  document.body.appendChild(toast);

  currentTimeout = setTimeout(() => {
    toast.remove();
    lastUndo = null;
  }, duration ?? (actionLabel ? 5000 : 2200));
}

/**
 * Rejoue la dernière action "Annuler" proposée par un toast, tant qu'il est encore affiché.
 * Retourne `true` si une action a effectivement été rejouée (pour que l'appelant sache s'il
 * doit avaler l'événement clavier), `false` sinon — ex. aucun toast avec action en ce moment,
 * ou sa fenêtre d'affichage est déjà passée.
 */
export function triggerLastUndo() {
  if (!lastUndo) return false;
  const fn = lastUndo;
  lastUndo = null;
  clearTimeout(currentTimeout);
  document.querySelector(".toast")?.remove();
  fn();
  return true;
}
