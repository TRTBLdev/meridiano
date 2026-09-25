import { getAllData, putData } from '../db.js';
import { escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';
import { formatDurationSeconds } from '../utils/sessionResults.js';

/**
 * Familias de movimiento para el análisis de sobrecarga en Fuerza
 */
const STRENGTH_FAMILIES = {
  sentadilla: {
    name: 'Sentadilla (Rodilla/Cuádriceps)',
    ids: ['str-sentadilla-pelota'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'puente-gluteos': {
    name: 'Puente de Glúteos (Cadena Posterior)',
    ids: ['str-puente-gluteos'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'empuje-pecho': {
    name: 'Empuje de Torso (Pecho y Hombro Seguro)',
    ids: ['str-flexiones-bloques'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  'bisagra-cadera': {
    name: 'Bisagra de Cadera (Isquios y Lumbar)',
    ids: ['str-bisagra-cadera'],
    metric: 'reps',
    unitLabel: 'reps'
  },
  core: {
    name: 'Centro y Anti-Extensión (Core)',
    ids: ['str-plancha-pads', 'str-bicho-muerto'],
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
          <span id="strength-family-badge" style="font-size: 0.65rem; font-family: var(--font-digital); color: var(--color-text-muted);">PESO CORPORAL</span>
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
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          ${renderTechnicalTitle('2. Frecuencia y Consistencia Semanal', { style: 'margin: 0;' })}
          <div class="nuclear-goal-stepper" title="Ajustar meta semanal de sesiones nucleares">
            <button type="button" class="btn-stepper" id="btn-goal-minus" aria-label="Reducir meta">−</button>
            <span class="nuclear-goal-label" id="nuclear-goal-text">META: 2 SESIONES NUCLEARES</span>
            <button type="button" class="btn-stepper" id="btn-goal-plus" aria-label="Aumentar meta">+</button>
          </div>
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

        <div id="body-milestone-container">
          <!-- Hito antropométrico inyectado -->
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
    const bodyGoalsList = await getAllData(db, 'body_goals');
    let bodyGoals = (bodyGoalsList && bodyGoalsList.find(g => g.id === 'main')) || { id: 'main' };
    let nuclearGoal = Number.isInteger(bodyGoals.nuclearSessionsWeekly) ? bodyGoals.nuclearSessionsWeekly : 2;

    // Configuración interactiva de la meta semanal en Sección 2
    const goalTextEl = container.querySelector('#nuclear-goal-text');
    const updateGoalText = () => {
      if (goalTextEl) {
        goalTextEl.textContent = `META: ${nuclearGoal} SESIÓ${nuclearGoal > 1 ? 'NES NUCLEARES' : 'N NUCLEAR'}`;
      }
    };
    updateGoalText();

    const btnGoalMinus = container.querySelector('#btn-goal-minus');
    const btnGoalPlus = container.querySelector('#btn-goal-plus');
    if (btnGoalMinus && btnGoalPlus) {
      btnGoalMinus.addEventListener('click', async () => {
        if (nuclearGoal > 1) {
          nuclearGoal--;
          bodyGoals.nuclearSessionsWeekly = nuclearGoal;
          await putData(db, 'body_goals', bodyGoals);
          updateGoalText();
          renderWeeklyFrequencyChart();
        }
      });
      btnGoalPlus.addEventListener('click', async () => {
        if (nuclearGoal < 7) {
          nuclearGoal++;
          bodyGoals.nuclearSessionsWeekly = nuclearGoal;
          await putData(db, 'body_goals', bodyGoals);
          updateGoalText();
          renderWeeklyFrequencyChart();
        }
      });
    }

    let activeFamily = 'sentadilla';
    let strengthChartInstance = null;
    let weeklyChartInstance = null;
    let bodyChartInstance = null;

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
    // GRÁFICO 1: SOBRECARGA EN FUERZA POR PATRÓN (ADAPTATIVO)
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
          let totalReps = 0;
          let totalSeconds = 0;
          let maxWeight = 0;
          let roundsCount = 0;
          const seriesDetail = [];

          matchEntries.forEach(e => {
            if (e.status === 'skipped') return;
            roundsCount++;
            const entryWeight = Number.isFinite(Number(e.weightKg)) ? Number(e.weightKg) : 0;
            if (entryWeight > maxWeight) maxWeight = entryWeight;

            if (e.unit === 'seconds' || e.mode === 'time') {
              totalSeconds += (e.actualValue || 0);
              seriesDetail.push(`${e.actualValue || 0}s`);
            } else {
              totalReps += (e.actualValue || 0);
              seriesDetail.push(`${e.actualValue || 0}r`);
            }
          });

          entriesByDate.push({
            date: dateStr,
            fullDate: new Date(log.date),
            reps: totalReps,
            seconds: totalSeconds,
            weight: maxWeight,
            rounds: roundsCount,
            seriesDetail
          });
        }
      });

      entriesByDate.sort((a, b) => a.fullDate - b.fullDate);

      // Resumen numérico
      const summaryContainer = container.querySelector('#strength-family-summary');
      const badgeContainer = container.querySelector('#strength-family-badge');
      const maxWeightEver = entriesByDate.reduce((max, e) => Math.max(max, e.weight), 0);
      const totalRepsEver = entriesByDate.reduce((sum, e) => sum + e.reps, 0);
      const totalSecondsEver = entriesByDate.reduce((sum, e) => sum + e.seconds, 0);

      let volumeSummaryText = '';
      if (familyKey === 'core') {
        const parts = [];
        if (totalRepsEver > 0) parts.push(`${totalRepsEver} reps`);
        if (totalSecondsEver > 0) parts.push(`${totalSecondsEver}s isométrico`);
        volumeSummaryText = parts.join(' · ') || '0 reps';
      } else {
        volumeSummaryText = `${totalRepsEver} ${familyConfig.unitLabel}`;
      }

      if (badgeContainer) {
        badgeContainer.textContent = maxWeightEver > 0
          ? `SOBRECARGA EXTERNA (+${maxWeightEver} KG)`
          : 'PESO CORPORAL (CALISTENIA)';
      }

      summaryContainer.className = 'progress-metrics-row';
      summaryContainer.innerHTML = `
        <div class="progress-metric-col">
          <div class="progress-metric-sub">CARGA MÁXIMA</div>
          <div class="progress-metric-val ${maxWeightEver > 0 ? 'highlight' : ''}">
            ${maxWeightEver > 0 ? `${maxWeightEver} KG` : 'Peso Corporal'}
          </div>
        </div>
        <div class="progress-metric-col">
          <div class="progress-metric-sub">VOLUMEN TOTAL</div>
          <div class="progress-metric-val">${volumeSummaryText}</div>
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

      const datasets = [];

      // Si existe sobrecarga externa (> 0 kg), mostramos la barra de carga externa
      if (maxWeightEver > 0) {
        datasets.push({
          type: 'bar',
          label: 'Carga Externa (kg)',
          data: entriesByDate.map(e => e.weight),
          backgroundColor: '#10B981',
          borderRadius: 4,
          yAxisID: 'y1'
        });
      }

      // Dataset de volumen/repeticiones (línea limpia con puntos destacados)
      datasets.push({
        type: 'line',
        label: familyKey === 'core' ? 'Volumen (reps/seg)' : `Volumen (${familyConfig.unitLabel})`,
        data: entriesByDate.map(e => (familyKey === 'core' && e.reps === 0 ? e.seconds : e.reps)),
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.25,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        yAxisID: 'y'
      });

      const scalesConfig = {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } }
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } },
          title: {
            display: true,
            text: familyKey === 'core' ? 'Volumen' : 'Repeticiones',
            color: textColor,
            font: { size: 10 }
          }
        }
      };

      if (maxWeightEver > 0) {
        scalesConfig.y1 = {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#10B981', font: { family: 'Share Tech Mono', size: 10 }, stepSize: 2 },
          title: { display: true, text: 'Carga (kg)', color: '#10B981', font: { size: 10 } },
          min: 0,
          suggestedMax: Math.max(10, Math.ceil(maxWeightEver * 1.3))
        };
      }

      strengthChartInstance = new Chart(canvas, {
        data: {
          labels: entriesByDate.map(e => e.date),
          datasets
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            tooltip: {
              callbacks: {
                afterBody: (context) => {
                  const dataIndex = context[0]?.dataIndex;
                  const item = entriesByDate[dataIndex];
                  if (!item) return '';
                  const lines = [];
                  if (item.seriesDetail?.length) {
                    lines.push(`Series (${item.rounds}): ${item.seriesDetail.join(' · ')}`);
                  }
                  if (item.weight > 0) {
                    lines.push(`Sobrecarga: ${item.weight} kg`);
                  } else {
                    lines.push('Técnica: Peso corporal');
                  }
                  return lines;
                }
              }
            }
          },
          scales: scalesConfig
        }
      });
    }

    renderStrengthChart(activeFamily);

    // -------------------------------------------------------------
    // GRÁFICO 2: FRECUENCIA SEMANAL (BARRAS SEPARADAS + LÍNEA DE META)
    // -------------------------------------------------------------
    function renderWeeklyFrequencyChart() {
      const weeksMap = new Map();

      logs.forEach(log => {
        const d = new Date(log.date);
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
      if (weeklyChartInstance) {
        weeklyChartInstance.destroy();
      }

      const isDark = document.body.classList.contains('dark-theme');
      const textColor = isDark ? '#E8E6E3' : '#2E2B28';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

      const maxCompound = sortedWeeks.reduce((max, w) => Math.max(max, w[1].compound), 0);
      const maxActivations = sortedWeeks.reduce((max, w) => Math.max(max, w[1].activations), 0);
      const yMax = Math.max(nuclearGoal + 1, maxCompound + 1, maxActivations + 1);

      weeklyChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
          labels: sortedWeeks.map(w => {
            const isMet = w[1].compound >= nuclearGoal;
            return isMet ? `${w[0]} ✓` : w[0];
          }),
          datasets: [
            {
              type: 'bar',
              label: 'Sesiones Nucleares (45-60 min)',
              data: sortedWeeks.map(w => w[1].compound),
              backgroundColor: '#10B981',
              borderRadius: 4,
              order: 2
            },
            {
              type: 'bar',
              label: 'Activaciones Matutinas (5 min)',
              data: sortedWeeks.map(w => w[1].activations),
              backgroundColor: '#38BDF8',
              borderRadius: 4,
              order: 3
            },
            {
              type: 'line',
              label: `Meta (${nuclearGoal} nucleares/sem)`,
              data: sortedWeeks.map(() => nuclearGoal),
              borderColor: '#10B981',
              borderDash: [6, 6],
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 0,
              fill: false,
              order: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
            },
            tooltip: {
              callbacks: {
                footer: (items) => {
                  const index = items[0]?.dataIndex;
                  const week = sortedWeeks[index];
                  if (!week) return '';
                  const met = week[1].compound >= nuclearGoal;
                  return met
                    ? `✓ Objetivo semanal cumplido (${week[1].compound}/${nuclearGoal} nucleares)`
                    : `Objetivo: ${week[1].compound}/${nuclearGoal} nucleares`;
                }
              }
            }
          },
          scales: {
            x: {
              stacked: false,
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Share Tech Mono', size: 10 } }
            },
            y: {
              stacked: false,
              grid: { color: gridColor },
              min: 0,
              suggestedMax: yMax,
              ticks: { color: textColor, stepSize: 1, font: { family: 'Share Tech Mono', size: 10 } },
              title: { display: true, text: 'Sesiones Realizadas', color: textColor, font: { size: 10 } }
            }
          }
        }
      });
    }

    renderWeeklyFrequencyChart();

    // -------------------------------------------------------------
    // GRÁFICO 3: MÉTRICAS CORPORALES Y ESTADO DE VITALIDAD
    // -------------------------------------------------------------
    function renderBodyAndVitalityChart() {
      // 1. Vitalidad reportada
      let calmCount = 0;
      let vitalCount = 0;
      let fatiguedCount = 0;

      logs.forEach(l => {
        if (l.vitality === 'calm') calmCount++;
        if (l.vitality === 'vital') vitalCount++;
        if (l.vitality === 'fatigued') fatiguedCount++;
      });
      const totalVitalityReports = calmCount + vitalCount + fatiguedCount;

      const vitalityContainer = container.querySelector('#vitality-stats-container');
      vitalityContainer.className = 'progress-metrics-row';
      vitalityContainer.innerHTML = `
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: #38BDF8;">ESTADO: EN CALMA</span>
          <div class="progress-metric-val">🌿 ${calmCount} prácticas</div>
        </div>
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: #10B981;">ESTADO: VITAL</span>
          <div class="progress-metric-val">⚡ ${vitalCount} prácticas</div>
        </div>
        <div class="progress-metric-col">
          <span class="progress-metric-sub" style="color: var(--color-accent-red);">ESTADO: FATIGADA</span>
          <div class="progress-metric-val">⏳ ${fatiguedCount} prácticas</div>
        </div>
      `;

      if (totalVitalityReports === 0) {
        const hintEl = document.createElement('p');
        hintEl.style.cssText = 'font-size: 0.72rem; color: var(--color-text-muted); font-family: var(--font-digital); margin: -10px 0 16px 0; width: 100%;';
        hintEl.textContent = 'Las sensaciones energéticas se reportan al completar cada sesión (activaciones y sesiones compuestas).';
        vitalityContainer.appendChild(hintEl);
      }

      // 2. Antropometría: Hito y Delta hacia la meta
      const sortedMetrics = [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date));
      const targetWeight = Number(bodyGoals?.weight) || 58;
      const latestMetric = sortedMetrics.length > 0 ? sortedMetrics[sortedMetrics.length - 1] : null;
      const currentWeight = latestMetric?.weight != null ? Number(latestMetric.weight) : null;
      const delta = currentWeight != null ? (currentWeight - targetWeight).toFixed(1) : null;
      const waist = latestMetric?.waist != null ? `${latestMetric.waist} cm` : '—';

      const milestoneContainer = container.querySelector('#body-milestone-container');
      if (milestoneContainer) {
        milestoneContainer.innerHTML = `
          <div class="progress-milestone-banner">
            <div class="progress-milestone-item">
              <span class="progress-milestone-label">PESO REGISTRADO</span>
              <span class="progress-milestone-value">${currentWeight != null ? `${currentWeight} kg` : 'Sin registro'}</span>
            </div>
            <div class="progress-milestone-item">
              <span class="progress-milestone-label">META SALUDABLE</span>
              <span class="progress-milestone-value accent">${targetWeight} kg</span>
            </div>
            <div class="progress-milestone-item">
              <span class="progress-milestone-label">BRECHA / RESTANTE</span>
              <span class="progress-delta-pill">
                ${delta != null ? (delta > 0 ? `-${delta} kg por reducir` : (delta === 0 ? 'Meta alcanzada ✓' : `+${Math.abs(delta)} kg`)) : '—'}
              </span>
            </div>
            <div class="progress-milestone-item">
              <span class="progress-milestone-label">CINTURA ACTUAL</span>
              <span class="progress-milestone-value">${waist}</span>
            </div>
          </div>
        `;
      }

      // 3. Gráfico Antropometría
      const canvas = container.querySelector('#chart-body-correlation');
      if (bodyChartInstance) {
        bodyChartInstance.destroy();
      }

      if (sortedMetrics.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const isDark = document.body.classList.contains('dark-theme');
      const textColor = isDark ? '#E8E6E3' : '#2E2B28';
      const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

      const minWeightScale = Math.floor(Math.min(targetWeight - 2, currentWeight ? currentWeight - 3 : 55));
      const maxWeightScale = Math.ceil(Math.max(currentWeight ? currentWeight + 3 : 75, targetWeight + 4));

      bodyChartInstance = new Chart(canvas, {
        data: {
          labels: sortedMetrics.map(m => m.date),
          datasets: [
            {
              type: 'line',
              label: 'Peso (kg)',
              data: sortedMetrics.map(m => m.weight || null),
              borderColor: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              tension: 0.25,
              pointRadius: 6,
              pointHoverRadius: 8,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: `Meta (${targetWeight} kg)`,
              data: sortedMetrics.map(() => targetWeight),
              borderColor: '#10B981',
              borderDash: [6, 6],
              borderWidth: 1.5,
              pointRadius: 0,
              pointHoverRadius: 0,
              fill: false,
              yAxisID: 'y'
            },
            {
              type: 'line',
              label: 'Cintura (cm)',
              data: sortedMetrics.map(m => m.waist || null),
              borderColor: '#A78BFA',
              borderDash: [4, 4],
              tension: 0.25,
              pointRadius: 5,
              pointHoverRadius: 7,
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
            },
            tooltip: {
              callbacks: {
                afterBody: (items) => {
                  const idx = items[0]?.dataIndex;
                  const metric = sortedMetrics[idx];
                  if (!metric) return '';
                  const lines = [];
                  if (metric.notes) lines.push(`Nota: "${metric.notes.trim()}"`);
                  return lines;
                }
              }
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
              min: minWeightScale,
              max: maxWeightScale,
              ticks: { color: '#38BDF8', font: { family: 'Share Tech Mono', size: 10 }, stepSize: 2 },
              title: { display: true, text: 'Peso (kg)', color: '#38BDF8', font: { size: 10 } }
            },
            y1: {
              type: 'linear',
              position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#A78BFA', font: { family: 'Share Tech Mono', size: 10 }, stepSize: 2 },
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
