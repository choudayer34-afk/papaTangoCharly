// Recettes de démarrage — piste UX du 31/08/2026 (retour de Charles-Henri : mieux se souvenir
// des enchaînements à réaliser). Une recette ne réinvente rien : elle enchaîne à la suite,
// avec le contexte déjà préremplit, les mêmes formulaires de création qui existent déjà
// ailleurs (même convention prefill/onCreated/onCancel que kanban.js/people.js/projects.js).
// L'idée n'est pas d'accélérer la saisie (Charles-Henri n'en a pas exprimé le besoin) mais de
// ne plus avoir à se souvenir soi-même "après avoir créé X, il faut aussi penser à créer Y".

import { openModal, closeModal } from "./modal.js";
import { showToast } from "./toast.js";
import * as peopleApi from "../domain/people.js";
import { openCreateProjectModal } from "../views/projects.js";
import { openCreateFollowUpModal } from "../views/people.js";

const RECIPES = [
  {
    id: "new_partner_project",
    icon: "📦",
    label: "Nouveau projet transverse",
    description: "Ex. un projet type Modernisation avec la marketing : crée le projet, puis directement le premier suivi sur la personne dont tu attends quelque chose.",
  },
  {
    id: "multi_followups",
    icon: "👥",
    label: "Plusieurs suivis pour la même personne",
    description: "Ex. après un point avec un développeur où plusieurs engagements ont été pris : choisis la personne, puis enchaîne sur le suivant sans repasser par sa fiche — \"Encore un suivi ?\" (vague 22) s'affiche désormais après chaque suivi créé, pas seulement depuis cette recette.",
  },
];

export function openRecipesModal() {
  const body = document.createElement("div");
  const list = document.createElement("div");
  list.className = "card";
  for (const r of RECIPES) {
    const row = document.createElement("div");
    row.className = "item-row";
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="item-main">
        <div class="item-title">${r.icon} ${r.label}</div>
        <div class="item-meta">${r.description}</div>
      </div>
    `;
    row.addEventListener("click", () => {
      closeModal();
      runRecipe(r.id);
    });
    list.appendChild(row);
  }
  body.appendChild(list);
  openModal({ title: "🧩 Recettes de démarrage", body, actions: [{ label: "Fermer", variant: "ghost" }] });
}

function runRecipe(id) {
  if (id === "new_partner_project") runNewPartnerProject();
  else if (id === "multi_followups") runMultiFollowUps();
}

function runNewPartnerProject() {
  openCreateProjectModal({
    onCreated: (project) => {
      showToast("Projet créé — maintenant le suivi sur la personne concernée");
      openCreateFollowUpModal({
        projectId: project.id,
        defaultDirection: "waiting_on",
        onCreated: () => showToast("Suivi créé — projet et suivi prêts"),
      });
    },
  });
}

async function runMultiFollowUps() {
  const people = await peopleApi.listAll();
  if (!people.length) {
    showToast("Ajoute d'abord une personne dans l'onglet Équipe");
    return;
  }
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="recipe-person">Pour qui ?</label>
      <select id="recipe-person">
        ${people.map((p) => `<option value="${p.id}">${p.type === "manager" ? "👔" : "👤"} ${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;
  const { bodyEl, close } = openModal({
    title: "👥 Plusieurs suivis",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Suivant",
        variant: "primary",
        closesModal: false,
        onClick: () => {
          const person = people.find((p) => p.id === bodyEl.querySelector("#recipe-person").value);
          close();
          // La boucle "Encore un suivi ?" (retour de Charles-Henri, vague 22) vit désormais
          // directement dans openCreateFollowUpModal (js/views/people.js) et s'affiche après
          // CHAQUE suivi créé, plus seulement depuis cette recette — cette recette ne fait donc
          // plus qu'amorcer le premier suivi pour la personne choisie.
          openCreateFollowUpModal({ person, onCreated: () => showToast("Suivi créé") });
        },
      },
    ],
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}
