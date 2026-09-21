// Utilitaire de validation de formulaire partagé (LOT 1, TODO-006 — audit UX-002/AUDIT_USAGE_
// EFFICACITE.md : "les formulaires de création échouent silencieusement sur un champ obligatoire
// vide (aucun toast, aucun style d'erreur)"). Avant ce fichier, chaque modale de création
// (Tâche, Projet, Ressource) répétait son propre `if (!title) return;` muet — l'utilisateur ne
// savait jamais si son clic sur "Créer"/"Enregistrer" avait échoué ou simplement mis du temps.
// Un seul endroit pour ce garde-fou, comme confirmDelete()/guardClick() dans modal.js pour leurs
// propres patterns respectifs.

import { showToast } from "./toast.js";

/**
 * Vérifie une liste de champs obligatoires. Si l'un d'eux est vide, l'entoure visuellement
 * (classe `.field-invalid`, voir styles/components.css) et affiche un toast nommant le premier
 * champ en défaut, sans fermer la modale ni perdre la saisie déjà faite ailleurs dans le
 * formulaire.
 * @param {HTMLElement} container - conteneur de la modale (le `bodyEl` retourné par openModal(),
 *   ou tout ancêtre commun des champs à vérifier).
 * @param {Array<{selector: string, label: string}>} fields - `label` doit se lire naturellement
 *   dans "<label> obligatoire" (ex. "Le titre", "Le nom").
 * @returns {boolean} true si tous les champs sont renseignés.
 */
export function validateRequiredFields(container, fields) {
  let firstInvalid = null;
  for (const { selector, label } of fields) {
    const el = container.querySelector(selector);
    if (!el) continue;
    const valid = !!el.value.trim();
    el.classList.toggle("field-invalid", !valid);
    if (!valid && !firstInvalid) firstInvalid = { el, label };
  }
  if (firstInvalid) {
    showToast(`${firstInvalid.label} obligatoire`);
    firstInvalid.el.focus();
    return false;
  }
  return true;
}

/**
 * Valide un champ URL optionnel (UX-012/AUDIT_UX.md : le `type="url"` natif ne se déclenche
 * jamais hors d'un vrai `<form>`, une URL mal formée était donc enregistrée telle quelle sans
 * aucun signal). Un champ vide reste valide — ce champ est optionnel partout où il apparaît
 * (Ressource) ; seul un texte non vide mais mal formé est rejeté.
 * @param {HTMLElement} container
 * @param {string} selector
 * @param {string} [label="Le lien"]
 * @returns {boolean}
 */
export function validateUrlField(container, selector, label = "Le lien") {
  const el = container.querySelector(selector);
  if (!el) return true;
  const value = el.value.trim();
  if (!value) {
    el.classList.remove("field-invalid");
    return true;
  }
  let isValid = true;
  try {
    // eslint-disable-next-line no-new
    new URL(value);
  } catch {
    isValid = false;
  }
  el.classList.toggle("field-invalid", !isValid);
  if (!isValid) {
    showToast(`${label} n'est pas une URL valide (ex. https://...)`);
    el.focus();
  }
  return isValid;
}

/**
 * Retire le style d'erreur dès que l'utilisateur retape quelque chose dans un champ marqué
 * invalide par validateRequiredFields()/validateUrlField() ci-dessus — pour ne jamais laisser un
 * contour rouge affiché sur un champ redevenu valide entre-temps.
 * @param {HTMLElement} container
 * @param {string[]} selectors
 */
export function clearFieldErrorOnInput(container, selectors) {
  for (const selector of selectors) {
    const el = container.querySelector(selector);
    el?.addEventListener("input", () => el.classList.remove("field-invalid"));
  }
}
