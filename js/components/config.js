import { exportDatabase, importDatabase, countItems, seedDatabase } from '../db.js';
import { escapeHTML } from '../utils/sanitize.js';

/**
 * Renderiza la interfaz de Configuración y Ajustes (respaldo y restauración de base de datos).
 * 
 * @param {HTMLElement} container Contenedor de montaje
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Función para navegar o cerrar sesión
 */
export async function renderConfigScreen(container, db, onNavigate) {
  const layout = document.createElement('div');
  layout.className = 'dashboard-layout fade-in';

  const stores = [
    { id: 'sessions_log', label: 'Historial de Prácticas' },
    { id: 'yoga_sequences', label: 'Secuencias de Yoga' },
    { id: 'yoga_blocks', label: 'Bloques de Secuencia (Yoga)' },
    { id: 'yoga_postures', label: 'Asanas de Yin Yoga' },
    { id: 'breathwork_patterns', label: 'Técnicas de Respiración' },
    { id: 'acupuncture_sequences', label: 'Secuencias de Acupuntura' },
    { id: 'acupuncture_points', label: 'Puntos de Acupuntura' },
    { id: 'meditation_presets', label: 'Presets de Meditación' },
    { id: 'meridians', label: 'Canales de Meridianos' }
  ];

  // Renderizar esqueleto principal
  layout.innerHTML = `
    <!-- Barra de Navegación Lateral Fija (Responsiva) -->
    <nav class="nav-bar">
      <div class="nav-logo dot-digital">M.</div>
      <ul class="nav-links">
        <li class="nav-item" id="btn-back-home" style="cursor: pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Volver</span>
        </li>
      </ul>
    </nav>

    <!-- Contenido Principal -->
    <main class="main-viewport">
      <div class="viewport-inner">
        <div class="acu-lobby-container">
          <header class="acu-lobby-header" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 32px;">
            <h2 class="acu-lobby-title" style="margin: 0; font-family: var(--font-ui); font-weight: 300; letter-spacing: 0.1em; text-transform: uppercase;">Ajustes del Sistema</h2>
            <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0; line-height: 1.4;">Gestione las copias de seguridad de sus datos locales y el estado del almacenamiento en el navegador.</p>
          </header>

          <div style="display: flex; flex-direction: column; gap: 24px;">
            
            <!-- Bloque 1: Estadísticas de la Base de Datos -->
            <section class="glass-panel" style="padding: 24px; border-radius: 0; border: 1px solid rgba(46, 43, 40, 0.08);">
              <h3 style="font-size: 0.85rem; font-family: var(--font-digital); text-transform: uppercase; margin-bottom: 16px; letter-spacing: 0.05em; color: var(--color-text-main);">
                [ 01 / ESTADO DEL SISTEMA LOCAL ]
              </h3>
              <div id="db-stats-container" style="display: flex; flex-direction: column; gap: 8px; font-family: var(--font-digital); font-size: 0.8rem; color: var(--color-text-muted);">
                Cargando métricas de la base de datos...
              </div>
            </section>

            <!-- Bloque 2: Importar / Exportar Datos -->
            <section class="glass-panel" style="padding: 24px; border-radius: 0; border: 1px solid rgba(46, 43, 40, 0.08); display: flex; flex-direction: column; gap: 24px;">
              
              <div>
                <h3 style="font-size: 0.85rem; font-family: var(--font-digital); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; color: var(--color-text-main);">
                  [ 02 / EXPORTAR RESPALDO ]
                </h3>
                <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 16px; line-height: 1.4;">
                  Descargue una copia completa de sus datos locales (historial de prácticas, secuencias personalizadas y presets) en un archivo consolidado en formato .json.
                </p>
                <button id="btn-export-db" class="btn-braun-tab active" style="font-family: var(--font-digital); text-transform: uppercase; padding: 8px 16px; cursor: pointer; border-radius: 0;">
                  Descargar Copia (.json)
                </button>
              </div>

              <div style="border-top: 1px dashed rgba(46, 43, 40, 0.08); padding-top: 24px;">
                <h3 style="font-size: 0.85rem; font-family: var(--font-digital); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; color: var(--color-text-main);">
                  [ 03 / IMPORTAR RESPALDO ]
                </h3>
                <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 16px; line-height: 1.4;">
                  Seleccione un archivo de copia de seguridad previo en formato .json. Los datos importados se fusionarán con la base de datos local actual. Los registros de sesiones repetidos en la misma fecha y tipo serán omitidos automáticamente para evitar duplicaciones.
                </p>
                
                <label class="btn-braun-tab active" style="display: inline-block; font-family: var(--font-digital); text-transform: uppercase; padding: 8px 16px; cursor: pointer; border-radius: 0; text-align: center;">
                  Cargar Copia (.json)
                  <input type="file" id="file-import-db" accept=".json" style="display: none;" />
                </label>
              </div>

            </section>

            <!-- Bloque 3: Restablecimiento de Fábrica -->
            <section class="glass-panel" style="padding: 24px; border-radius: 0; border: 1px solid rgba(46, 43, 40, 0.08);">
              <h3 style="font-size: 0.85rem; font-family: var(--font-digital); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.05em; color: var(--color-accent-red);">
                [ 04 / ZONA DE RESTABLECIMIENTO ]
              </h3>
              <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 16px; line-height: 1.4;">
                Elimine de forma irreversible toda la información guardada localmente (incluyendo su historial completo de homeóstasis y secuencias personalizadas) y restablezca la base de datos a sus valores iniciales por defecto.
              </p>
              <button id="btn-reset-db" style="background: none; border: 1px solid var(--color-accent-red); color: var(--color-accent-red); font-family: var(--font-digital); text-transform: uppercase; padding: 8px 16px; cursor: pointer; transition: all 0.2s ease; border-radius: 0;">
                Restablecer de Fábrica
              </button>
            </section>

          </div>
        </div>
      </div>
    </main>
  `;

  // Limpiar contenedor y montar la vista
  container.innerHTML = '';
  container.appendChild(layout);

  // Cargar y mostrar estadísticas de IndexedDB
  async function loadDBStats() {
    const statsContainer = layout.querySelector('#db-stats-container');
    if (!statsContainer) return;

    try {
      let statsHTML = '<div style="display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 450px;">';
      
      for (const store of stores) {
        let count = 0;
        try {
          count = await countItems(db, store.id);
        } catch (e) {
          console.warn(`[Config] No se pudo contar la tabla ${store.id}:`, e);
        }
        
        // Estilo técnico estilo monitor de hardware Braun
        statsHTML += `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px dotted rgba(46, 43, 40, 0.08); padding-bottom: 2px;">
            <span style="text-transform: uppercase; font-family: var(--font-digital); font-size: 0.75rem;">${escapeHTML(store.label)}</span>
            <span style="font-weight: bold; color: var(--color-text-main); font-family: var(--font-digital); font-size: 0.75rem;">${count}</span>
          </div>
        `;
      }
      
      statsHTML += '</div>';
      statsContainer.innerHTML = statsHTML;
    } catch (err) {
      console.error(err);
      statsContainer.innerHTML = 'Error al calcular las métricas locales.';
    }
  }

  // Cargar estadísticas iniciales
  await loadDBStats();

  // Asignar manejadores de eventos
  
  // 1. Botón de Volver
  layout.querySelector('#btn-back-home').addEventListener('click', () => {
    onNavigate('inicio');
  });

  // 2. Exportación de base de datos
  layout.querySelector('#btn-export-db').addEventListener('click', async () => {
    try {
      const backup = await exportDatabase(db);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `meridiano_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      console.log('[Config] Base de datos exportada con éxito.');
    } catch (err) {
      console.error('[Config] Error al exportar:', err);
      alert('Ocurrió un error al intentar exportar la base de datos.');
    }
  });

  // 3. Importación de base de datos
  const fileInput = layout.querySelector('#file-import-db');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target.result);
        const results = await importDatabase(db, backup);
        
        // Estructurar un reporte amigable y técnico
        let report = 'Base de datos importada correctamente.\n\nResumen de cambios:\n';
        let changesMade = false;
        
        for (const [storeId, stats] of Object.entries(results)) {
          const storeDef = stores.find(s => s.id === storeId);
          const label = storeDef ? storeDef.label : storeId;
          
          if (stats.imported > 0 || stats.overwritten > 0 || stats.skipped > 0) {
            changesMade = true;
            report += `\n• ${label}:\n`;
            if (stats.imported > 0) report += `  - Nuevos: ${stats.imported}\n`;
            if (stats.overwritten > 0) report += `  - Actualizados: ${stats.overwritten}\n`;
            if (stats.skipped > 0) report += `  - Omitidos por duplicados: ${stats.skipped}\n`;
          }
        }
        
        if (!changesMade) {
          report += '\nNo se realizaron cambios (todos los datos eran idénticos).';
        }

        alert(report);
        
        // Limpiar input y recargar estadísticas de la vista
        fileInput.value = '';
        await loadDBStats();
      } catch (err) {
        console.error('[Config] Error al importar:', err);
        alert(`Error al procesar el archivo JSON: ${err.message}`);
        fileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // 4. Restablecimiento de Fábrica (con doble confirmación)
  layout.querySelector('#btn-reset-db').addEventListener('click', async () => {
    // Primera confirmación
    const firstConfirm = confirm('ADVERTENCIA CRÍTICA:\n\nEsta acción eliminará de forma irreversible todo tu historial de prácticas y secuencias personalizadas. Tu base de datos volverá al estado inicial de fábrica.\n\n¿Deseas continuar con el restablecimiento?');
    if (!firstConfirm) return;

    // Segunda confirmación de seguridad
    const secondConfirm = confirm('¿REALMENTE ESTÁS SEGURO?\n\nEsta acción no se puede deshacer y borrará permanentemente todo tu progreso guardado en este navegador.\n\nPresiona Aceptar para confirmar el borrado completo.');
    if (!secondConfirm) return;

    try {
      console.log('[Config] Iniciando restablecimiento de fábrica...');
      
      // Limpiar todas las tablas
      const storesToClear = stores.map(s => s.id);
      const tx = db.transaction(storesToClear, 'readwrite');
      storesToClear.forEach(storeId => {
        tx.objectStore(storeId).clear();
      });

      await new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
      });

      // Limpiar preferencias del localStorage
      localStorage.removeItem('meridiano_theme');
      document.body.classList.add('dark-theme'); // Volver a oscuro por defecto

      // Sembrar datos por defecto
      await seedDatabase();

      alert('El sistema ha sido restablecido a los valores de fábrica correctamente.');
      
      // Recargar estadísticas
      await loadDBStats();
    } catch (err) {
      console.error('[Config] Error al restablecer la base de datos:', err);
      alert(`Ocurrió un error al restablecer el sistema: ${err.message}`);
    }
  });
}
