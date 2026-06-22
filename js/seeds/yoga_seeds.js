export const defaultPostures = [
  { id: 'yin-butterfly', name: 'Mariposa (Baddha Konasana)', description: 'Apertura suave de caderas y estiramiento de columna lumbar.', style: 'Yin', duration: 180 },
  { id: 'yin-sphinx', name: 'Esfinge (Salamba Bhujangasana)', description: 'Compresión terapéutica de la zona lumbar y apertura de pecho.', style: 'Yin', duration: 120 },
  { id: 'yin-caterpillar', name: 'Oruga (Paschimottanasana)', description: 'Estiramiento profundo de toda la cadena posterior y estimulación del sistema nervioso parasimpático.', style: 'Yin', duration: 240 },
  { id: 'yin-seal', name: 'Foca (Variación de Esfinge)', description: 'Extensión de columna más profunda, con brazos extendidos.', style: 'Yin', duration: 120 },
  { id: 'yin-child', name: 'Niño (Balasana)', description: 'Postura de descanso, introspección y estiramiento lumbar suave.', style: 'Yin', duration: 180 }
];

export const defaultBlocks = [
  {
    id: 'block-sun-salute-yin',
    name: 'Transición de la Tierra (Mini-bloque)',
    description: 'Secuencia fluida para movilizar la columna lumbar en reposo.',
    postures: [
      { postureId: 'yin-child', holdTime: 60 },
      { postureId: 'yin-sphinx', holdTime: 90 },
      { postureId: 'yin-child', holdTime: 60 }
    ]
  }
];

export const defaultSequences = [
  {
    id: 'seq-yin-deep-release',
    name: 'Liberación Profunda de Tensión',
    description: 'Una sesión de Yin Yoga enfocada en caderas y columna lumbar.',
    items: [
      { type: 'posture', id: 'yin-butterfly', customHoldTime: 180 },
      { type: 'block', id: 'block-sun-salute-yin' },
      { type: 'posture', id: 'yin-caterpillar', customHoldTime: 240 }
    ]
  }
];
