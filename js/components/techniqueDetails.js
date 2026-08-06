import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';

export function renderTechniqueDetails({
  id = '',
  className = '',
  label = 'VER TÉCNICA',
  sections = [],
  preserveEmpty = false
} = {}) {
  const normalizedSections = sections.map((section, index) => ({
    key: section.key || `section-${index}`,
    title: section.title || '',
    content: String(section.content || '').trim(),
    wide: Boolean(section.wide)
  }));
  const visibleSections = preserveEmpty
    ? normalizedSections
    : normalizedSections.filter(section => section.content);
  const hasContent = normalizedSections.some(section => section.content);

  if (visibleSections.length === 0) return '';

  return `
    <details ${id ? `id="${escapeAttribute(id)}"` : ''} class="timer-technique ${escapeAttribute(className)}" ${hasContent ? '' : 'hidden'}>
      <summary>${escapeHTML(label)}</summary>
      <div class="timer-technique__content">
        ${visibleSections.map(section => `
          <section class="timer-technique__section${section.wide ? ' timer-technique__section--wide' : ''}" data-technique-section="${escapeAttribute(section.key)}" ${section.content ? '' : 'hidden'}>
            <h2>${escapeHTML(section.title)}</h2>
            <p data-technique-content="${escapeAttribute(section.key)}">${escapeHTML(section.content)}</p>
          </section>`).join('')}
      </div>
    </details>`;
}
