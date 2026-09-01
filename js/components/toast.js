// Toast — repris du pattern EnVie (pastille sombre, bas d'écran, auto-dismiss).
//
// `actionLabel`/`onAction` (audit de simplification du 02/09/2026, retour de Charles-Henri :
// un geste involontaire — glisser une carte au calendrier au mauvais endroit — doit pouvoir se
// rattraper tout de suite, sans devoir rouvrir la fiche pour remettre la date d'avant à la
// main). Un bouton optionnel dans le toast lui-même plutôt qu'une confirmation avant l'action :
// ne ralentit jamais le geste normal, seulement le cas où il faut revenir en arrière. La durée
// d'affichage s'allonge automatiquement quand une action est proposée, pour laisser le temps de
// cliquer.

let currentTimeout = null;

export function showToast(message, { duration, actionLabel, onAction } = {}) {
  document.querySelector(".toast")?.remove();
  clearTimeout(currentTimeout);

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
      onAction();
    });
    toast.appendChild(btn);
  }

  document.body.appendChild(toast);

  currentTimeout = setTimeout(() => toast.remove(), duration ?? (actionLabel ? 5000 : 2200));
}
