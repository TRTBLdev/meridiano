export function renderTechnicalTitle(title, { level = 2, className = '', id = '', style = '' } = {}) {
  const tag = `h${level}`;
  const attributes = [
    `class="technical-title${className ? ` ${className}` : ''}"`,
    id ? `id="${id}"` : '',
    style ? `style="${style}"` : ''
  ].filter(Boolean).join(' ');

  return `<${tag} ${attributes}>[ ${title} ]</${tag}>`;
}
