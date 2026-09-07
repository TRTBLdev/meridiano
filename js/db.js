import { defaultAcupuncture } from './seeds/acupuncture_points_seed.js';
import { defaultMeridians } from './seeds/meridians_seed.js';
import { defaultPostures, defaultBlocks, defaultSequences } from './seeds/yoga_seeds.js';
import { defaultBreathwork } from './seeds/breathwork_seeds.js';
import { defaultMeditation } from './seeds/meditation_seeds.js';
import { defaultAcupunctureSequences } from './seeds/acupuncture_sequences_seed.js';
import { defaultStrengthExercises, defaultStrengthCircuits } from './seeds/strength_exercises_seed.js';
import { defaultCompoundSessions } from './seeds/compound_sessions_seed.js';

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
  }

  // 7. Sembrar Ejercicios de Fuerza
  const strengthExCount = await countItems(db, 'strength_exercises');
  if (strengthExCount === 0) {
    await saveBatch(db, 'strength_exercises', defaultStrengthExercises);
  }

  // 8. Sembrar Circuitos de Fuerza
  const strengthCircuitCount = await countItems(db, 'strength_circuits');
  if (strengthCircuitCount === 0) {
    await saveBatch(db, 'strength_circuits', defaultStrengthCircuits);
  }

  // Convertir prescripciones heredadas en valores explícitos dentro de bloques y circuitos.
  await normalizeYogaPrescriptions(db);
  await normalizeStrengthPrescriptions(db);

  // 9. Sembrar Sesiones Compuestas
  const compoundSessionCount = await countItems(db, 'compound_sessions');
  if (compoundSessionCount === 0) {
    await saveBatch(db, 'compound_sessions', defaultCompoundSessions);
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
    targetStores = ['sessions_log'];
  } else if (mode === 'content') {
    targetStores = allStoreNames.filter(s => s !== 'sessions_log');
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

async function normalizeYogaPrescriptions(db) {
  const blocks = await getAllData(db, 'yoga_blocks');
  for (const block of blocks) {
    let modified = false;
    const normalizedPostures = (block.postures || []).map(p => {
      if (typeof p.holdTime === 'undefined') {
        modified = true;
        return { postureId: p.postureId, holdTime: 180, side: p.side || null };
      }
      return p;
    });
    if (modified) {
      block.postures = normalizedPostures;
      await putData(db, 'yoga_blocks', block);
    }
  }
}

async function normalizeStrengthPrescriptions(db) {
  const circuits = await getAllData(db, 'strength_circuits');
  const exercises = await getAllData(db, 'strength_exercises');
  const exerciseMap = new Map(exercises.map(ex => [ex.id, ex]));

  for (const circuit of circuits) {
    let modified = false;
    const normalizedExercises = (circuit.exercises || []).map(entry => {
      const ex = exerciseMap.get(entry.exerciseId);
      const isTimeMode = ex && ex.mode === 'time';
      const isRepsUndefined = typeof entry.targetReps === 'undefined';
      const isSecondsUndefined = typeof entry.targetSeconds === 'undefined';

      if (isRepsUndefined && isSecondsUndefined) {
        modified = true;
        return {
          ...entry,
          targetReps: isTimeMode ? 0 : 10,
          targetSeconds: isTimeMode ? 30 : 0
        };
      }

      return {
        ...entry,
        targetReps: typeof entry.targetReps === 'number' ? entry.targetReps : (isTimeMode ? 0 : 10),
        targetSeconds: typeof entry.targetSeconds === 'number' ? entry.targetSeconds : (isTimeMode ? 30 : 0)
      };
    });

    if (modified) {
      circuit.exercises = normalizedExercises;
      await putData(db, 'strength_circuits', circuit);
    }
  }
}
