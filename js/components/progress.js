import { getAllData } from '../db.js';
import { escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';
import { formatDurationSeconds } from '../utils/sessionResults.js';

/**
 * Familias de movimiento para el análisis de sobrecarga en Fuerza
 */
const STRENGTH_FAMILIES = {
  sentadilla: {
    name: 'Sentadilla (Rodilla/Cuádriceps)',
    ids: ['str-sentadilla-pelota', 'str-sentadilla-pelota-5kg'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'puente-gluteos': {
    name: 'Puente de Glúteos (Cadena Posterior)',
    ids: ['str-puente-gluteos', 'str-puente-gluteos-5kg'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'empuje-pecho': {
    name: 'Empuje de Torso (Pecho y Hombro Seguro)',
    ids: ['str-flexiones-bloques', 'str-flexiones-bloques-inclinadas'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'bisagra-cadera': {
    name: 'Bisagra de Cadera (Isquios y Lumbar)',
    ids: ['str-bisagra-cadera', 'str-bisagra-cadera-5kg'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  core: {
    name: 'Centro y Anti-Extensión (Core)',
    ids: ['str-plancha-pads', 'str-bicho-muerto', 'str-bicho-muerto-control'],
    metric: 'mixed',
    unitLabel: 'reps / seg'
  }
};

/**
 * Renderiza la pantalla de Progreso Integral por Sobrecarga y Vitalidad
 */
export async function renderProgressScreen(container, db, onNavigate) {
  container.innerHTML = `
    <div class="progress-screen fade-in">
      <header class="module-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px;">
        <button id="btn-progress-back" class="back-btn" title="Volver al inicio" style="background: none; border: none; cursor: pointer; color: var(--color-text-main); display: flex; align-items: center; gap: 6px;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span style="font-family: var(--font-digital); font-size: 0.75rem;">INICIO</span>
        </button>
        <span style="font-family: var(--font-digital); font-size: 0.7rem; color: var(--color-accent-green); letter-spacing: 1px;">ANÁLISIS DE RENDIMIENTO</span>
      </header>

      <div style="margin-bottom: 32px;">
        <h1 style="font-size: 1.6rem; font-weight: 300; margin: 0 0 6px 0;">Progreso y Sobrecarga</h1>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin: 0;">Evaluación integral por familias motoras, frecuencia acumulada y vitalidad biológica.</p>
      </div>

      <!-- SECCIÓN 1: SOBRECARGA EN FUERZA -->
      <section class="progress-section">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          ${renderTechnicalTitle('1. Sobrecarga por Patrón de Fuerza', { style: 'margin: 0;' })}
          <span id="strength-family-badge" style="font-size: 0.65rem; font-family: var(--font-digital); color: var(--color-text-muted);">CARGA EXTERNA</span>
        </div>

        <div class="progress-pattern-selector" id="pattern-pills-container">
          <button class="btn-pattern-pill active" data-family="sentadilla">Sentadilla</button>
          <button class="btn-pattern-pill" data-family="puente-gluteos">Puente de Glúteos</button>
          <button class="btn-pattern-pill" data-family="empuje-pecho">Empuje de Torso</button>
          <button class="btn-pattern-pill" data-family="bisagra-cadera">Bisagra de Cadera</button>
          <button class="btn-pattern-pill" data-family="core">Core</button>
        </div>

        <div id="strength-family-summary" style="display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;">
          <!-- Resumen inyectado -->
        </div>

        <div class="progress-chart-container">
          <canvas id="chart-strength-overload"></canvas>
        </div>
      </section>

      <!-- SECCIÓN 2: FRECUENCIA ACUMULADA Y CONSISTENCIA -->
      <section class="progress-section">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
          ${renderTechnicalTitle('2. Frecuencia y Consistencia Semanal', { style: 'margin: 0;' })}
          <span style="font-size: 0.65rem; font-family: var(--font-digital); color: var(--color-accent-green);">META: 2 SESIONES NUCLEARES</span>
        </div>
        <p style="font-size: 0.78rem; color: var(--color-text-muted); margin: 0 0 16px;">
          Contenedor de 45–60 min. Las sesiones estándar y menstruales computan por igual al 100% como estímulos de alta calidad.
        </p>

        <div class="progress-chart-container">
          <canvas id="chart-weekly-frequency"></canvas>
        </div>
      </section>

      <!-- SECCIÓN 3: MÉTRICAS CORPORALES Y VITALIDAD -->
      <section class="progress-section">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 16px;">
          ${renderTechnicalTitle('3. Correlación Corporal y Estado de Vitalidad', { style: 'margin: 0;' })}
          <span style="font-size: 0.65rem; font-family: var(--font-digital); color: var(--color-text-muted);">ANTROPOMETRÍA</span>
        </div>

        <div id="vitality-stats-container" style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
          <!-- Métricas de vitalidad inyectadas -->
        </div>

        <div class="progress-chart-container">
          <canvas id="chart-body-correlation"></canvas>
        </div>
      </section>
    </div>
  `;

  // Listener para volver
  container.querySelector('#btn-progress-back').addEventListener('click', () => onNavigate('inicio'));

  // Cargar datos y renderizar gráficos
  await initProgressCharts(db, container);
}

/**
 * Procesa los datos de IndexedDB y renderiza los 3 gráficos
 */
async function initProgressCharts(db, container) {
  try {
    const logs = await getAllData(db, 'sessions_log');
    const bodyMetrics = await getAllData(db, 'body_metrics');

    let activeFamily = 'sentadilla';
    let strengthChartInstance = null;

    // Selector de patrón motor
    const pillButtons = container.querySelectorAll('.btn-pattern-pill');
    pillButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        pillButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFamily = btn.getAttribute('data-family');
        renderStrengthChart(activeFamily);
      });
    });

    // -------------------------------------------------------------
    // GRÁFICO 1: SOBRECARGA EN FUERZA POR PATRÓN
    // -------------------------------------------------------------
    function renderStrengthChart(familyKey) {
      const familyConfig = STRENGTH_FAMILIES[familyKey];
      if (!familyConfig) return;

      const entriesByDate = [];

      logs.forEach(log => {
        const dateStr = new Date(log.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        
        // Buscar entradas de fuerza en logs directos o en bloques compuestos
        let strengthEntries = [];
        if (log.type === 'strength' && log.strengthResult?.entries) {
          strengthEntries = log.strengthResult.entries;
        } else if (log.type === 'compound' && log.blocks) {
          log.blocks.forEach(b => {
            if (b.module === 'strength' && b.result?.entries) {
              strengthEntries.push(...b.result.entries);
            }
          });
        }

        const matchEntries = strengthEntries.filter(e => familyConfig.ids.includes(e.exerciseId));
        if (matchEntries.length > 0) {
          const totalReps = matchEntries.reduce((sum, e) => sum + (e.actualValue || 0), 0);
          const maxWeight = matchEntries.some(e => e.exerciseId.includes('5kg')) ? 5 : 0;
          entriesByDate.push({
            date: dateStr,
            fullDate: new Date(log.date),
            reps: totalReps,
            weight: maxWeight,
            rounds: matchEntries.length
          });
        }
      });

      entriesByDate.sort((a, b) => a.fullDate - b.fullDate);

      // Actualizar resumen numérico
      const summaryContainer = container.querySelector('#strength-family-summary');
      const maxWeightEver = entriesByDate.reduce((max, e) => Math.max(max, e.weight), 0);
      const totalRepsEver = entriesByDate.reduce((sum, e) => sum + e.reps, 0);

      summaryContainer.className = 'progress-metrics-row';
      summaryContainer.innerHTML = `
        <div class="progress-metric-col">
          <div class="progress-metric-sub">CARGA MÁXIMA</div>
          <div class="progress-metric-val highlight">${maxWeightEver > 0 ? `${maxWeightEver} KG (Botellón)` : 'Peso Corporal'}</div>
        </div>
        <div class="progress-metric-col">
          <div class="progress-metric-sub">REPETICIONES TOTALES</div>
          <div class="progress-metric-val">${totalRepsEver} ${familyConfig.unitLabel}</div>
        </div>
        <div class="progress-metric-col">
          <div class="progress-metric-sub">SESIONES REGISTRADAS</div>
          <div class="progress-metric-val">${entriesByDate.length}</div>
        </div>
      `;

      // Renderizar Canvas Chart.js
      const canvas = container.querySelector('#chart-strength-overload');
      if (strengthChartInstance) {
        strengthChartInstance.destroy();
      }

      if (entriesByDate.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const isDark = document.body.classList.contains('dark-theme');
      const textColor = isDark ? '#E8E6E3' : '#2E2B28';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

      strengthChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: entriesByDate.map(e => e.date),
          datasets: [
            {
              label: 'Carga Externa (kg)',
              data: entriesByDate.map(e => e.weight),
              backgroundColor: '#00E676',
              borderRadius: 4,
              yAxisID: 'y1'
            },
            {
              type: 'line',
              label: `Volumen (${familyConfig.unitLabel})`,
              data: entriesByDate.map(e => e.reps),
              borderColor: '#FF9800',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              tension: 0.2,
              fill: false,
              pointRadius: 4,
              yAxisID: 'y'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } }
            },
            y: {
              type: 'linear',
              position: 'left',
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } },
              title: { display: true, text: 'Reps Totales', color: textColor, font: { size: 10 } }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#00E676', font: { family: 'Share Tech Mono', size: 10 }, stepSize: 5 },
              title: { display: true, text: 'Carga (kg)', color: '#00E676', font: { size: 10 } },
              min: 0,
              max: 10
            }
          }
        }
      });
    }

    renderStrengthChart(activeFamily);

    // -------------------------------------------------------------
    // GRÁFICO 2: FRECUENCIA SEMANAL ACUMULADA
    // -------------------------------------------------------------
    function renderWeeklyFrequencyChart() {
      const weeksMap = new Map();

      logs.forEach(log => {
        const d = new Date(log.date);
        // Obtener Lunes de esa semana
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const weekKey = `${monday.getDate()} ${monday.toLocaleDateString('es-ES', { month: 'short' })}`;

        if (!weeksMap.has(weekKey)) {
          weeksMap.set(weekKey, { compound: 0, activations: 0, order: monday.getTime() });
        }

        const weekData = weeksMap.get(weekKey);
        if (log.type === 'compound') {
          weekData.compound += 1;
        } else if (log.type === 'strength' || log.notes?.includes('Activación')) {
          weekData.activations += 1;
        }
      });

      const sortedWeeks = Array.from(weeksMap.entries()).sort((a, b) => a[1].order - b[1].order);

      const canvas = container.querySelector('#chart-weekly-frequency');
      const isDark = document.body.classList.contains('dark-theme');
      const textColor = isDark ? '#E8E6E3' : '#2E2B28';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: sortedWeeks.map(w => w[0]),
          datasets: [
            {
              label: 'Sesiones Nucleares (Objetivo: 2)',
              data: sortedWeeks.map(w => w[1].compound),
              backgroundColor: '#00E676',
              borderRadius: 4
            },
            {
              label: 'Activaciones Matutinas',
              data: sortedWeeks.map(w => w[1].activations),
              backgroundColor: '#29B6F6',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          },
          scales: {
            x: {
              stacked: true,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } }
            },
            y: {
              stacked: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1, font: { family: 'Share Tech Mono', size: 10 } },
              title: { display: true, text: 'Sesiones Completadas', color: textColor, font: { size: 10 } }
            }
          }
        }
      });
    }

    renderWeeklyFrequencyChart();

    // -------------------------------------------------------------
    // GRÁFICO 3: MÉTRICAS CORPORALES Y VITALIDAD
    // -------------------------------------------------------------
    function renderBodyAndVitalityChart() {
      // Contabilizar vitalidad reportada
      let calmCount = 0;
      let vitalCount = 0;
      let fatiguedCount = 0;

      logs.forEach(l => {
        if (l.vitality === 'calm') calmCount++;
        if (l.vitality === 'vital') vitalCount++;
        if (l.vitality === 'fatigued') fatiguedCount++;
      });

      const vitalityContainer = container.querySelector('#vitality-stats-container');
      vitalityContainer.className = 'progress-metrics-row';
      vitalityContainer.innerHTML = `
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: #29B6F6;">ESTADO: EN CALMA</span>
          <div class="progress-metric-val">🌿 ${calmCount} prácticas</div>
        </div>
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: #00E676;">ESTADO: VITAL</span>
          <div class="progress-metric-val">⚡ ${vitalCount} prácticas</div>
        </div>
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: var(--color-accent-red);">ESTADO: FATIGADA</span>
          <div class="progress-metric-val">⏳ ${fatiguedCount} prácticas</div>
        </div>
      `;

      const canvas = container.querySelector('#chart-body-correlation');
      const sortedMetrics = [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date));

      if (sortedMetrics.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const isDark = document.body.classList.contains('dark-theme');
      const textColor = isDark ? '#E8E6E3' : '#2E2B28';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

      new Chart(canvas, {
        type: 'line',
        data: {
          labels: sortedMetrics.map(m => m.date),
          datasets: [
            {
              label: 'Peso (kg)',
              data: sortedMetrics.map(m => m.weight || null),
              borderColor: '#60A5FA',
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              tension: 0.2,
              yAxisID: 'y'
            },
            {
              label: 'Cintura (cm)',
              data: sortedMetrics.map(m => m.waist || null),
              borderColor: '#A78BFA',
              borderDash: [5, 5],
              tension: 0.2,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } }
            },
            y: {
              type: 'linear',
              position: 'left',
              grid: { color: gridColor },
              ticks: { color: '#60A5FA', font: { family: 'Share Tech Mono', size: 10 } },
              title: { display: true, text: 'Peso (kg)', color: '#60A5FA', font: { size: 10 } }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#A78BFA', font: { family: 'Share Tech Mono', size: 10 } },
              title: { display: true, text: 'Cintura (cm)', color: '#A78BFA', font: { size: 10 } }
            }
          }
        }
      });
    }

    renderBodyAndVitalityChart();

  } catch (err) {
    console.error('[Progress] Error rendering progress charts:', err);
  }
}
