export const defaultAcupunctureSequences = [
  {
    id: 'seq-desbloqueo',
    name: 'Relajación y Desbloqueo (12 min)',
    description: 'Secuencia lógica para liberar nudos abdominales, abrir el pecho y drenar flemas y tensión.',
    suggestedFreq: 6, // Theta
    baseFreq: 432,
    points: [
      { pointId: 'acu-ren17', duration: 120, transitionAfter: 15, side: null },
      { pointId: 'acu-ren12', duration: 120, transitionAfter: 15, side: null },
      { pointId: 'acu-fenglong', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-fenglong', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-taichong', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-taichong', duration: 120, transitionAfter: 0, side: 'Derecha' }
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
      { pointId: 'acu-neiguan', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-neiguan', duration: 120, transitionAfter: 15, side: 'Derecha' },
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
      { pointId: 'acu-fenglong', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-fenglong', duration: 180, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-zusanli', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-zusanli', duration: 180, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-yinlingquan', duration: 180, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-yinlingquan', duration: 180, transitionAfter: 0, side: 'Derecha' }
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
      { pointId: 'acu-neiguan', duration: 120, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-neiguan', duration: 120, transitionAfter: 15, side: 'Derecha' },
      { pointId: 'acu-shenmen-oreja', duration: 60, transitionAfter: 15, side: 'Izquierda' },
      { pointId: 'acu-shenmen-oreja', duration: 60, transitionAfter: 0, side: 'Derecha' }
    ]
  }
];
