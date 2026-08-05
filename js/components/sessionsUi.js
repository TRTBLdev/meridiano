import { escapeHTML } from '../utils/sanitize.js';
import { renderLobbyAction } from './lobbyUi.js';

const deleteIcon = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>`;

export function renderCompoundAction(label, { type = 'button', className = '', id = '', disabled = false } = {}) {
  return `<button type="${type}" ${id ? `id="${id}"` : ''} class="compound-text-action ${className}" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

export function renderCompoundSessionCard(session, { invalidReason = '' } = {}) {
  const blocks = (session.blocks || []).map(block => `
    <div class="compound-session-card__block">
      <span class="compound-session-card__module">[${escapeHTML(block.module.toUpperCase())}]</span>
      <span>${escapeHTML(block.nameOverride)} (${block.duration}s)</span>
    </div>
  `).join('') || '<div class="compound-session-card__empty">Sin bloques</div>';

  return `
    <div class="compound-session-card__header">
      <div>
        <div class="compound-session-card__name">${escapeHTML(session.name)}</div>
        <div class="compound-session-card__description">${escapeHTML(session.description || '')}</div>
      </div>
      <div class="compound-session-card__icons">
        ${renderLobbyAction({ kind: 'icon', icon: 'edit', label: 'Editar sesión', className: 'btn-edit-session' })}
        ${renderLobbyAction({ kind: 'icon', icon: 'delete', label: 'Borrar sesión', className: 'btn-delete-session' })}
      </div>
    </div>
    <div class="compound-session-card__blocks">${blocks}</div>
    ${invalidReason ? `<div class="compound-session-warning" role="status">${escapeHTML(invalidReason)}</div>` : ''}
    ${renderLobbyAction({ kind: 'icon', icon: 'play', label: 'Iniciar sesión', className: 'btn-play-session', disabled: Boolean(invalidReason) })}
  `;
}

export function renderCompoundSessionBlock(block, index, totalBlocks, presetsCatalog, { invalidReason = '' } = {}) {
  const availablePresets = presetsCatalog[block.module] || [];
  const hasCurrentPreset = availablePresets.some(preset => preset.id === block.presetId);
  const invalidCurrentOption = !hasCurrentPreset
    ? block.presetId
      ? `<option value="${escapeHTML(block.presetId)}" selected disabled>${escapeHTML(block.nameOverride || block.presetId)} (no disponible)</option>`
      : '<option value="" selected disabled>Seleccionar preset</option>'
    : '';
  const options = invalidCurrentOption + availablePresets.map(preset =>
    `<option value="${escapeHTML(preset.id)}" ${preset.id === block.presetId ? 'selected' : ''}>${escapeHTML(preset.name)}</option>`
  ).join('');

  return `
    <div class="compound-block__header">
      <span class="compound-block__title">Bloque ${index + 1}</span>
      <div class="compound-block__controls">
        <button type="button" class="compound-icon-action btn-move-up" aria-label="Subir bloque" ${index === 0 ? 'disabled' : ''}>▲</button>
        <button type="button" class="compound-icon-action btn-move-down" aria-label="Bajar bloque" ${index === totalBlocks - 1 ? 'disabled' : ''}>▼</button>
        <button type="button" class="btn-action-icon delete-icon btn-remove-block" title="Eliminar bloque" aria-label="Eliminar bloque">${deleteIcon}</button>
      </div>
    </div>
    ${invalidReason ? `<div class="compound-session-warning compound-session-warning--block" role="status">${escapeHTML(invalidReason)}. Puedes seleccionar otro circuito o eliminar este bloque.</div>` : ''}
    <div class="compound-block__fields">
      <label class="compound-field compound-field--module">
        <span>Módulo</span>
        <select class="block-module-select acu-select-flat">
          <option value="breathwork" ${block.module === 'breathwork' ? 'selected' : ''}>Breathwork</option>
          <option value="strength" ${block.module === 'strength' ? 'selected' : ''}>Fuerza</option>
          <option value="yoga" ${block.module === 'yoga' ? 'selected' : ''}>Yin Yoga</option>
          <option value="acupuncture" ${block.module === 'acupuncture' ? 'selected' : ''}>Acupuntura</option>
        </select>
      </label>
      <label class="compound-field compound-field--preset">
        <span>Preset clínico / rutina</span>
        <select class="block-preset-select acu-select-flat">${options}</select>
      </label>
      <label class="compound-field compound-field--name">
        <span>Nombre del bloque</span>
        <input type="text" class="block-name-input acu-input-flat" value="${escapeHTML(block.nameOverride || '')}" required>
      </label>
      <label class="compound-field compound-field--duration">
        <span>Duración (s)</span>
        <input type="number" class="block-dur-input acu-input-flat" value="${block.duration}" min="10" required>
      </label>
    </div>
  `;
}
