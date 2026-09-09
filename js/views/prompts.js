// Vue "Prompts IA" — bibliothèque de prompts réutilisables (retour de Charles-Henri :
// pouvoir facilement renvoyer un prompt déjà rédigé vers Copilot/ChatGPT/Claude). Version
// simple délibérée (décision prise avec Charles-Henri) : pas de catégorisation, juste
// titre/description/texte + recherche + copier.
//
// `openCreatePromptModal`, `openPromptDetail`, `renderPromptList` et `openPromptPickerModal`
// sont exportés depuis la vague du 07/09/2026 pour servir aussi la section "🤖 Prompts" de la
// fiche Tâche (js/views/kanban.js) — même trio de fonctions que js/views/resources.js expose déjà
// pour "📎 Ressources" (openCreateResourceModal/renderResourceList/openResourcePickerModal),
// réutilisé à l'identique plutôt que dupliqué.

import * as promptsApi from "../domain/prompts.js?v=3";
import { openModal, closeModal, confirmDelete } from "../components/modal.js?v=3";
import { showToast } from "../components/toast.js?v=3";

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

/** `prefill.taskId` (optionnel) : lie automatiquement le prompt créé à cette tâche — même
 *  paramètre que js/views/resources.js#openCreateResourceModal. `prefill.onCreated`/`onCancel` :
 *  callbacks pour rouvrir l'écran appelant (fiche Tâche) une fois fait/annulé, comme partout
 *  ailleurs dans l'appli — `{}` (par défaut) reproduit le comportement d'origine (bouton "+
 *  Prompt" de cette vue, aucun rattachement, aucun callback). */
export function openCreatePromptModal(prefill = {}) {
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
      { label: "Annuler", variant: "ghost", onClick: () => prefill.onCancel?.() },
      {
        label: "Créer",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          const title = bodyEl.querySelector("#prompt-title").value.trim();
          const text = bodyEl.querySelector("#prompt-text").value.trim();
          if (!title || !text) return;
          const prompt = await promptsApi.createPrompt({
            title,
            description: bodyEl.querySelector("#prompt-description").value.trim(),
            text,
            taskIds: prefill.taskId ? [prefill.taskId] : [],
          });
          close();
          showToast("Prompt ajouté");
          prefill.onCreated?.(prompt);
        },
      },
    ],
  });
}

export function openPromptDetail(prompt) {
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

/**
 * Rend la liste des prompts liés à une tâche dans `container` — symétrique de
 * js/views/resources.js#renderResourceList, avec deux différences volontaires : le titre ouvre
 * toujours la vraie fiche du prompt (un prompt n'a jamais d'URL externe comme une Ressource, donc
 * rien d'autre à faire du clic), et le bouton "Copier" est toujours présent (le texte d'un
 * prompt existe toujours, contrairement à l'URL optionnelle d'une Ressource) — c'est là tout
 * l'intérêt d'avoir le prompt sous la main pendant qu'on travaille la tâche.
 */
export function renderPromptList(container, prompts, { onUnlink } = {}) {
  if (!prompts.length) {
    container.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun prompt lié.</div>`;
    return;
  }
  container.innerHTML = "";
  for (const p of prompts) {
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

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn-ghost btn-sm";
    copyBtn.textContent = "📋 Copier";
    copyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(p.text);
        showToast("Prompt copié");
      } catch {
        showToast("Impossible de copier le prompt");
      }
    });
    row.appendChild(copyBtn);

    if (onUnlink) {
      const unlinkBtn = document.createElement("button");
      unlinkBtn.type = "button";
      unlinkBtn.className = "btn btn-ghost btn-sm";
      unlinkBtn.textContent = "Délier";
      unlinkBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await onUnlink(p);
        row.remove();
        if (!container.children.length) {
          container.innerHTML = `<div class="empty-state" style="padding:16px;">Aucun prompt lié.</div>`;
        }
      });
      row.appendChild(unlinkBtn);
    }
    container.appendChild(row);
  }
}

/** "🔗 Lier existant" côté Prompts — symétrique de
 *  js/views/resources.js#openResourcePickerModal, sans le filtre par type (un prompt n'en a
 *  pas) : juste une recherche texte sur titre/description. */
export function openPromptPickerModal(candidates, onPick, onCancel) {
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="field">
      <input id="prompt-picker-search" type="text" placeholder="Rechercher par titre..." />
    </div>
    <div class="card" id="prompt-picker-list"></div>
  `;
  const searchEl = body.querySelector("#prompt-picker-search");
  const listEl = body.querySelector("#prompt-picker-list");
  let query = "";

  function renderList() {
    const filtered = candidates.filter(
      (p) => !query || [p.title, p.description].join(" ").toLowerCase().includes(query)
    );
    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty-state" style="padding:16px;">Rien ne correspond.</div>`;
      return;
    }
    listEl.innerHTML = "";
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
      row.addEventListener("click", async () => {
        await onPick(p);
        close();
      });
      listEl.appendChild(row);
    }
  }

  searchEl.addEventListener("input", () => {
    query = searchEl.value.trim().toLowerCase();
    renderList();
  });

  renderList();

  const { close } = openModal({
    title: "Lier un prompt",
    body,
    actions: [{ label: "Annuler", variant: "ghost", onClick: () => onCancel?.() }],
  });
  setTimeout(() => searchEl.focus(), 30);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
