const DB_NAME = 'meridiano_db';
import { defaultAcupuncture } from './seeds/acupuncture_points_seed.js';
import { defaultMeridians } from './seeds/meridians_seed.js';
import { defaultPostures, defaultBlocks, defaultSequences } from './seeds/yoga_seeds.js';
import { defaultBreathwork } from './seeds/breathwork_seeds.js';
import { defaultMeditation } from './seeds/meditation_seeds.js';
import { defaultAcupunctureSequences } from './seeds/acupuncture_sequences_seed.js';

const DB_VERSION = 9;

/**
 * Abre la conexión a IndexedDB y crea las tablas/almacenes necesarios.
 * Retorna una promesa con la base de datos abierta.
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('[DB] Error opening database:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = (event) => {
      console.warn('[DB] Database upgrade blocked! Close other tabs.');
      alert('La actualización de la base de datos está bloqueada porque tienes otra pestaña de la aplicación abierta. Cierra las demás pestañas de MERIDIANO y recarga esta página.');
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      console.log(`[DB] Upgrading database stores from version ${oldVersion} to ${event.newVersion}...`);

      // 1. Posturas de Yoga (Yin Yoga)
      if (!db.objectStoreNames.contains('yoga_postures')) {
        db.createObjectStore('yoga_postures', { keyPath: 'id' });
      }

      // 2. Bloques de Yoga (secuencias cortas reutilizables, ej: Salutación al Sol)
      if (!db.objectStoreNames.contains('yoga_blocks')) {
        db.createObjectStore('yoga_blocks', { keyPath: 'id' });
      }

      // 3. Secuencias Completas de Yoga (que pueden contener posturas o bloques)
      if (!db.objectStoreNames.contains('yoga_sequences')) {
        db.createObjectStore('yoga_sequences', { keyPath: 'id' });
      }

      // 4. Módulo Meditación
      if (!db.objectStoreNames.contains('meditation_presets')) {
        db.createObjectStore('meditation_presets', { keyPath: 'id' });
      }

      // 5. Módulo Respiración (Breathwork)
      if (!db.objectStoreNames.contains('breathwork_patterns')) {
        db.createObjectStore('breathwork_patterns', { keyPath: 'id' });
      }

      // 6. Módulo Acupuntura (Puntos) con índice por meridiano
      let pointsStore;
      if (!db.objectStoreNames.contains('acupuncture_points')) {
        pointsStore = db.createObjectStore('acupuncture_points', { keyPath: 'id' });
      } else {
        pointsStore = event.target.transaction.objectStore('acupuncture_points');
      }
      if (!pointsStore.indexNames.contains('meridian_id')) {
        pointsStore.createIndex('meridian_id', 'meridian_id', { unique: false });
      }

      // 6b. Módulo Acupuntura (Secuencias)
      if (!db.objectStoreNames.contains('acupuncture_sequences')) {
        db.createObjectStore('acupuncture_sequences', { keyPath: 'id' });
      }

      // 7. Registro de Homeostasis (El Hilo de Agua)
      if (!db.objectStoreNames.contains('sessions_log')) {
        db.createObjectStore('sessions_log', { keyPath: 'id', autoIncrement: true });
      }

      // 8. Módulo Acupuntura (Meridianos Lookup)
      if (!db.objectStoreNames.contains('meridians')) {
        db.createObjectStore('meridians', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Llena la base de datos con datos semilla por defecto si está vacía.
 */
export async function seedDatabase() {
  const db = await openDB();

  console.log('[DB] Seeding default database items for Wabi-Sabi experience...');

  // 0. Sembrar Meridianos Lookup (MTC)
  const needsMeridiansReseed = await new Promise((resolve) => {
    const tx = db.transaction('meridians', 'readonly');
    const store = tx.objectStore('meridians');
    const req = store.get('CV');
    req.onsuccess = () => {
      const res = req.result;
      if (!res) {
        resolve(true);
      } else {
        resolve(!res.pinyin_code || !res.description);
      }
    };
    req.onerror = () => resolve(false);
  });

  if (needsMeridiansReseed) {
    console.log('[DB] Clearing old meridians to apply new fields (pinyin_code, description)...');
    const txClear = db.transaction('meridians', 'readwrite');
    txClear.objectStore('meridians').clear();
    await new Promise(r => txClear.oncomplete = r);
  }

  const meridiansCount = await countItems(db, 'meridians');
  if (meridiansCount === 0) {
    await saveBatch(db, 'meridians', defaultMeridians);
  }

  // 1. Sembrar Posturas Base de Yin Yoga
  const posturesCount = await countItems(db, 'yoga_postures');
  if (posturesCount === 0) {
    await saveBatch(db, 'yoga_postures', defaultPostures);
  }

  // 2. Sembrar Bloques (Sub-secuencias reutilizables)
  const blocksCount = await countItems(db, 'yoga_blocks');
  if (blocksCount === 0) {
    await saveBatch(db, 'yoga_blocks', defaultBlocks);
  }

  // 3. Sembrar Secuencia de Yoga Yin Completa (que mezcla posturas y bloques)
  const sequencesCount = await countItems(db, 'yoga_sequences');
  if (sequencesCount === 0) {
    await saveBatch(db, 'yoga_sequences', defaultSequences);
  }

  // 4. Sembrar Patrones de Breathwork
  const breathworkCount = await countItems(db, 'breathwork_patterns');
  if (breathworkCount === 0) {
    await saveBatch(db, 'breathwork_patterns', defaultBreathwork);
  }

  // 5. Sembrar Presets de Meditación (Binaural)
  const meditationCount = await countItems(db, 'meditation_presets');
  if (meditationCount === 0) {
    await saveBatch(db, 'meditation_presets', defaultMeditation);
  }

  // 6. Sembrar Puntos de Acupuntura TENS / Digitopuntura
  const needsReseed = await new Promise((resolve) => {
    const tx = db.transaction('acupuncture_points', 'readonly');
    const store = tx.objectStore('acupuncture_points');
    const req = store.get('acu-li4');
    req.onsuccess = () => {
      const res = req.result;
      if (!res) {
        resolve(true);
      } else {
        const hasNoMeridian = !res.meridian_id;
        const isCorrupt = res.location && res.location.includes("'");
        const hasNoTraditionalCode = !res.traditional_code;
        resolve(hasNoMeridian || isCorrupt || hasNoTraditionalCode);
      }
    };
    req.onerror = () => resolve(false);
  });

  if (needsReseed) {
    console.log('[DB] Clearing old acupuncture points to apply normalized WHO schema (Spanish corrected & traditional_code added)...');
    const txClearPoints = db.transaction('acupuncture_points', 'readwrite');
    txClearPoints.objectStore('acupuncture_points').clear();
    await new Promise(r => txClearPoints.oncomplete = r);
    
    const txClearSeq = db.transaction('acupuncture_sequences', 'readwrite');
    txClearSeq.objectStore('acupuncture_sequences').clear();
    await new Promise(r => txClearSeq.oncomplete = r);
  }

  const acupuncturePointsCount = await countItems(db, 'acupuncture_points');
  if (acupuncturePointsCount < 300) {
    console.log('[DB] Seeding full WHO acupuncture point database...');
    const txClear = db.transaction('acupuncture_points', 'readwrite');
    txClear.objectStore('acupuncture_points').clear();
    await new Promise(r => txClear.oncomplete = r);
    
    await saveBatch(db, 'acupuncture_points', defaultAcupuncture);
  }

  // 6b. Sembrar Secuencias de Acupuntura TENS (Presets)
  const acupunctureSequencesCount = await countItems(db, 'acupuncture_sequences');
  if (acupunctureSequencesCount === 0) {
    await saveBatch(db, 'acupuncture_sequences', defaultAcupunctureSequences);
  } else {
    // Para usuarios que ya tienen secuencias, eliminamos explícitamente los presets de masaje
    try {
      await deleteData(db, 'acupuncture_sequences', 'seq-cefaleas');
      await deleteData(db, 'acupuncture_sequences', 'seq-trapecios');
    } catch (e) {
      console.warn('[DB] Failed to delete obsolete massage presets:', e);
    }

    // Sobrescribir/actualizar siempre los presets oficiales con los datos semilla limpios y corregidos
    try {
      for (const preset of defaultAcupunctureSequences) {
        await putData(db, 'acupuncture_sequences', preset);
      }
      console.log('[DB] Default acupuncture sequences updated to latest seeds successfully.');
    } catch (e) {
      console.warn('[DB] Failed to update default acupuncture sequences:', e);
    }
  }

  // 7. Sembrar Historial de Homeostasis de Prueba (El Hilo de Agua) - Removido por requerimiento (no precargar sesiones)
}

/* =============================================================
   MÉTODOS HELPER PARA TRANSACCIONES
============================================================= */

export function countItems(db, storeName) {
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
  });
}

function saveBatch(db, storeName, items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    items.forEach(item => store.put(item));

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export function getAllData(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function getDataById(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function addData(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function putData(db, storeName, data) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export function deleteData(db, storeName, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Exporta toda la base de datos IndexedDB a un objeto JSON consolidado.
 */
export async function exportDatabase(db) {
  const stores = [
    'sessions_log',
    'yoga_postures',
    'yoga_blocks',
    'yoga_sequences',
    'meditation_presets',
    'breathwork_patterns',
    'acupuncture_points',
    'acupuncture_sequences',
    'meridians'
  ];

  const backup = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    preferences: {
      theme: localStorage.getItem('meridiano_theme') || 'dark',
      meridiano_session: localStorage.getItem('meridiano_session')
    },
    data: {}
  };

  for (const storeName of stores) {
    try {
      backup.data[storeName] = await getAllData(db, storeName);
    } catch (err) {
      console.warn(`[DB] Error al exportar la tabla ${storeName}:`, err);
      backup.data[storeName] = [];
    }
  }

  return backup;
}

/**
 * Importa los datos del respaldo realizando un merge con los datos locales de IndexedDB.
 */
export async function importDatabase(db, backup) {
  if (!backup || backup.version === undefined) {
    throw new Error('Formato de backup inválido: falta la versión.');
  }

  if (!backup.data) {
    throw new Error('Formato de backup inválido: no contiene la sección de datos.');
  }

  const results = {
    sessions_log: { imported: 0, skipped: 0 },
    yoga_postures: { imported: 0, overwritten: 0 },
    yoga_blocks: { imported: 0, overwritten: 0 },
    yoga_sequences: { imported: 0, overwritten: 0 },
    meditation_presets: { imported: 0, overwritten: 0 },
    breathwork_patterns: { imported: 0, overwritten: 0 },
    acupuncture_points: { imported: 0, overwritten: 0 },
    acupuncture_sequences: { imported: 0, overwritten: 0 },
    meridians: { imported: 0, overwritten: 0 }
  };

  const stores = Object.keys(backup.data);

  for (const storeName of stores) {
    const items = backup.data[storeName] || [];
    if (storeName === 'sessions_log') {
      // Evitar duplicados por date + type
      const currentSessions = await getAllData(db, 'sessions_log');
      const sessionKeys = new Set(currentSessions.map(s => `${s.date}_${s.type}`));

      for (const item of items) {
        const cleanItem = { ...item };
        delete cleanItem.id;

        const itemKey = `${cleanItem.date}_${cleanItem.type}`;
        if (sessionKeys.has(itemKey)) {
          results.sessions_log.skipped++;
        } else {
          await addData(db, 'sessions_log', cleanItem);
          results.sessions_log.imported++;
          sessionKeys.add(itemKey);
        }
      }
    } else if (results[storeName]) {
      // Upsert para el resto
      const currentItems = await getAllData(db, storeName);
      const currentIds = new Set(currentItems.map(i => i.id));

      for (const item of items) {
        if (item.id === undefined) continue;
        await putData(db, storeName, item);
        if (currentIds.has(item.id)) {
          results[storeName].overwritten++;
        } else {
          results[storeName].imported++;
        }
      }
    }
  }

  // Cargar preferencias si existen
  if (backup.preferences) {
    if (backup.preferences.theme) {
      localStorage.setItem('meridiano_theme', backup.preferences.theme);
      if (backup.preferences.theme === 'dark') {
        document.body.classList.add('dark-theme');
      } else {
        document.body.classList.remove('dark-theme');
      }
    }
    if (backup.preferences.meridiano_session) {
      localStorage.setItem('meridiano_session', backup.preferences.meridiano_session);
    }
  }

  return results;
}

