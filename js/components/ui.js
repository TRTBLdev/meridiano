export function renderTechnicalTitle(title, { level = 2, className = '', id = '', style = '' } = {}) {
  const tag = `h${level}`;
  const attributes = [
    `class="technical-title${className ? ` ${className}` : ''}"`,
    id ? `id="${id}"` : '',
    style ? `style="${style}"` : ''
  ].filter(Boolean).join(' ');

  return `<${tag} ${attributes}>[ ${title} ]</${tag}>`;
}

export function setAccordionExpanded(button, body, expanded) {
  button.setAttribute('aria-expanded', String(expanded));
  body.hidden = !expanded;
  const mark = button.querySelector('.disclosure-mark');
  if (mark) mark.textContent = expanded ? '−' : '+';
}
