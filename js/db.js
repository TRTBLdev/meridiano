import { defaultAcupuncture } from './seeds/acupuncture_points_seed.js';
import { defaultMeridians } from './seeds/meridians_seed.js';

const DB_NAME = 'meridiano_db';
const DB_VERSION = 12;

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

      // 9. Módulo Fuerza/Calistenia (Ejercicios)
      if (!db.objectStoreNames.contains('strength_exercises')) {
        db.createObjectStore('strength_exercises', { keyPath: 'id' });
      }

      // 10. Módulo Fuerza/Calistenia (Circuitos)
      if (!db.objectStoreNames.contains('strength_circuits')) {
        db.createObjectStore('strength_circuits', { keyPath: 'id' });
      }

      // 11. Módulo Sesiones Compuestas
      if (!db.objectStoreNames.contains('compound_sessions')) {
        db.createObjectStore('compound_sessions', { keyPath: 'id' });
      }

      // 12. Módulo Seguimiento Corporal (Métricas)
      if (!db.objectStoreNames.contains('body_metrics')) {
        const metricsStore = db.createObjectStore('body_metrics', { keyPath: 'id', autoIncrement: true });
        metricsStore.createIndex('by_date', 'date', { unique: false });
      }

      // 12b. Módulo Seguimiento Corporal (Metas)
      if (!db.objectStoreNames.contains('body_goals')) {
        db.createObjectStore('body_goals', { keyPath: 'id' });
      }
    };
  });
}

/**
 * Llena la base de datos con los datos anatómicos esenciales (Puntos OMS y Meridianos MTC).
 * Las rutinas, secuencias y circuitos permanecen limpios para ser cargados o creados por el usuario.
 */
export async function seedDatabase() {
  const db = await openDB();

  console.log('[DB] Verificando catálogo anatómico esencial (Puntos OMS y Meridianos)...');

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
    console.log('[DB] Sincronizando catálogo de meridianos...');
    const txClear = db.transaction('meridians', 'readwrite');
    txClear.objectStore('meridians').clear();
    await new Promise(r => txClear.oncomplete = r);
  }

  const meridiansCount = await countItems(db, 'meridians');
  if (meridiansCount === 0) {
    await saveBatch(db, 'meridians', defaultMeridians);
  }

  // 1. Sembrar Puntos de Acupuntura OMS (Catálogo enciclopédico de 361 puntos)
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
    console.log('[DB] Sincronizando catálogo de 361 puntos de acupuntura OMS...');
    const txClearPoints = db.transaction('acupuncture_points', 'readwrite');
    txClearPoints.objectStore('acupuncture_points').clear();
    await new Promise(r => txClearPoints.oncomplete = r);
  }

  const acupuncturePointsCount = await countItems(db, 'acupuncture_points');
  if (acupuncturePointsCount < 300) {
    console.log('[DB] Sembrando catálogo completo de puntos OMS...');
    const txClear = db.transaction('acupuncture_points', 'readwrite');
    txClear.objectStore('acupuncture_points').clear();
    await new Promise(r => txClear.oncomplete = r);
    
    await saveBatch(db, 'acupuncture_points', defaultAcupuncture);
  }

  // 2. Limpieza transparente de ejercicios duplicados hardcoded de 5kg
  await cleanupDuplicate5kgExercises(db);
}

/**
 * Elimina cualquier ejercicio residual duplicado con sufijo '-5kg' y reconecta
 * los circuitos existentes al ejercicio base con weightOverride: 5.
 */
export async function cleanupDuplicate5kgExercises(db) {
  try {
    const duplicateMap = {
      'str-sentadilla-pelota-5kg': 'str-sentadilla-pelota',
      'str-puente-gluteos-5kg': 'str-puente-gluteos',
      'str-bisagra-cadera-5kg': 'str-bisagra-cadera'
    };

    for (const dupId of Object.keys(duplicateMap)) {
      await deleteData(db, 'strength_exercises', dupId);
    }

    const circuits = await getAllData(db, 'strength_circuits');
    for (const circuit of circuits) {
      if (Array.isArray(circuit.exercises)) {
        let modified = false;
        circuit.exercises.forEach(entry => {
          if (duplicateMap[entry.exerciseId]) {
            entry.exerciseId = duplicateMap[entry.exerciseId];
            entry.weightOverride = 5;
            modified = true;
          }
        });
        if (modified) {
          await putData(db, 'strength_circuits', circuit);
        }
      }
    }
  } catch (err) {
    console.warn('[DB] Error during cleanupDuplicate5kgExercises:', err);
  }
}

/* =============================================================
   MÉTODOS HELPER PARA TRANSACCIONES Y RESPALDOS
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

export function clearStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteStrengthExerciseAndDetach(db, exerciseId) {
  await deleteData(db, 'strength_exercises', exerciseId);
  const circuits = await getAllData(db, 'strength_circuits');
  let affectedCircuits = 0;
  for (const circuit of circuits) {
    if (Array.isArray(circuit.exercises)) {
      const originalCount = circuit.exercises.length;
      circuit.exercises = circuit.exercises.filter(e => e.exerciseId !== exerciseId);
      if (circuit.exercises.length !== originalCount) {
        affectedCircuits++;
        await putData(db, 'strength_circuits', circuit);
      }
    }
  }
  return { affectedCircuits };
}

export async function deleteStrengthCircuitAndDetach(db, circuitId) {
  await deleteData(db, 'strength_circuits', circuitId);
  const compoundSessions = await getAllData(db, 'compound_sessions');
  let affectedSessions = 0;
  for (const session of compoundSessions) {
    if (Array.isArray(session.blocks)) {
      const originalCount = session.blocks.length;
      session.blocks = session.blocks.filter(b => !(b.module === 'strength' && b.presetId === circuitId));
      if (session.blocks.length !== originalCount) {
        affectedSessions++;
        await putData(db, 'compound_sessions', session);
      }
    }
  }
  return { affectedSessions };
}

export async function exportDatabase(db, mode = 'all') {
  const allStoreNames = Array.from(db.objectStoreNames);
  let targetStores = [];

  if (mode === 'history') {
    // Historial de prácticas y métricas/metas corporales
    targetStores = allStoreNames.filter(s => ['sessions_log', 'body_metrics', 'body_goals'].includes(s));
  } else if (mode === 'content') {
    // Contenido personalizado (rutinas, secuencias, circuitos, ejercicios, etc.) sin historial
    targetStores = allStoreNames.filter(s => !['sessions_log', 'body_metrics', 'body_goals'].includes(s));
  } else {
    targetStores = allStoreNames;
  }

  const exportData = {
    version: DB_VERSION,
    exportDate: new Date().toISOString(),
    mode,
    stores: {}
  };

  for (const storeName of targetStores) {
    exportData.stores[storeName] = await getAllData(db, storeName);
  }

  return exportData;
}

export async function importDatabase(db, backup) {
  if (!backup || typeof backup !== 'object' || !backup.stores) {
    throw new Error('Formato de archivo JSON inválido. Debe contener una estructura de base de datos válida.');
  }

  const results = {};

  for (const [storeName, items] of Object.entries(backup.stores)) {
    if (!db.objectStoreNames.contains(storeName)) {
      continue;
    }

    let imported = 0;
    let overwritten = 0;
    let skipped = 0;

    const existingItems = await getAllData(db, storeName);
    const existingMap = new Map();
    
    const keyPath = storeName === 'sessions_log' ? 'id' : 'id';
    existingItems.forEach(item => {
      if (item && item[keyPath] !== undefined) {
        existingMap.set(String(item[keyPath]), item);
      }
    });

    for (const item of items) {
      if (!item) continue;
      const itemId = item[keyPath] !== undefined ? String(item[keyPath]) : null;
      
      if (itemId !== null && existingMap.has(itemId)) {
        const existing = existingMap.get(itemId);
        if (JSON.stringify(existing) === JSON.stringify(item)) {
          skipped++;
        } else {
          await putData(db, storeName, item);
          overwritten++;
        }
      } else {
        await putData(db, storeName, item);
        imported++;
      }
    }

    results[storeName] = { imported, overwritten, skipped };
  }

  return results;
}



