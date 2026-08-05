import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';

const ICONS = {
  play: '<polygon points="7 5 19 12 7 19 7 5"></polygon>',
  edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path>',
  delete: '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
  chevron: '<polyline points="9 18 15 12 9 6"></polyline>'
};

function attributes(values) {
  return Object.entries(values)
    .filter(([, value]) => value !== '' && value !== false && value != null)
    .map(([name, value]) => value === true ? name : `${name}="${escapeAttribute(String(value))}"`)
    .join(' ');
}

export function renderLobbyAction({
  kind = 'text',
  label,
  icon = '',
  id = '',
  className = '',
  title = label,
  disabled = false,
  type = 'button'
}) {
  const iconMarkup = icon && ICONS[icon]
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" ${icon === 'play' ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"'}>${ICONS[icon]}</svg>`
    : '';
  const classes = ['lobby-action', `lobby-action--${kind}`, icon ? `lobby-action--${icon}` : '', className].filter(Boolean).join(' ');

  return `<button ${attributes({ id, class: classes, type, title, 'aria-label': label, disabled })}>${iconMarkup}${kind === 'text' ? `<span>${escapeHTML(label)}</span>` : ''}</button>`;
}

export function renderLobbyTabs({ label, items, activeValue }) {
  const tabs = items.map(({ value, text }) => {
    const active = value === activeValue;

    return `<button ${attributes({
      class: `segment-btn${active ? ' active' : ''}`,
      type: 'button',
      'data-type': value,
      'aria-pressed': active ? 'true' : 'false'
    })}>${escapeHTML(text)}</button>`;
  }).join('');

  return `<div class="segmented-control" role="group" aria-label="${escapeAttribute(label)}">${tabs}</div>`;
}

export function renderLobbyShell({
  title,
  description = '',
  action = '',
  variant = 'list',
  content = '',
  footer = '',
  className = ''
}) {
  return `
    <div class="dashboard-layout fade-in lobby-screen ${className}">
      <nav class="nav-bar lobby-nav" aria-label="Navegacion del modulo">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="lobby-nav__item">
            <button class="nav-item" id="btn-back-home" type="button" aria-label="Volver">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Volver</span>
            </button>
          </li>
        </ul>
      </nav>
      <main class="main-viewport lobby-viewport">
        <section class="lobby-panel lobby-panel--${escapeAttribute(variant)}">
          <header class="lobby-header">
            ${renderTechnicalTitle(title)}
            ${action}
          </header>
          ${description ? `<p class="lobby-description">${escapeHTML(description)}</p>` : ''}
          <div class="lobby-content">${content}</div>
          ${footer ? `<footer class="lobby-footer">${footer}</footer>` : ''}
        </section>
      </main>
    </div>`;
}

export function renderPracticeRow({
  title,
  kind = '',
  metadata = '',
  duration = '',
  details = '',
  actions = '',
  state = '',
  className = '',
  expandable = true
}) {
  const classes = ['practice-row', state ? `practice-row--${state}` : '', className].filter(Boolean).join(' ');

  return `
    <article class="${classes}">
      <div class="practice-row__summary">
        ${expandable ? `
          <button class="practice-row__expand" type="button" aria-expanded="false" aria-label="Ver detalles de ${escapeAttribute(title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.chevron}</svg>
            <span class="practice-row__title-stack">
              <strong class="practice-row__title">${escapeHTML(title)}</strong>
              ${kind ? `<span class="practice-row__kind">${escapeHTML(kind)}</span>` : ''}
            </span>
          </button>` : `
          <div class="practice-row__identity">
            <strong class="practice-row__title">${escapeHTML(title)}</strong>
            ${kind ? `<span class="practice-row__kind">${escapeHTML(kind)}</span>` : ''}
          </div>`}
        <div class="practice-row__meta">
          ${metadata ? `<span class="practice-row__metadata">${escapeHTML(metadata)}</span>` : ''}
          ${duration ? `<span class="practice-row__duration">${escapeHTML(duration)}</span>` : ''}
          ${actions}
        </div>
      </div>
      ${details ? `<div class="practice-row__details" hidden>${details}</div>` : ''}
    </article>`;
}
