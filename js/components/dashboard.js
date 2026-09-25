import { getAllData, deleteData } from '../db.js';
import { escapeHTML, toSafeClassToken } from '../utils/sanitize.js';
import { formatDurationSeconds } from '../utils/sessionResults.js';
import { renderTechnicalTitle } from './ui.js';

const BIBLIOGRAPHY_QUOTES = [
  {
    text: "El Zen es la práctica de la anarquía (an-arche) en el sentido más estricto y súper ortodoxo. Rechaza todos los 'arches' o principios —fuentes supuestamente trascendentes de verdad y realidad, que en realidad no son más que ideas fijas, hábitos mentales y prejuicios que ayudan a crear la ilusión de dominar la realidad.",
    author: "Max Cafard",
    source: "Zen Anarchy (2006)"
  },
  {
    text: "El Zen nos ayuda a deshacernos del cúmulo de basura ideológica autoritaria que se junta automáticamente en nuestra mente normal y bien adaptada, de modo que nos volvemos libres para experimentar y apreciar el mundo, la naturaleza y las 'Diez Mil Cosas', las innumerables entidades que nos rodean...",
    author: "Max Cafard",
    source: "Zen Anarchy (2006)"
  },
  {
    text: "Si nos abrimos a experimentar verdaderamente a otros seres y a la naturaleza, podemos dejar de dominarlos y manipularlos, y comenzar a apreciarlos e incluso a amarlos.",
    author: "Max Cafard",
    source: "Zen Anarchy (2006)"
  }
];

/**
 * Renderiza la interfaz de Inicio (Dashboard Braun Minimalista Sin Cajas, scroll vertical único).
 * 
 * @param {HTMLElement} container Contenedor de montaje
 * @param {Object} session Datos de sesión del usuario ({ role })
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Función para navegar o cerrar sesión
 */
export async function renderDashboard(container, session, db, onNavigate) {
  // Seleccionar una cita bibliográfica aleatoria
  const quote = BIBLIOGRAPHY_QUOTES[Math.floor(Math.random() * BIBLIOGRAPHY_QUOTES.length)];

  const today = new Date();
  const options = { day: 'numeric', month: 'long' };
  const dateString = `HOY ${today.toLocaleDateString('es-ES', options).toUpperCase()}`;

  const isSidebarCollapsed = localStorage.getItem('meridiano_sidebar_collapsed') === 'true';

  container.innerHTML = `
    <div class="dashboard-layout fade-in ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}">
      <!-- 1. Barra de Navegación Lateral Fija -->
      <nav class="nav-bar">
        <div class="nav-header">
          <div class="nav-logo dot-digital">M.</div>
          <button id="btn-toggle-sidebar" class="nav-toggle-btn" title="Plegar / Desplegar barra de navegación">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        </div>
        <ul class="nav-links">
          <li class="nav-item active" data-target="inicio" title="Inicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Inicio</span>
          </li>

          <li class="nav-item" data-target="syllabus" title="Syllabus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Syllabus</span>
          </li>
          <li class="nav-item" data-target="config" title="Ajustes y Respaldo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Ajustes</span>
          </li>
          <li class="nav-item" id="btn-toggle-theme" title="Cambiar Tema (Modo Oscuro/Claro)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Tema</span>
          </li>
          <li class="nav-item" data-target="logout" title="Cerrar Sesión">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Cerrar</span>
          </li>
        </ul>
      </nav>
 
      <!-- 2. Contenido Principal Único (Scroll Continuo) -->
      <main class="main-viewport">
        <div class="viewport-inner">
          <!-- Cabecera ultra-limpia -->
          <header class="dashboard-header">
            <div class="date-badge">${dateString}</div>
          </header>
 
          <!-- Cita Centrada Formato Académico -->
          <div class="welcome-quote-center">
            <p class="quote-text">${escapeHTML(quote.text)}</p>
            <p class="quote-author">— ${escapeHTML(quote.author)}, <em>${escapeHTML(quote.source)}</em></p>
          </div>
 
          <!-- Módulos como Lista Vertical Sin Puntos y Espaciados -->
          <section style="width: 100%;">
            <div class="pilars-vertical-list">
              
              <div class="pilar-list-item sessions" data-module="sessions" style="font-weight: 600; color: var(--color-text-main);">
                <span>Sesiones Compuestas</span>
              </div>
              
              <div class="pilar-list-item yoga" data-module="yoga">
                <span>Yin Yoga</span>
              </div>
 
              <div class="pilar-list-item breathwork" data-module="breathwork">
                <span>Breathwork</span>
              </div>
 
              <div class="pilar-list-item acupuncture" data-module="acupuncture">
                <span>Acupuntura</span>
              </div>
 
              <div class="pilar-list-item meditation" data-module="meditation">
                <span>Meditación</span>
              </div>
 
              <div class="pilar-list-item strength" data-module="strength">
                <span>Fuerza</span>
              </div>
            </div>
          </section>

          <!-- Indicador visual de Scroll -->
          <div class="scroll-down-hint">
            <span class="scroll-down-text">DESLIZAR PARA VER HISTORIAL</span>
            <svg class="scroll-down-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <!-- Fila de Instrumentos de Medición Analógica: Progreso & Cuerpo -->
          <div class="monitoring-instruments-row">
            <!-- Instrumento: Progreso Integral -->
            <div id="progress-instrument-col" class="instrument-column" title="Ver análisis de progreso y sobrecarga">
              <div class="instrument-header">
                ${renderTechnicalTitle('Progreso', { className: 'instrument-title', style: 'margin: 0;' })}
                <span class="instrument-arrow">&rarr;</span>
              </div>
              <div class="instrument-body">
                <div id="progress-col-val" class="instrument-reading-value">0 / 2</div>
                <div class="instrument-reading-sub">SESIONES NUCLEARES</div>
                <div id="progress-col-desc" class="instrument-reading-desc">Fuerza · Hábitos · Vitalidad</div>
              </div>
            </div>

            <!-- Instrumento: Cuerpo -->
            <div id="body-instrument-col" class="instrument-column" title="Ver registro y métricas corporales">
              <div class="instrument-header">
                ${renderTechnicalTitle('Cuerpo', { className: 'instrument-title', style: 'margin: 0;' })}
                <span class="instrument-arrow">&rarr;</span>
              </div>
              <div class="instrument-body">
                <div id="body-card-weight" class="instrument-reading-value">—</div>
                <div class="instrument-reading-sub">
                  <span id="body-card-delta" class="body-card-delta"></span>
                  <span id="body-card-date" class="body-card-date"></span>
                </div>
                <div class="instrument-reading-desc">Registro métrico corporal</div>
              </div>
            </div>
          </div>

          <!-- 3. Panel de Historial Integrado en el Scroll Continuo -->
          <aside class="hilo-agua-panel">
            <!-- Acordeón 1: Calendario de Práctica -->
            <div id="header-accordion-calendar" class="section-accordion-header" title="Plegar / desplegar calendario">
              ${renderTechnicalTitle('Calendario', { className: 'hilo-agua-title', style: 'margin: 0;' })}
              <svg id="chevron-accordion-calendar" class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            
            <div id="calendar-accordion-content" class="accordion-content">
              <div class="calendar-section" style="margin-top: 16px; margin-bottom: 32px;">
                <div id="calendar-grid-container" class="calendar-grid">
                  <!-- Cargado dinámicamente -->
                </div>
              </div>
            </div>

            <!-- Acordeón 2: El Hilo de Agua -->
            <div id="header-accordion-timeline" class="section-accordion-header" style="margin-top: 24px;" title="Plegar / desplegar Hilo de Agua">
              ${renderTechnicalTitle('El Hilo de Agua', { className: 'hilo-agua-title', style: 'margin: 0;' })}
              <svg id="chevron-accordion-timeline" class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>

            <div id="timeline-accordion-content" class="accordion-content">
              <!-- Barra de Filtro Activo por Fecha (dinámica) -->
              <div id="timeline-filter-bar" class="timeline-filter-bar" style="display: none; margin-top: 12px;">
                <span id="timeline-filter-text">Filtrando por fecha</span>
                <button id="btn-clear-timeline-filter" class="timeline-clear-filter">✕ Quitar filtro</button>
              </div>

              <!-- El Hilo de Agua: Cinta Cronométrica Continua -->
              <div id="timeline-nodes-list" class="chronometric-stream">
                <!-- Cargado dinámicamente como Cinta Cronométrica Rams -->
              </div>

              <!-- Botón Ver Más Registros -->
              <button id="btn-timeline-load-more" class="timeline-load-more-btn" style="display: none;">
                Ver sesiones anteriores
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  `;
 
  // Cargar datos de IndexedDB y renderizar calendario e Hilo de Agua
  await loadHistoryAndCalendar(db, onNavigate);

  // Toggle de la Barra Lateral (Sidebar)
  const dashboardLayout = container.querySelector('.dashboard-layout');
  const btnToggleSidebar = container.querySelector('#btn-toggle-sidebar');
  if (btnToggleSidebar && dashboardLayout) {
    btnToggleSidebar.addEventListener('click', () => {
      const isCollapsed = dashboardLayout.classList.toggle('sidebar-collapsed');
      localStorage.setItem('meridiano_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    });
  }

  // Listeners de navegación de la barra lateral
  const navItems = container.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target === 'logout') {
        onNavigate('logout');
      } else if (target) {
        onNavigate(target);
      }
    });
  });

  // Listener para cambiar el tema (Modo Oscuro)
  const themeBtn = container.querySelector('#btn-toggle-theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('meridiano_theme', isDark ? 'dark' : 'light');
    });
  }

  // Listeners de click en lista de Pilares
  const modules = container.querySelectorAll('.pilar-list-item');
  modules.forEach(mod => {
    mod.addEventListener('click', () => {
      const moduleName = mod.getAttribute('data-module');
      onNavigate(moduleName);
    });
  });

  // Listeners para instrumentos de monitoreo analógico
  const progressCol = container.querySelector('#progress-instrument-col');
  if (progressCol) {
    progressCol.addEventListener('click', () => onNavigate('progress'));
  }

  const bodyCol = container.querySelector('#body-instrument-col');
  if (bodyCol) {
    bodyCol.addEventListener('click', () => onNavigate('body'));
  }

}

/**
 * Carga las sesiones de IndexedDB y dibuja el calendario estructurado y el Hilo de Agua orbital.
 */
async function loadHistoryAndCalendar(db, onNavigate) {
  const calendarContainer = document.getElementById('calendar-grid-container');
  const timelineNodes = document.getElementById('timeline-nodes-list');
  const filterBar = document.getElementById('timeline-filter-bar');
  const filterText = document.getElementById('timeline-filter-text');
  const btnClearFilter = document.getElementById('btn-clear-timeline-filter');
  const btnLoadMore = document.getElementById('btn-timeline-load-more');

  // Acordeón de Calendario
  const headerAccordionCalendar = document.getElementById('header-accordion-calendar');
  const chevronAccordionCalendar = document.getElementById('chevron-accordion-calendar');
  const calendarContent = document.getElementById('calendar-accordion-content');

  if (headerAccordionCalendar && calendarContent) {
    headerAccordionCalendar.addEventListener('click', () => {
      const isCollapsed = calendarContent.classList.toggle('collapsed');
      if (chevronAccordionCalendar) {
        chevronAccordionCalendar.classList.toggle('collapsed', isCollapsed);
      }
    });
  }

  // Acordeón de Hilo de Agua
  const headerAccordionTimeline = document.getElementById('header-accordion-timeline');
  const chevronAccordionTimeline = document.getElementById('chevron-accordion-timeline');
  const timelineContent = document.getElementById('timeline-accordion-content');

  if (headerAccordionTimeline && timelineContent) {
    headerAccordionTimeline.addEventListener('click', () => {
      const isCollapsed = timelineContent.classList.toggle('collapsed');
      if (chevronAccordionTimeline) {
        chevronAccordionTimeline.classList.toggle('collapsed', isCollapsed);
      }
    });
  }

  // Estado local para paginación y filtro
  let selectedFilterDate = null;
  let displayedLimit = 5;

  // Cargar datos de métricas corporales para el card rápido
  loadBodySummaryCard(db);

  try {
    const logs = await getAllData(db, 'sessions_log');
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // -------------------------------------------------------------
    // RENDER DEL CALENDARIO SIN BORDES
    // -------------------------------------------------------------
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const dayHeaders = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    let calendarHTML = dayHeaders.map(day => `<div class="calendar-header-day">${day}</div>`).join('');

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    for (let i = 0; i < startOffset; i++) {
      calendarHTML += `<div class="calendar-day other-month"></div>`;
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateToCheck = new Date(year, month, day);
      dateToCheck.setHours(0,0,0,0);

      const dayLogs = logs.filter(log => {
        const logDate = new Date(log.date);
        logDate.setHours(0,0,0,0);
        return logDate.getTime() === dateToCheck.getTime();
      });

      let practiceClass = '';
      let datasetAttr = '';
      if (dayLogs.length > 0) {
        practiceClass = 'has-practice';
        const type = dayLogs[0].type;
        practiceClass += ` practice-${toSafeClassToken(type)}`;
        datasetAttr = `data-date="${dateToCheck.toISOString()}" data-day="${day}"`;
      }

      calendarHTML += `
        <div class="calendar-day ${practiceClass}" ${datasetAttr} title="${dayLogs.length > 0 ? `${dayLogs.length} práctica(s)` : ''}">
          <span class="calendar-day-num">${day}</span>
        </div>
      `;
    }

    calendarContainer.innerHTML = calendarHTML;

    // Listener de clic en días con práctica para filtrar el Hilo de Agua
    calendarContainer.querySelectorAll('.calendar-day.has-practice').forEach(dayEl => {
      dayEl.addEventListener('click', () => {
        const dateIso = dayEl.getAttribute('data-date');
        const dayNum = dayEl.getAttribute('data-day');
        
        // Si ya estaba seleccionado, deseleccionar
        if (selectedFilterDate && new Date(selectedFilterDate).toDateString() === new Date(dateIso).toDateString()) {
          clearDateFilter();
          return;
        }

        // Marcar visualmente el día seleccionado
        calendarContainer.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected-day'));
        dayEl.classList.add('selected-day');

        selectedFilterDate = dateIso;
        filterText.textContent = `Sesiones del ${dayNum} de ${today.toLocaleDateString('es-ES', { month: 'long' })}`;
        filterBar.style.display = 'flex';
        renderTimeline();
      });
    });

    // Limpiar filtro
    function clearDateFilter() {
      selectedFilterDate = null;
      calendarContainer.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected-day'));
      filterBar.style.display = 'none';
      displayedLimit = 5;
      renderTimeline();
    }

    if (btnClearFilter) {
      btnClearFilter.addEventListener('click', clearDateFilter);
    }

    // Botón Ver Más
    if (btnLoadMore) {
      btnLoadMore.addEventListener('click', () => {
        displayedLimit += 5;
        renderTimeline();
      });
    }

    // Calcular sesiones de la semana actual para el indicador de Progreso (Sesiones Nucleares vs Activaciones)
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay() || 7; // 1 = Lunes, 7 = Domingo
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0,0,0,0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // Cargar meta semanal desde body_goals
    const bodyGoalsList = await getAllData(db, 'body_goals');
    const bodyGoals = (bodyGoalsList && bodyGoalsList.find(g => g.id === 'main')) || {};
    const nuclearGoal = Number.isInteger(bodyGoals.nuclearSessionsWeekly) ? bodyGoals.nuclearSessionsWeekly : 2;

    const currentWeekLogs = logs.filter(l => {
      const d = new Date(l.date);
      return d >= startOfWeek && d < endOfWeek;
    });

    const currentWeekNucleares = currentWeekLogs.filter(l => l.type === 'compound').length;
    const currentWeekActivaciones = currentWeekLogs.filter(l => l.type === 'strength' || l.notes?.includes('Activación')).length;

    const progressValEl = document.getElementById('progress-col-val');
    if (progressValEl) {
      progressValEl.textContent = `${currentWeekNucleares} / ${nuclearGoal}`;
    }
    const progressDescEl = document.getElementById('progress-col-desc');
    if (progressDescEl) {
      progressDescEl.textContent = currentWeekActivaciones > 0
        ? `+ ${currentWeekActivaciones} activación${currentWeekActivaciones > 1 ? 'es' : ''} matutina${currentWeekActivaciones > 1 ? 's' : ''}`
        : 'Fuerza · Hábitos · Vitalidad';
    }

    // -------------------------------------------------------------
    // RENDER DEL HILO DE AGUA: CINTA CRONOMÉTRICA CONTINUA (RAMS)
    // -------------------------------------------------------------
    function renderTimeline() {
      let filteredLogs = logs;
      if (selectedFilterDate) {
        const filterDayTime = new Date(selectedFilterDate);
        filterDayTime.setHours(0,0,0,0);
        filteredLogs = logs.filter(log => {
          const lDate = new Date(log.date);
          lDate.setHours(0,0,0,0);
          return lDate.getTime() === filterDayTime.getTime();
        });
      }

      if (filteredLogs.length === 0) {
        timelineNodes.innerHTML = `
          <div style="color: var(--color-text-muted); font-size: 0.85rem; padding: 20px 0; font-family: var(--font-digital);">
            ◌ No hay registros para la fecha seleccionada
          </div>
        `;
        if (btnLoadMore) btnLoadMore.style.display = 'none';
        return;
      }

      const visibleLogs = selectedFilterDate ? filteredLogs : filteredLogs.slice(0, displayedLimit);
      if (btnLoadMore) {
        btnLoadMore.style.display = (!selectedFilterDate && filteredLogs.length > displayedLimit) ? 'block' : 'none';
      }

      let timelineHTML = '';
      visibleLogs.forEach(log => {
        const logDate = new Date(log.date);
        const dateString = logDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();
        
        let label = 'YOGA';
        if (log.type === 'breathwork') label = 'BREATH';
        if (log.type === 'acupuncture') label = 'ACU';
        if (log.type === 'meditation') label = 'MED';
        if (log.type === 'strength') label = 'FUERZA';
        if (log.type === 'compound') label = 'INTEGRAL';

        let vitalityTag = '';
        if (log.vitality === 'vital') {
          vitalityTag = `<span style="font-size: 0.65rem; color: var(--color-accent-green); background: rgba(0,230,118,0.1); padding: 2px 6px; border-radius: 3px; font-family: var(--font-digital);">⚡ VITAL</span>`;
        } else if (log.vitality === 'calm') {
          vitalityTag = `<span style="font-size: 0.65rem; color: #29B6F6; background: rgba(41,182,246,0.1); padding: 2px 6px; border-radius: 3px; font-family: var(--font-digital);">🌿 CALMA</span>`;
        } else if (log.vitality === 'fatigued') {
          vitalityTag = `<span style="font-size: 0.65rem; color: var(--color-accent-red); background: rgba(239,83,80,0.1); padding: 2px 6px; border-radius: 3px; font-family: var(--font-digital);">⏳ FATIGA</span>`;
        }

        const durationSummary = log.activeDurationSeconds != null
          ? `${formatDurationSeconds(log.activeDurationSeconds)}`
          : `${escapeHTML(log.duration)}m`;

        const detailText = typeof log.details === 'string' ? log.details : 'Práctica';

        let compoundBlocksHtml = '';
        if (log.type === 'compound' && log.blocks && log.blocks.length > 0) {
          compoundBlocksHtml = `
            <button class="compound-accordion-toggle" data-log-id="${log.id}">
              <span>Desglose de bloques (${log.blocks.length})</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div id="compound-blocks-${log.id}" class="stream-blocks-detail">
              ${log.blocks.map(b => `
                <div style="margin-bottom: 6px; color: var(--color-text-muted); display: flex; justify-content: space-between; align-items: baseline; gap: 8px;">
                  <span>
                    <strong style="color: var(--color-text-main); font-family: var(--font-digital); font-size: 0.72rem;">[${escapeHTML(b.module.toUpperCase())}]</strong>
                    ${escapeHTML(b.name || '')}
                  </span>
                  <span style="font-family: var(--font-digital); font-size: 0.72rem; white-space: nowrap;">
                    ${formatDurationSeconds(b.actualDurationSeconds)} / ${formatDurationSeconds(b.plannedDurationSeconds)}
                  </span>
                </div>
              `).join('')}
            </div>
          `;
        }

        timelineHTML += `
          <div class="stream-entry" data-id="${log.id}">
            <span class="stream-led practice-${toSafeClassToken(log.type)}"></span>
            <div class="stream-header">
              <div class="stream-badge-row">
                <span class="stream-date">${escapeHTML(dateString)}</span>
                <span class="stream-tag">${escapeHTML(label)}</span>
              </div>
              <div class="stream-meta">
                <span class="stream-duration">${durationSummary}</span>
                ${vitalityTag}
                <button class="btn-delete-log" data-id="${log.id}" title="Eliminar registro" style="background: none; border: none; cursor: pointer; color: var(--color-text-muted); opacity: 0.4; padding: 2px 4px; display: inline-flex; align-items: center; justify-content: center; transition: opacity 0.2s ease;">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
            <div class="stream-title">${escapeHTML(detailText)}</div>
            ${log.notes ? `<div class="stream-notes">${escapeHTML(log.notes)}</div>` : ''}
            ${compoundBlocksHtml}
          </div>
        `;
      });

      timelineNodes.innerHTML = timelineHTML;

      // Listeners para acordeón de bloques de sesiones compuestas
      timelineNodes.querySelectorAll('.compound-accordion-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const logId = btn.getAttribute('data-log-id');
          const detailEl = document.getElementById(`compound-blocks-${logId}`);
          if (detailEl) {
            const isExpanded = detailEl.classList.toggle('expanded');
            btn.classList.toggle('expanded', isExpanded);
          }
        });
      });

      // Listeners para eliminar registros
      timelineNodes.querySelectorAll('.btn-delete-log').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const logId = parseInt(btn.getAttribute('data-id'));
          if (confirm('¿Deseas eliminar este registro de práctica de tu historial?')) {
            try {
              await deleteData(db, 'sessions_log', logId);
              await loadHistoryAndCalendar(db, onNavigate);
            } catch (err) {
              console.error('Error al eliminar registro:', err);
              alert('No se pudo eliminar el registro.');
            }
          }
        });
      });
    }

    // Primer renderizado del timeline
    renderTimeline();

  } catch (error) {
    console.error('[Dashboard] Error rendering history:', error);
    if (calendarContainer) calendarContainer.innerHTML = 'Error al cargar calendario';
    if (timelineNodes) timelineNodes.innerHTML = 'Error al cargar Hilo de Agua';
  }
}

/**
 * Carga las dos métricas corporales más recientes y actualiza el instrumento en el panel del Dashboard.
 */
async function loadBodySummaryCard(db) {
  const col = document.getElementById('body-instrument-col');
  if (!col) return;
  const weightEl = document.getElementById('body-card-weight');
  const deltaEl = document.getElementById('body-card-delta');
  const dateEl = document.getElementById('body-card-date');

  try {
    const records = await getAllData(db, 'body_metrics');
    if (!records || records.length === 0) {
      if (weightEl) weightEl.textContent = '—';
      if (deltaEl) deltaEl.textContent = '';
      if (dateEl) dateEl.textContent = 'Sin registros';
      return;
    }
    records.sort((a, b) => b.date.localeCompare(a.date));
    const latest = records[0];
    const prev = records[1] || null;

    if (weightEl) {
      weightEl.textContent = latest.weight != null ? `${latest.weight} KG` : '—';
    }

    if (deltaEl) {
      if (latest.weight != null && prev?.weight != null) {
        const diff = (latest.weight - prev.weight).toFixed(1);
        const sign = diff > 0 ? '+' : '';
        deltaEl.textContent = `${sign}${diff} KG`;
        deltaEl.className = 'body-card-delta ' + (diff > 0 ? 'delta-up' : diff < 0 ? 'delta-down' : 'delta-neutral');
      } else {
        deltaEl.textContent = '';
      }
    }

    if (dateEl) {
      dateEl.textContent = latest.date;
    }
  } catch (err) {
    console.error('[Dashboard] Error cargando instrumento de Cuerpo:', err);
  }
}
