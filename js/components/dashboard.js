import { getAllData, deleteData } from '../db.js';
import { escapeHTML, toSafeClassToken } from '../utils/sanitize.js';

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

  container.innerHTML = `
    <div class="dashboard-layout fade-in">
      <!-- 1. Barra de Navegación Lateral Fija -->
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item active" data-target="inicio">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            <span>Inicio</span>
          </li>
          <li class="nav-item" data-target="sound-tuner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="2" y1="14" x2="6" y2="14"></line>
              <line x1="10" y1="8" x2="14" y2="8"></line>
              <line x1="18" y1="16" x2="22" y2="16"></line>
            </svg>
            <span>Sonido</span>
          </li>
          <li class="nav-item" data-target="syllabus">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <span>Syllabus</span>
          </li>
          <li class="nav-item" id="btn-toggle-theme" title="Cambiar Tema (Modo Oscuro/Claro)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Tema</span>
          </li>
          <li class="nav-item" data-target="logout">
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
 
            </div>
          </section>

          <!-- Indicador visual de Scroll -->
          <div class="scroll-down-hint">
            <span class="scroll-down-text">DESLIZAR PARA VER HISTORIAL</span>
            <svg class="scroll-down-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
 
          <!-- 3. Panel de Historial Integrado en el Scroll Continuo -->
          <aside class="hilo-agua-panel">
            <h2 class="hilo-agua-title">Historial</h2>
            
            <!-- Calendario sin bordes -->
            <div class="calendar-section">
              <div id="calendar-grid-container" class="calendar-grid">
                <!-- Cargado dinámicamente -->
              </div>
            </div>
 
            <h2 class="hilo-agua-title">El Hilo de Agua</h2>
            <!-- Timeline Orbital SVG sin puntos -->
            <div class="hilo-agua-svg-area">
              <svg style="position: absolute; left: 0; top: 0; width: 30px; height: 100%; pointer-events: none; overflow: visible;">
                <path id="timeline-svg-curve" class="hilo-agua-path" d="" />
              </svg>
              
              <div id="timeline-nodes-list" class="timeline-list-container">
                <!-- Cargado dinámicamente -->
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  `;
 
  // Cargar datos de IndexedDB y renderizar calendario e Hilo de Agua
  await loadHistoryAndCalendar(db);
 
  // Listeners de navegación de la barra lateral
  const navItems = container.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (target === 'logout') {
        onNavigate('logout');
      } else if (target === 'sound-tuner') {
        const event = new CustomEvent('toggle-sound-tuner');
        window.dispatchEvent(event);
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

  // Listener para el menú hamburguesa que abre el sintonizador de sonido global
  const hamburgerBtn = container.querySelector('#btn-hamburger');
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const event = new CustomEvent('toggle-sound-tuner');
      window.dispatchEvent(event);
    });
  }
}

/**
 * Carga las sesiones de IndexedDB y dibuja el calendario estructurado y el Hilo de Agua orbital.
 */
async function loadHistoryAndCalendar(db) {
  const calendarContainer = document.getElementById('calendar-grid-container');
  const timelineNodes = document.getElementById('timeline-nodes-list');
  const svgCurve = document.getElementById('timeline-svg-curve');

  try {
    const logs = await getAllData(db, 'sessions_log');
    
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
      if (dayLogs.length > 0) {
        practiceClass = 'has-practice';
        const type = dayLogs[0].type;
        practiceClass += ` practice-${toSafeClassToken(type)}`;
      }

      calendarHTML += `
        <div class="calendar-day ${practiceClass}">
          <span class="calendar-day-num">${day}</span>
        </div>
      `;
    }

    calendarContainer.innerHTML = calendarHTML;

    // -------------------------------------------------------------
    // RENDER DEL HILO DE AGUA CRONOLÓGICO SIN PUNTOS
    // -------------------------------------------------------------
    if (logs.length === 0) {
      timelineNodes.innerHTML = `
        <div class="timeline-node-wrapper">
          <div class="node-date">HOY</div>
          <div class="node-content">◌ Flujo de integración en calma</div>
        </div>
      `;
      return;
    }

    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    let timelineHTML = '';
    logs.forEach(log => {
      const logDate = new Date(log.date);
      const dateString = logDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      
      let label = 'YOGA';
      if (log.type === 'breathwork') label = 'BREATH';
      if (log.type === 'acupuncture') label = 'ACU';
      if (log.type === 'meditation') label = 'MED';

      timelineHTML += `
        <div class="timeline-node-wrapper practice-${toSafeClassToken(log.type)}" data-id="${log.id}">
          <div class="node-date">${escapeHTML(dateString)}</div>
          <div class="node-content" style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
            <span>${escapeHTML(label)} / ${escapeHTML(log.details || 'Práctica')}</span>
            <button class="btn-delete-log" data-id="${log.id}" title="Eliminar registro" style="background: none; border: none; cursor: pointer; color: var(--color-text-muted); opacity: 0.4; padding: 4px; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s ease;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="node-desc">${escapeHTML(log.notes || '')} (${escapeHTML(log.duration)}m)</div>
        </div>
      `;
    });

    timelineNodes.innerHTML = timelineHTML;

    // Agregar listeners para eliminar registros
    timelineNodes.querySelectorAll('.btn-delete-log').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const logId = parseInt(btn.getAttribute('data-id'));
        if (confirm('¿Deseas eliminar este registro de práctica de tu historial?')) {
          try {
            await deleteData(db, 'sessions_log', logId);
            // Volver a cargar el historial y calendario
            await loadHistoryAndCalendar(db);
          } catch (err) {
            console.error('Error al eliminar registro:', err);
            alert('No se pudo eliminar el registro.');
          }
        }
      });
    });

    // Calcular y dibujar una línea recta vertical técnica en SVG
    requestAnimationFrame(() => {
      const height = timelineNodes.offsetHeight || 300;
      // Línea recta estilo Dieter Rams
      const d = `M 5,0 L 5,${height}`;
      svgCurve.setAttribute('d', d);
    });

  } catch (error) {
    console.error('[Dashboard] Error rendering history:', error);
    calendarContainer.innerHTML = 'Error al cargar calendario';
    timelineNodes.innerHTML = 'Error al cargar Hilo de Agua';
  }
}
