// Vue "Prompts IA" — bibliothèque de prompts réutilisables (retour de Charles-Henri :
// pouvoir facilement renvoyer un prompt déjà rédigé vers Copilot/ChatGPT/Claude). Version
// simple délibérée (décision prise avec Charles-Henri) : pas de catégorisation ni de
// rattachement à un fil conducteur, juste titre/description/texte + recherche + copier.

import * as promptsApi from "../domain/prompts.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";

export function renderPrompts(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Prompts IA</h1>
        <div class="subtitle" id="prompts-subtitle">—</div>
      </div>
      <button id="new-prompt-btn" class="btn btn-primary btn-sm">+ Prompt</button>
    </div>
    <div class="view">
      <div class="field">
        <input id="prompts-search" type="text" placeholder="Rechercher (titre, description, texte)..." />
      </div>
      <div id="prompts-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#prompts-list");
  const subtitleEl = container.querySelector("#prompts-subtitle");
  const searchEl = container.querySelector("#prompts-search");
  container.querySelector("#new-prompt-btn").addEventListener("click", () => openCreatePromptModal());

  let prompts = [];
  let query = "";

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    render();
  });

  function matchesQuery(p) {
    if (!query) return true;
    return [p.title, p.description, p.text].join(" ").toLowerCase().includes(query);
  }

  function render() {
    subtitleEl.textContent = prompts.length ? `${prompts.length} prompt(s)` : "Aucun prompt";
    const filtered = prompts.filter(matchesQuery).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="emoji">🤖</span>
          ${prompts.length ? "Rien ne correspond à ta recherche." : "Pas encore de prompt enregistré. Ajoute ceux que tu réutilises souvent."}
        </div>`;
      return;
    }

    const card = document.createElement("div");
    card.className = "card";
    for (const p of filtered) {
      const row = document.createElement("div");
      row.className = "item-row";
      row.style.cursor = "pointer";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title">🤖 ${escapeHtml(p.title)}</div>
          ${p.description ? `<div class="item-meta">${escapeHtml(p.description)}</div>` : ""}
        </div>
      `;
      row.addEventListener("click", () => openPromptDetail(p));
      card.appendChild(row);
    }
    listEl.innerHTML = "";
    listEl.appendChild(card);
  }

  const unsub = promptsApi.subscribe((items) => {
    prompts = items;
    render();
  });

  return function cleanup() {
    unsub();
  };
}

async function copyPromptText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Prompt copié");
  } catch {
    showToast("Impossible de copier le prompt");
  }
}

function openCreatePromptModal() {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="prompt-title">Titre</label>
      <input id="prompt-title" type="text" placeholder="Ex. Reformuler un compte-rendu" />
    </div>
    <div class="field">
      <label for="prompt-description">Description (optionnel)</label>
      <input id="prompt-description" type="text" placeholder="À quoi il sert" />
    </div>
    <div class="field">
      <label for="prompt-text">Texte du prompt</label>
      <textarea id="prompt-text" rows="8"></textarea>
    </div>
  `;

  const { bodyEl, close } = openModal({
    title: "Nouveau prompt",
    body,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#prompt-title").value.trim();
          const text = bodyEl.querySelector("#prompt-text").value.trim();
          if (!title || !text) return;
          await promptsApi.createPrompt({
            title,
            description: bodyEl.querySelector("#prompt-description").value.trim(),
            text,
          });
          close();
          showToast("Prompt ajouté");
        },
      },
    ],
  });
}

function openPromptDetail(prompt) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <label for="prompt-detail-title">Titre</label>
      <input id="prompt-detail-title" type="text" value="${escapeAttr(prompt.title)}" />
    </div>
    <div class="field">
      <label for="prompt-detail-description">Description</label>
      <input id="prompt-detail-description" type="text" value="${escapeAttr(prompt.description || "")}" />
    </div>
    <div class="field">
      <label for="prompt-detail-text">Texte du prompt</label>
      <textarea id="prompt-detail-text" rows="8">${escapeHtml(prompt.text)}</textarea>
    </div>
    <button id="prompt-copy-btn" type="button" class="btn btn-secondary btn-block" style="margin-bottom:8px;">📋 Copier le prompt</button>
  `;

  body.querySelector("#prompt-copy-btn").addEventListener("click", () => copyPromptText(prompt.text));

  const { bodyEl, close } = openModal({
    title: "🤖 " + prompt.title,
    body,
    actions: [
      { label: "Fermer", variant: "ghost" },
      {
        label: "🗑️ Supprimer",
        variant: "danger",
        closesModal: false,
        onClick: () => {
          closeModal();
          confirmDelete({
            title: "Supprimer ce prompt ?",
            message: `« ${prompt.title} » sera définitivement supprimé.`,
            onConfirm: async () => {
              await promptsApi.removePrompt(prompt.id);
              showToast("Prompt supprimé");
            },
            onCancel: () => openPromptDetail(prompt),
          });
        },
      },
      {
        label: "Enregistrer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#prompt-detail-title").value.trim();
          const text = bodyEl.querySelector("#prompt-detail-text").value.trim();
          if (!title || !text) return;
          await promptsApi.updatePrompt(prompt.id, {
            title,
            description: bodyEl.querySelector("#prompt-detail-description").value.trim(),
            text,
          });
          close();
          showToast("Prompt mis à jour");
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

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
