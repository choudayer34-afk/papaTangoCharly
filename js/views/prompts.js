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

import * as promptsApi from "../domain/prompts.js";
import * as tagsApi from "../domain/tags.js";
import { buildClassifyRequest, parseClassifyResponse, keyFor } from "../domain/promptsClassify.js";
import { renderTagsEditor } from "../components/tagsEditor.js";
import { openModal, closeModal, confirmDelete } from "../components/modal.js";
import { showToast } from "../components/toast.js";

// Rangement par tags (08/10/2026, retour de Charles-Henri : "sur prompt IA, je ne sais pas comment faire
// mieux pour mieux organiser les éléments [...] ce ne sont que les miens, les autres utilisateurs en auront
// d'autres" — réponse choisie : tags # réutilisés + barre de filtres). Les tags sont ceux de toute l'app
// (js/domain/tags.js, type de fiche "Prompt") : aucune liste imposée, chacun a les siens, et la barre de
// filtres n'affiche que les tags réellement posés sur au moins un prompt.
const NO_TAG = "__sans_tag__";

export function renderPrompts(container) {
  container.innerHTML = `
    <div class="topbar">
      <div>
        <h1>Prompts IA</h1>
        <div class="subtitle" id="prompts-subtitle">—</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="classify-prompts-btn" class="btn btn-secondary btn-sm" style="display:none;">🏷️ Classer avec l'IA</button>
        <button id="new-prompt-btn" class="btn btn-primary btn-sm">+ Prompt</button>
      </div>
    </div>
    <div class="view">
      <div class="field">
        <input id="prompts-search" type="text" placeholder="Rechercher (titre, description, texte, tag)..." />
      </div>
      <div id="prompts-filters" class="chip-row prompts-filters" style="display:none;"></div>
      <div id="prompts-list"></div>
    </div>
  `;

  const listEl = container.querySelector("#prompts-list");
  const subtitleEl = container.querySelector("#prompts-subtitle");
  const searchEl = container.querySelector("#prompts-search");
  const filtersEl = container.querySelector("#prompts-filters");
  const classifyBtn = container.querySelector("#classify-prompts-btn");
  container.querySelector("#new-prompt-btn").addEventListener("click", () => openCreatePromptModal());
  classifyBtn.addEventListener("click", () => openClassifyModal(prompts, allTags));

  let prompts = [];
  let allTags = [];
  let query = "";
  let activeTag = null; // clé normalisée d'un tag, NO_TAG, ou null (= tous)

  // BUG corrigé (15/09/2026, audit performance) : aucun anti-rebond sur la recherche — chaque
  // frappe reconstruisait toute la liste. Voir js/views/kanban.js, même correctif.
  let searchDebounce = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      query = searchEl.value.trim().toLowerCase();
      render();
    }, 150);
  });

  const tagsOf = (p) => tagsApi.tagsFor(allTags, "Prompt", p.id);
  const tagKey = (name) => tagsApi.stripHash(name).toLowerCase();

  function matchesQuery(p) {
    if (!query) return true;
    return [p.title, p.description, p.text, ...tagsOf(p).map((t) => t.tag)].join(" ").toLowerCase().includes(query);
  }

  function matchesTag(p) {
    if (!activeTag) return true;
    const mine = tagsOf(p);
    return activeTag === NO_TAG ? mine.length === 0 : mine.some((t) => tagKey(t.tag) === activeTag);
  }

  // Barre de filtres : "Tous", un chip par tag réellement utilisé (le plus fréquent d'abord), et "Sans tag"
  // tant qu'il reste des prompts à classer (utile pendant un premier classement). Masquée tant qu'aucun
  // prompt n'a de tag : rien à filtrer.
  function renderFilters() {
    const counts = new Map();
    let untagged = 0;
    for (const p of prompts) {
      const mine = tagsOf(p);
      if (!mine.length) untagged++;
      const seen = new Set();
      for (const t of mine) {
        const key = tagKey(t.tag);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const entry = counts.get(key) || { name: t.tag, count: 0 };
        entry.count++;
        counts.set(key, entry);
      }
    }
    if (activeTag && activeTag !== NO_TAG && !counts.has(activeTag)) activeTag = null;
    if (activeTag === NO_TAG && !untagged) activeTag = null;
    if (!counts.size) {
      filtersEl.style.display = "none";
      filtersEl.innerHTML = "";
      return;
    }
    const chips = [{ key: null, label: `Tous (${prompts.length})` }];
    [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name, "fr"))
      .forEach(([key, e]) => chips.push({ key, label: `#${e.name} (${e.count})` }));
    if (untagged) chips.push({ key: NO_TAG, label: `Sans tag (${untagged})` });
    filtersEl.style.display = "";
    filtersEl.innerHTML = "";
    for (const c of chips) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `chip${c.key === activeTag ? " active" : ""}`;
      btn.textContent = c.label;
      btn.setAttribute("aria-pressed", c.key === activeTag ? "true" : "false");
      btn.addEventListener("click", () => {
        activeTag = c.key === activeTag ? null : c.key;
        render();
      });
      filtersEl.appendChild(btn);
    }
  }

  function render() {
    classifyBtn.style.display = prompts.length ? "" : "none";
    renderFilters();
    const filtered = prompts.filter(matchesQuery).filter(matchesTag).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    subtitleEl.textContent = prompts.length
      ? filtered.length === prompts.length
        ? `${prompts.length} prompt(s)`
        : `${filtered.length} sur ${prompts.length} prompt(s)`
      : "Aucun prompt";

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
          ${(() => {
            const mine = tagsOf(p);
            return mine.length ? `<div class="item-tags">${mine.map((t) => `<span class="tag-chip-mini">#${escapeHtml(t.tag)}</span>`).join("")}</div>` : "";
          })()}
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
  const unsubTags = tagsApi.subscribe((items) => {
    allTags = items;
    render();
  });

  return function cleanup() {
    unsub();
    unsubTags();
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
    <div class="field">
      <label for="prompt-tags">Tags (optionnel)</label>
      <input id="prompt-tags" type="text" placeholder="Ex. communication, zendesk (séparés par des virgules)" />
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
          for (const raw of bodyEl.querySelector("#prompt-tags").value.split(/[,;]/)) {
            if (tagsApi.stripHash(raw)) await tagsApi.addTag("Prompt", prompt.id, raw);
          }
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
    <div class="field">
      <label>Tags</label>
      <div id="prompt-detail-tags"></div>
    </div>
    <button id="prompt-copy-btn" type="button" class="btn btn-secondary btn-block" style="margin-bottom:8px;">📋 Copier le prompt</button>
  `;

  body.querySelector("#prompt-copy-btn").addEventListener("click", () => copyPromptText(prompt.text));
  renderTagsEditor(body.querySelector("#prompt-detail-tags"), "Prompt", prompt.id);

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

  // BUG corrigé (15/09/2026, audit performance) : même anti-rebond manquant que la recherche
  // principale ci-dessus, sur ce second champ (sélecteur de prompt).
  let pickerSearchDebounce = null;
  searchEl.addEventListener("input", () => {
    clearTimeout(pickerSearchDebounce);
    pickerSearchDebounce = setTimeout(() => {
      query = searchEl.value.trim().toLowerCase();
      renderList();
    }, 150);
  });

  renderList();

  const { close } = openModal({
    title: "Lier un prompt",
    body,
    actions: [{ label: "Annuler", variant: "ghost", onClick: () => onCancel?.() }],
  });
  setTimeout(() => searchEl.focus(), 30);
}

// 🏷️ Classer ses prompts avec une IA (08/10/2026, voir js/domain/promptsClassify.js) : copier une demande,
// la coller dans l'IA de son choix, recoller la réponse, vérifier l'aperçu, appliquer. Les tags sont posés
// seulement au clic sur "Appliquer", uniquement sur les prompts cochés, et s'ajoutent à ceux déjà présents
// (rien n'est retiré). Tout reste dans UNE fenêtre : `openModal()` n'en garde qu'une à la fois.
function openClassifyModal(allPrompts, allTags) {
  const ordered = [...allPrompts].sort((a, b) => (a.title || "").localeCompare(b.title || "", "fr"));
  if (!ordered.length) {
    showToast("Aucun prompt à classer");
    return;
  }
  const keys = ordered.map((_, i) => keyFor(i));
  const existingTags = tagsApi.groupByName(allTags.filter((t) => t.entityType === "Prompt")).map((g) => g.displayName);
  const requestText = buildClassifyRequest(ordered, existingTags);
  let parsed = null;
  let applying = false;

  const body = document.createElement("div");
  body.innerHTML = `
    <p class="item-meta" style="margin-top:0;">
      Pilotage prépare une demande avec la liste de tes ${ordered.length} prompts (titre et description, pas leur texte).
      Colle-la dans ton IA (Perplexity, Claude, ChatGPT, Copilot…), puis colle sa réponse ci-dessous.
      <strong>Rien n'est enregistré avant « Appliquer »</strong>, et les tags s'ajoutent à ceux déjà posés.
    </p>
    <button type="button" id="classify-copy-btn" class="btn btn-secondary btn-sm">📋 Copier la demande</button>
    <details style="margin-top:6px;"><summary class="item-meta" style="cursor:pointer;">Voir la demande</summary>
      <textarea readonly rows="6" style="width:100%;font-family:inherit;margin-top:6px;">${escapeHtml(requestText)}</textarea>
    </details>
    <div class="field" style="margin-top:12px;">
      <label for="classify-response">Réponse de l'IA</label>
      <textarea id="classify-response" rows="5" placeholder="Colle ici la réponse complète (le bloc JSON suffit)"></textarea>
    </div>
    <button type="button" id="classify-preview-btn" class="btn btn-secondary btn-sm">👀 Aperçu du classement</button>
    <div id="classify-result" class="item-meta" role="status" style="margin-top:8px;"></div>
    <div id="classify-preview"></div>
  `;
  const resultEl = body.querySelector("#classify-result");
  const previewEl = body.querySelector("#classify-preview");

  body.querySelector("#classify-copy-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(requestText);
      showToast("Demande copiée — colle-la dans ton IA");
    } catch {
      showToast("Copie automatique indisponible — ouvre « Voir la demande » et copie le texte (Ctrl+C / Cmd+C)");
    }
  });

  body.querySelector("#classify-preview-btn").addEventListener("click", () => {
    parsed = null;
    previewEl.innerHTML = "";
    const result = parseClassifyResponse(body.querySelector("#classify-response").value, keys);
    if (!result.ok) {
      resultEl.textContent = `⚠️ ${result.error}`;
      return;
    }
    parsed = result;
    const tagSet = new Set(result.assignments.flatMap((a) => a.tags));
    const notes = [];
    if (result.missingKeys.length) notes.push(`${result.missingKeys.length} prompt${result.missingKeys.length > 1 ? "s" : ""} non classé${result.missingKeys.length > 1 ? "s" : ""} par l'IA (laissés tels quels)`);
    if (result.unknownKeys.length) notes.push(`${result.unknownKeys.length} entrée${result.unknownKeys.length > 1 ? "s" : ""} inconnue${result.unknownKeys.length > 1 ? "s" : ""} ignorée${result.unknownKeys.length > 1 ? "s" : ""}`);
    resultEl.textContent = `✅ ${result.assignments.length} prompt${result.assignments.length > 1 ? "s" : ""} classé${result.assignments.length > 1 ? "s" : ""} avec ${tagSet.size} tag${tagSet.size > 1 ? "s" : ""} différent${tagSet.size > 1 ? "s" : ""}. Décoche ceux que tu ne veux pas changer.${notes.length ? " " + notes.join(" · ") + "." : ""}`;
    result.assignments.forEach((a) => {
      const prompt = ordered[keys.indexOf(a.key)];
      const row = document.createElement("label");
      row.className = "classify-preview-row";
      row.innerHTML = `<input type="checkbox" checked data-key="${escapeAttr(a.key)}" />
        <span class="classify-preview-main"><strong>${escapeHtml(prompt.title)}</strong>
        <span class="item-tags">${a.tags.map((t) => `<span class="tag-chip-mini">#${escapeHtml(t)}</span>`).join("")}</span></span>`;
      previewEl.appendChild(row);
    });
  });

  const { bodyEl, close } = openModal({
    title: "🏷️ Classer mes prompts avec l'IA",
    body,
    wide: true,
    actions: [
      { label: "Annuler", variant: "ghost" },
      {
        label: "✅ Appliquer les tags cochés",
        variant: "primary",
        closesModal: false,
        onClick: async () => {
          if (!parsed) {
            showToast("Fais d'abord l'aperçu du classement");
            return;
          }
          if (applying) return;
          const chosen = [...bodyEl.querySelectorAll('#classify-preview input[type="checkbox"]:checked')].map((el) => el.dataset.key);
          const todo = parsed.assignments.filter((a) => chosen.includes(a.key));
          if (!todo.length) {
            showToast("Aucun prompt coché");
            return;
          }
          applying = true;
          let done = 0;
          try {
            for (const a of todo) {
              const prompt = ordered[keys.indexOf(a.key)];
              for (const tag of a.tags) await tagsApi.addTag("Prompt", prompt.id, tag);
              done++;
              resultEl.textContent = `Application… ${done} / ${todo.length}`;
            }
            close();
            showToast(`${todo.length} prompt${todo.length > 1 ? "s" : ""} classé${todo.length > 1 ? "s" : ""}`);
          } catch (err) {
            console.error("[prompts] Échec de l'application des tags :", err);
            resultEl.textContent = `⚠️ Interrompu après ${done} / ${todo.length} prompt(s) : les tags déjà posés sont conservés, tu peux relancer sans doublon.`;
          } finally {
            applying = false;
          }
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
