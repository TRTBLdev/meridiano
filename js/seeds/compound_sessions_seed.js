export const defaultCompoundSessions = [
  {
    id: 'comp-miercoles',
    name: 'Sesión 1 - Miércoles',
    description: 'Rutina integral: Respiración (Qigong), Fuerza (Core y Piernas), Yin Yoga (Liberación Lumbar) y Acupuntura (Metabólica).',
    blocks: [
      {
        module: 'breathwork',
        presetId: 'breath-abdominal',
        duration: 300,
        nameOverride: 'Respiración Abdominal (Qigong)'
      },
      {
        module: 'strength',
        presetId: 'circuit-core-estabilidad',
        duration: 900,
        nameOverride: 'Fuerza: Centro, Estabilidad y Piernas'
      },
      {
        module: 'yoga',
        presetId: 'seq-yin-miercoles',
        duration: 900,
        nameOverride: 'Yin Yoga: Elemento Agua (Liberación Lumbar)'
      },
      {
        module: 'acupuncture',
        presetId: 'seq-acu-miercoles',
        duration: 600,
        nameOverride: 'Acupuntura: Enfoque Metabólico y Mental'
      }
    ]
  },
  {
    id: 'comp-domingo',
    name: 'Sesión 2 - Domingo',
    description: 'Rutina integral: Respiración, Fuerza (Postura y Espalda), Yin Yoga (Pecho y Hombro) y Acupuntura (Desintoxicación).',
    blocks: [
      {
        module: 'breathwork',
        presetId: 'breath-meridian',
        duration: 300,
        nameOverride: 'Respiración de Conexión de Meridianos'
      },
      {
        module: 'strength',
        presetId: 'circuit-postura-espalda',
        duration: 900,
        nameOverride: 'Fuerza: Postura, Espalda y Coordinación'
      },
      {
        module: 'yoga',
        presetId: 'seq-yin-domingo',
        duration: 900,
        nameOverride: 'Yin Yoga: Elemento Metal/Madera (Pecho)'
      },
      {
        module: 'acupuncture',
        presetId: 'seq-acu-domingo',
        duration: 600,
        nameOverride: 'Acupuntura: Desintoxicación y Articulación'
      }
    ]
  }
];
