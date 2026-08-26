// Génération d'identifiants — isolé pour rester cohérent avec le reste des services.
export function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Repli si crypto.randomUUID n'est pas disponible (vieux navigateurs).
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
