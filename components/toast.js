// Toast — repris du pattern EnVie (pastille sombre, bas d'écran, auto-dismiss).

let currentTimeout = null;

export function showToast(message, { duration = 2200 } = {}) {
  document.querySelector(".toast")?.remove();
  clearTimeout(currentTimeout);

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  currentTimeout = setTimeout(() => toast.remove(), duration);
}
