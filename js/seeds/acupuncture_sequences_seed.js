export const defaultAcupunctureSequences = [
  {
    id: 'seq-desbloqueo',
    name: 'Relajación y Desbloqueo (12 min)',
    description: 'Secuencia lógica para liberar nudos abdominales, abrir el pecho y drenar flemas y tensión.',
    suggestedFreq: 6, // Theta
    baseFreq: 432,
    points: [
      { pointId: 'acu-cv17', duration: 120, transitionAfter: 15, side: null },
      { pointId: 'acu-cv12', duration: 120, transitionAfter: 15, side: null },
      { pointId: 'acu-st40', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-st40', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-lr3', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-lr3', duration: 120, transitionAfter: 0, side: 'Derecha' }
    ]
  },
  {
    id: 'seq-calmar-mente',
    name: 'Calmar la Mente y Conciliar el Sueño',
    description: 'Sesión de inducción al sueño y detención de pensamientos recurrentes.',
    suggestedFreq: 2.5, // Delta
    baseFreq: 432,
    points: [
      { pointId: 'acu-yintang', duration: 300, transitionAfter: 15, side: null },
      { pointId: 'acu-pc6', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-pc6', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-ht7', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-ht7', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-sishencong', duration: 180, transitionAfter: 0, side: null }
    ]
  },
  {
    id: 'seq-metabolica',
    name: 'Eje A: Rutina Metabólica y Drenaje',
    description: 'Fortalece el Bazo y el Estómago, drenando líquidos y eliminando Humedad corporal.',
    suggestedFreq: 7.83, // Schumann
    baseFreq: 432,
    points: [
      { pointId: 'acu-st40', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-st40', duration: 180, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-st36', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-st36', duration: 180, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-sp9', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-sp9', duration: 180, transitionAfter: 0, side: 'Derecha' }
    ]
  },
  {
    id: 'seq-rescate',
    name: 'Eje B: Rutina de Rescate (Abstinencia)',
    description: 'Rutina de calma inmediata para crisis de ansiedad, antojos o deseos de fumar.',
    suggestedFreq: 6, // Theta
    baseFreq: 432,
    points: [
      { pointId: 'acu-yintang', duration: 120, transitionAfter: 15, side: null },
      { pointId: 'acu-pc6', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-pc6', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-ht7', duration: 60, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-ht7', duration: 60, transitionAfter: 0, side: 'Derecha' }
    ]
  },
  {
    id: 'seq-acu-miercoles',
    name: 'Enfoque Metabólico y Relajación Mental',
    description: 'Activa digestión (peso), calma la mente (ansiedad) y suelta la musculatura del hombro.',
    suggestedFreq: 6, // Theta
    baseFreq: 432,
    points: [
      { pointId: 'acu-st36', duration: 90, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-st36', duration: 90, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-yintang', duration: 180, transitionAfter: 15, side: null },
      { pointId: 'acu-gb21', duration: 240, transitionAfter: 0, side: 'Derecha' }
    ]
  },
  {
    id: 'seq-acu-domingo',
    name: 'Desintoxicación y Articulación',
    description: 'Limpia canales, controla ansiedad oral y trabaja el manguito rotador.',
    suggestedFreq: 7.83, // Schumann
    baseFreq: 432,
    points: [
      { pointId: 'acu-li4', duration: 90, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-li4', duration: 90, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-pc6', duration: 90, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-pc6', duration: 90, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-li15', duration: 240, transitionAfter: 0, side: 'Derecha' }
    ]
  }
];
