import { addData, getAllData, deleteData } from '../db.js';

const FIELDS = [
  { key: 'weight', label: 'Peso', unit: 'kg' },
  { key: 'waist', label: 'Cintura', unit: 'cm' },
  { key: 'hips', label: 'Cadera', unit: 'cm' },
  { key: 'chest', label: 'Pecho', unit: 'cm' },
  { key: 'arm_l', label: 'Brazo Izq.', unit: 'cm' },
  { key: 'arm_r', label: 'Brazo Der.', unit: 'cm' },
  { key: 'thigh_l', label: 'Muslo Izq.', unit: 'cm' },
  { key: 'thigh_r', label: 'Muslo Der.', unit: 'cm' },
];

const MEASURE_COLORS = {
  waist:   '#a78bfa',
  hips:    '#f472b6',
  chest:   '#60a5fa',
  arm_l:   '#34d399',
  arm_r:   '#6ee7b7',
  thigh_l: '#fbbf24',
  thigh_r: '#f59e0b',
};

function getOne(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function putOne(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const req = tx.objectStore(storeName).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function renderBodyScreen(container, db, onNavigate) {
  const today = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <div class="body-screen fade-in">
      <header class="module-header">
        <button id="body-back-btn" class="back-btn" title="Volver al inicio">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <h1 class="module-title">Cuerpo</h1>
      </header>

      <div class="body-content">
        <nav class="body-tabs">
          <button class="body-tab active" data-tab="graficos">Gr&#225;ficos</button>
          <button class="body-tab" data-tab="registro">Registro</button>
          <button class="body-tab" data-tab="historial">Historial</button>
          <button class="body-tab" data-tab="metas">Metas</button>
        </nav>

        <!-- GRAFICOS -->
        <section id="body-tab-graficos" class="body-tab-panel active">
          <div id="body-charts-container">
            <div class="chart-block">
              <h2 class="chart-title">Peso (kg)</h2>
              <div class="chart-wrapper"><canvas id="chart-weight"></canvas></div>
            </div>
            <div class="chart-block">
              <h2 class="chart-title">Medidas corporales (cm)</h2>
              <div id="measure-toggles" class="measure-toggles"></div>
              <div class="chart-wrapper"><canvas id="chart-measures"></canvas></div>
            </div>
          </div>
          <p id="body-charts-empty" class="body-empty" style="display:none;">Sin datos suficientes. Registra al menos una medici&#243;n.</p>
        </section>

        <!-- REGISTRO -->
        <section id="body-tab-registro" class="body-tab-panel">
          <p class="body-tab-hint">Todos los campos son opcionales excepto la fecha.</p>
          <form id="body-form" class="body-form">
            <div class="body-field-group">
              <label class="body-label" for="body-date">Fecha</label>
              <input class="body-input" type="date" id="body-date" name="date" value="${today}" required>
            </div>
            ${FIELDS.map(f => `
              <div class="body-field-group">
                <label class="body-label" for="body-${f.key}">${f.label} <span class="body-unit">(${f.unit})</span></label>
                <input class="body-input" type="number" step="0.1" min="0" id="body-${f.key}" name="${f.key}" placeholder="&#8212;">
              </div>
            `).join('')}
            <div class="body-field-group">
              <label class="body-label" for="body-notes">Notas</label>
              <textarea class="body-input body-textarea" id="body-notes" name="notes" placeholder="Observaciones opcionales&#8230;" rows="2"></textarea>
            </div>
            <button type="submit" class="body-save-btn">Guardar Registro</button>
          </form>
        </section>

        <!-- HISTORIAL -->
        <section id="body-tab-historial" class="body-tab-panel">
          <div id="body-history-list" class="body-history-list">
            <p class="body-empty">Cargando&#8230;</p>
          </div>
        </section>

        <!-- METAS -->
        <section id="body-tab-metas" class="body-tab-panel">
          <p class="body-tab-hint">Define tus objetivos. Aparecer&#225;n como l&#237;neas de referencia en los gr&#225;ficos.</p>
          <form id="body-goals-form" class="body-form">
            ${FIELDS.map(f => `
              <div class="body-field-group">
                <label class="body-label" for="goal-${f.key}">${f.label} objetivo <span class="body-unit">(${f.unit})</span></label>
                <input class="body-input" type="number" step="0.1" min="0" id="goal-${f.key}" name="${f.key}" placeholder="Sin meta">
              </div>
            `).join('')}
            <button type="submit" class="body-save-btn">Guardar Metas</button>
          </form>
        </section>
      </div>

      <div class="body-toast" id="body-toast"></div>
    </div>
  `;

  container.querySelector('#body-back-btn').addEventListener('click', () => onNavigate('inicio'));

  // Tab switching
  const tabs = container.querySelectorAll('.body-tab');
  const panels = container.querySelectorAll('.body-tab-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      container.querySelector(`#body-tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'graficos') renderCharts(db, container);
      if (tab.dataset.tab === 'historial') renderHistory(db, container);
    });
  });

  await loadGoalsForm(db, container);
  await renderCharts(db, container);

  // Guardar registro
  container.querySelector('#body-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const record = { date: formData.get('date') };
    FIELDS.forEach(f => {
      const val = formData.get(f.key);
      if (val !== '' && val !== null) record[f.key] = parseFloat(val);
    });
    const notes = formData.get('notes');
    if (notes) record.notes = notes;
    try {
      await addData(db, 'body_metrics', record);
      e.target.reset();
      container.querySelector('#body-date').value = today;
      showToast(container, '&#10003; Registro guardado');
    } catch (err) {
      console.error('[Body] Error guardando registro:', err);
    }
  });

  // Guardar metas
  container.querySelector('#body-goals-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goals = { id: 'main' };
    const formData = new FormData(e.target);
    FIELDS.forEach(f => {
      const val = formData.get(f.key);
      if (val !== '' && val !== null) goals[f.key] = parseFloat(val);
    });
    try {
      await putOne(db, 'body_goals', goals);
      showToast(container, '&#10003; Metas guardadas');
    } catch (err) {
      console.error('[Body] Error guardando metas:', err);
    }
  });
}

async function loadGoalsForm(db, container) {
  const goals = await getOne(db, 'body_goals', 'main');
  if (!goals) return;
  FIELDS.forEach(f => {
    const input = container.querySelector(`#goal-${f.key}`);
    if (input && goals[f.key] != null) input.value = goals[f.key];
  });
}

async function renderHistory(db, container) {
  const listEl = container.querySelector('#body-history-list');
  const records = await getAllData(db, 'body_metrics');
  if (records.length === 0) {
    listEl.innerHTML = '<p class="body-empty">Sin registros a&#250;n.</p>';
    return;
  }
  records.sort((a, b) => b.date.localeCompare(a.date));
  listEl.innerHTML = records.map(r => {
    const fieldsHtml = FIELDS.filter(f => r[f.key] != null)
      .map(f => `<span class="history-field">${f.label}: <strong>${r[f.key]} ${f.unit}</strong></span>`)
      .join('');
    return `
      <div class="body-history-card">
        <div class="history-card-header">
          <span class="history-date">${r.date}</span>
          <button class="btn-delete-metric" data-id="${r.id}" title="Eliminar">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="history-fields">${fieldsHtml || '<em>Sin medidas registradas</em>'}</div>
        ${r.notes ? `<p class="history-notes">${r.notes}</p>` : ''}
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.btn-delete-metric').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      if (confirm('&#191;Eliminar este registro?')) {
        await deleteData(db, 'body_metrics', id);
        await renderHistory(db, container);
      }
    });
  });
}

// Chart instances – module-scoped so they survive tab switching
let chartWeight = null;
let chartMeasures = null;
let activeToggles = new Set(Object.keys(MEASURE_COLORS));

async function renderCharts(db, container) {
  const records = await getAllData(db, 'body_metrics');
  const goals = await getOne(db, 'body_goals', 'main');
  const emptyMsg = container.querySelector('#body-charts-empty');
  const chartsContainer = container.querySelector('#body-charts-container');

  if (records.length === 0) {
    emptyMsg.style.display = '';
    chartsContainer.style.display = 'none';
    return;
  }
  emptyMsg.style.display = 'none';
  chartsContainer.style.display = '';

  records.sort((a, b) => a.date.localeCompare(b.date));
  const labels = records.map(r => r.date);

  // Weight chart
  const weightCtx = container.querySelector('#chart-weight').getContext('2d');
  if (chartWeight) chartWeight.destroy();
  const weightDatasets = [{
    label: 'Peso (kg)',
    data: records.map(r => r.weight ?? null),
    borderColor: '#e879f9',
    backgroundColor: 'rgba(232,121,249,0.12)',
    tension: 0.4,
    fill: true,
    spanGaps: true,
    pointRadius: 4,
    pointHoverRadius: 6,
  }];
  if (goals?.weight != null) {
    weightDatasets.push({
      label: `Meta: ${goals.weight} kg`,
      data: labels.map(() => goals.weight),
      borderColor: 'rgba(232,121,249,0.45)',
      borderDash: [6, 4],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
    });
  }
  chartWeight = new Chart(weightCtx, { type: 'line', data: { labels, datasets: weightDatasets }, options: chartOptions('kg') });

  // Measure toggles
  const togglesEl = container.querySelector('#measure-toggles');
  const measureFields = FIELDS.filter(f => f.key !== 'weight');
  togglesEl.innerHTML = measureFields.map(f => `
    <button class="measure-toggle ${activeToggles.has(f.key) ? 'active' : ''}" data-key="${f.key}" style="--toggle-color:${MEASURE_COLORS[f.key]}">${f.label}</button>
  `).join('');
  togglesEl.querySelectorAll('.measure-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      activeToggles.has(key) ? activeToggles.delete(key) : activeToggles.add(key);
      btn.classList.toggle('active');
      if (chartMeasures) {
        chartMeasures.data.datasets = buildMeasureDatasets(records, goals, labels);
        chartMeasures.update();
      }
    });
  });

  // Measures chart
  const measuresCtx = container.querySelector('#chart-measures').getContext('2d');
  if (chartMeasures) chartMeasures.destroy();
  chartMeasures = new Chart(measuresCtx, { type: 'line', data: { labels, datasets: buildMeasureDatasets(records, goals, labels) }, options: chartOptions('cm') });
}

function buildMeasureDatasets(records, goals, labels) {
  const active = FIELDS.filter(f => f.key !== 'weight' && activeToggles.has(f.key));
  const datasets = active.map(f => ({
    label: f.label,
    data: records.map(r => r[f.key] ?? null),
    borderColor: MEASURE_COLORS[f.key],
    backgroundColor: MEASURE_COLORS[f.key] + '20',
    tension: 0.4,
    fill: false,
    spanGaps: true,
    pointRadius: 3,
    pointHoverRadius: 5,
  }));
  if (goals) {
    active.forEach(f => {
      if (goals[f.key] != null) {
        datasets.push({
          label: `Meta ${f.label}`,
          data: labels.map(() => goals[f.key]),
          borderColor: MEASURE_COLORS[f.key] + '60',
          borderDash: [6, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        });
      }
    });
  }
  return datasets;
}

function chartOptions(unit) {
  const isDark = document.body.classList.contains('dark-theme');
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y + ' ' + unit : '&#8212;'}` } }
    },
    scales: {
      x: { ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 8 }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { size: 11 }, callback: v => v + ' ' + unit }, grid: { color: gridColor } }
    }
  };
}

function showToast(container, message) {
  const toast = container.querySelector('#body-toast');
  if (!toast) return;
  toast.innerHTML = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}
