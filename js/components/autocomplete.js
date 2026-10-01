// Composant d'autocomplétion partagé — remplace le `<datalist>` natif (TODO-031, 29/09/2026 : bug
// remonté par Charles-Henri en testant la confirmation de catégorie sur iPhone : « Safari sur iOS
// n'affiche jamais la liste de suggestions native [...] limitation de la plateforme, pas un
// défaut de configuration d'un champ en particulier — les 4 endroits [catégorie de projet, éditeur
// de tags, filtre #tag de la recherche globale, saisie en masse du Kanban] sont concernés de la
// même façon »). Un seul point d'implémentation réutilisé aux 4 endroits, plutôt que reproduit
// 4 fois — même principe que l'unification de l'éditeur de tags le 13/09/2026 (voir l'en-tête de
// tagsEditor.js).
//
// Ne fait AUCUN filtrage lui-même : `getSuggestions(query)` reste à la charge de l'appelant, seul
// à connaître la sémantique de correspondance correcte pour SON champ (ex. uniquement après "#",
// par préfixe, pour search.js — le "#" fait partie de la saisie ET des options ; par sous-chaîne
// pour tagsEditor.js/projects.js/kanban.js, où un filtrage unique et générique aurait dû deviner
// cette différence plutôt que la recevoir explicitement de chaque appelant).
//
// Navigation clavier reproduite explicitement (risque identifié par TODO_TECHNIQUE.md pour ce
// chantier : « un composant mal calé pourrait régresser la navigation clavier flèches/Entrée que
// <datalist> offre nativement ») :
// - ↓ / ↑ : déplace la suggestion surlignée, avec retour au début/à la fin ; AUCUNE surlignée à
//   l'ouverture — comme un <datalist> natif, qui ne présélectionne jamais rien.
// - Entrée : si une suggestion est surlignée, la choisit (remplit le champ, ferme la liste) ET
//   empêche cette même frappe d'atteindre un autre gestionnaire "Entrée" déjà posé sur le champ
//   (ex. l'ajout du tag tapé dans tagsEditor.js) — exactement le comportement en deux temps d'un
//   <datalist> natif sur desktop (une première Entrée choisit la suggestion surlignée, une
//   seconde déclenche l'action). Si rien n'est surligné, ne fait RIEN de spécial : l'événement
//   continue normalement vers cet autre gestionnaire, comme aujourd'hui.
// - Échap : ferme la liste sans toucher au champ.
// - Clic (mousedown, pas click — voir plus bas) sur une suggestion : la choisit, comme Entrée.
//
// Positionné en `position: fixed`, calculé depuis `getBoundingClientRect()` du champ et recalculé
// au scroll/resize tant que la liste est ouverte, plutôt qu'ajouté comme enfant positionné du
// champ : fonctionne à l'identique pour un champ dans une modale (position dans la page, pas dans
// un parent positionné) que dans un flux normal, sans avoir besoin d'envelopper le champ dans un
// conteneur supplémentaire qui risquerait de perturber la mise en page existante (ex. les 3 champs
// flex de la saisie en masse du Kanban, voir js/views/kanban.js).

let uidCounter = 0;
let activeInstance = null; // une seule liste ouverte à la fois, comme les <datalist> natifs

/**
 * @param {HTMLInputElement} inputEl
 * @param {(query: string) => (string[] | Promise<string[]>)} getSuggestions
 * @param {(value: string) => void} [onSelect] - appelé après qu'une suggestion a été posée dans
 *   le champ (déjà fait par ce composant) ; optionnel, pour un effet de bord propre à l'appelant.
 * @param {number} [maxResults]
 * @returns {{ close: () => void, destroy: () => void }}
 */
export function attachAutocomplete(inputEl, { getSuggestions, onSelect, maxResults = 8 } = {}) {
  const uid = `autocomplete-${++uidCounter}`;
  const dropdown = document.createElement("div");
  dropdown.className = "autocomplete-dropdown";
  dropdown.id = uid;
  dropdown.setAttribute("role", "listbox");
  dropdown.style.display = "none";
  document.body.appendChild(dropdown);

  inputEl.setAttribute("role", "combobox");
  inputEl.setAttribute("aria-autocomplete", "list");
  inputEl.setAttribute("aria-expanded", "false");
  inputEl.setAttribute("aria-controls", uid);
  inputEl.setAttribute("autocomplete", "off"); // ne pas laisser le navigateur mélanger sa propre autocomplétion à la nôtre

  let options = [];
  let activeIndex = -1;
  let open = false;

  function position() {
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.width = `${rect.width}px`;
  }

  function close() {
    open = false;
    activeIndex = -1;
    dropdown.style.display = "none";
    dropdown.innerHTML = "";
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.removeAttribute("aria-activedescendant");
    window.removeEventListener("scroll", position, true);
    window.removeEventListener("resize", position);
    if (activeInstance === api) activeInstance = null;
  }

  function renderOptions() {
    dropdown.innerHTML = "";
    options.forEach((value, i) => {
      const opt = document.createElement("div");
      opt.className = "autocomplete-option" + (i === activeIndex ? " autocomplete-option--active" : "");
      opt.id = `${uid}-option-${i}`;
      opt.setAttribute("role", "option");
      opt.textContent = value;
      // mousedown plutôt que click : se déclenche AVANT le blur du champ (qui fermerait la liste
      // avant qu'un clic n'atteigne l'option) — `preventDefault()` empêche en plus ce mousedown de
      // voler le focus, donc le champ ne perd jamais le focus au clic sur une suggestion.
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        select(value);
      });
      dropdown.appendChild(opt);
    });
    if (activeIndex >= 0) inputEl.setAttribute("aria-activedescendant", `${uid}-option-${activeIndex}`);
    else inputEl.removeAttribute("aria-activedescendant");
  }

  function select(value) {
    inputEl.value = value;
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
    close();
    inputEl.focus();
    onSelect?.(value);
  }

  async function refresh() {
    const query = inputEl.value;
    const result = await getSuggestions(query);
    // Le champ a pu changer (ou perdre le focus) pendant l'attente d'un `getSuggestions` async —
    // ne jamais réafficher une liste devenue obsolète par rapport à ce qui est tapé maintenant.
    if (document.activeElement !== inputEl || inputEl.value !== query) return;
    options = (result || []).slice(0, maxResults);
    activeIndex = -1;
    if (!options.length) {
      close();
      return;
    }
    if (activeInstance && activeInstance !== api) activeInstance.close();
    activeInstance = api;
    open = true;
    inputEl.setAttribute("aria-expanded", "true");
    position();
    dropdown.style.display = "block";
    renderOptions();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
  }

  inputEl.addEventListener("input", refresh);
  inputEl.addEventListener("focus", refresh);
  inputEl.addEventListener("blur", () => close());
  inputEl.addEventListener("keydown", (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % options.length;
      renderOptions();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + options.length) % options.length;
      renderOptions();
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation(); // n'affecte QUE cette frappe — voir l'en-tête du fichier.
        select(options[activeIndex]);
      }
    } else if (e.key === "Escape") {
      close();
    }
  });

  const api = {
    close,
    destroy: () => {
      close();
      dropdown.remove();
    },
  };
  return api;
}
