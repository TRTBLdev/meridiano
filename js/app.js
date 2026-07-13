import { openDB, seedDatabase, addData } from './db.js';
import { renderLogin } from './components/login.js';
import { renderDashboard } from './components/dashboard.js';
import { renderDotMatrix } from './utils/dotmatrix.js';
import { renderAcupunctureScreen } from './components/acupuncture.js';
import { renderSyllabusScreen } from './components/syllabus.js';
import { renderBreathworkScreen } from './components/breathwork.js';
import { renderMeditationScreen } from './components/meditation.js';
import { renderYogaScreen } from './components/yoga.js';
import { renderConfigScreen } from './components/config.js';


// Estado global de la aplicación
const state = {
  db: null,
  session: null
};



// Contenedor principal de montaje
const appContainer = document.getElementById('app');

/**
 * Inicializa la aplicación, el Service Worker y el audio global.
 */
async function init() {
  console.log('[App] Inicializando MERIDIANO (Braun Look & Feel)...');
  registerServiceWorker();

  // Aplicar tema (oscuro por defecto)
  const savedTheme = localStorage.getItem('meridiano_theme');
  if (savedTheme !== 'light') {
    document.body.classList.add('dark-theme');
    if (!savedTheme) {
      localStorage.setItem('meridiano_theme', 'dark');
    }
  } else {
    document.body.classList.remove('dark-theme');
  }

  try {
    state.db = await openDB();
    await seedDatabase();
  } catch (error) {
    console.error('[App] Error al iniciar la base de datos:', error);
  }

  checkSession();
  navigate();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[PWA] Service Worker activo:', reg.scope))
        .catch((err) => console.error('[PWA] Error en Service Worker:', err));
    });
  }
}

function checkSession() {
  const sessionData = localStorage.getItem('meridiano_session');
  if (sessionData) {
    state.session = JSON.parse(sessionData);
  } else {
    state.session = null;
  }
}

function navigate() {
  if (!state.session) {
    renderLogin(appContainer, handleLoginSuccess);
  } else {
    // Renderizar dashboard
    renderDashboard(appContainer, state.session, state.db, handleNavigation);
  }
}

function handleLoginSuccess(session) {
  state.session = session;
  localStorage.setItem('meridiano_session', JSON.stringify(session));
  navigate();
}

function handleNavigation(target) {
  if (target === 'logout') {
    state.session = null;
    localStorage.removeItem('meridiano_session');
    navigate();
    return;
  }

  if (target === 'inicio') {
    navigate();
    return;
  }

  // Cargar pantallas de módulos específicos
  if (target === 'meditation') {
    renderMeditationScreen(appContainer, state.db, handleNavigation);
  } else if (target === 'acupuncture') {
    renderAcupunctureScreen(appContainer, state.db, handleNavigation);
  } else if (target === 'breathwork') {
    renderBreathworkScreen(appContainer, state.db, handleNavigation);
  } else if (target === 'yoga') {
    renderYogaScreen(appContainer, state.db, handleNavigation);

  } else if (target === 'syllabus') {
    renderSyllabusScreen(appContainer, state.db, handleNavigation);
  } else if (target === 'config') {
    renderConfigScreen(appContainer, state.db, handleNavigation);
  }
}

// Iniciar aplicación
init();
