export const defaultPostures = [
  { id: 'yin-butterfly', name: 'Mariposa (Baddha Konasana)', description: 'Apertura suave de caderas y estiramiento de columna lumbar.', style: 'Yin' },
  { id: 'yin-sphinx', name: 'Esfinge (Salamba Bhujangasana)', description: 'Compresión terapéutica de la zona lumbar y apertura de pecho.', style: 'Yin' },
  { id: 'yin-caterpillar', name: 'Oruga (Paschimottanasana)', description: 'Estiramiento profundo de toda la cadena posterior y estimulación del sistema nervioso parasimpático.', style: 'Yin' },
  { id: 'yin-caterpillar-ball', name: 'Oruga Asistida con Pelota', description: 'Estiramiento sin esfuerzo jalando, apoyando el peso sobre la pelota.', style: 'Yin' },
  { id: 'yin-seal', name: 'Foca (Variación de Esfinge)', description: 'Extensión de columna más profunda, con brazos extendidos.', style: 'Yin' },
  { id: 'yin-child', name: 'Niño (Balasana)', description: 'Postura de descanso, introspección y estiramiento lumbar suave.', style: 'Yin' },
  { id: 'yin-butterfly-blocks', name: 'Mariposa con Bloques', description: 'Caderas sostenidas por bloques para evitar tensión en las ingles.', style: 'Yin' },
  { id: 'yin-savasana-ball', name: 'Savasana Restaurativo con Pelota', description: 'Piernas a 90 grados sobre la pelota para aplanar y aliviar la lumbar.', style: 'Yin' },
  { id: 'yin-supported-fish', name: 'Pez Soportado con Bloques', description: 'Abre el pecho sin requerir esfuerzo del hombro, contrarresta postura encorvada.', style: 'Yin' },
  { id: 'yin-spinal-twist-right-ball', name: 'Torsión Espinal Derecha con Pelota', description: 'Descomprime vértebras apoyando rodillas sobre la pelota (lado derecho).', style: 'Yin' },
  { id: 'yin-spinal-twist-left-ball', name: 'Torsión Espinal Izquierda con Pelota', description: 'Equilibrio lateral, relajando músculos espinales sobre la pelota (lado izquierdo).', style: 'Yin' },
  { id: 'yin-savasana', name: 'Savasana', description: 'Descanso final asimilando la práctica.', style: 'Yin' }
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
  },
  {
    id: 'seq-yin-miercoles',
    name: 'Elemento Agua - Liberación Lumbar y Piernas',
    description: 'Posturas asistidas con pelota para relajar la cadena posterior tras hacer sentadillas.',
    items: [
      { type: 'posture', id: 'yin-caterpillar-ball', customHoldTime: 240 },
      { type: 'posture', id: 'yin-butterfly-blocks', customHoldTime: 240 },
      { type: 'posture', id: 'yin-savasana-ball', customHoldTime: 300 }
    ]
  },
  {
    id: 'seq-yin-domingo',
    name: 'Elemento Metal/Madera - Pecho, Columna y Hombro Seguro',
    description: 'Apertura de pecho y torsiones suaves para contrarrestar la postura encorvada.',
    items: [
      { type: 'posture', id: 'yin-supported-fish', customHoldTime: 240 },
      { type: 'posture', id: 'yin-spinal-twist-right-ball', customHoldTime: 180 },
      { type: 'posture', id: 'yin-spinal-twist-left-ball', customHoldTime: 180 },
      { type: 'posture', id: 'yin-savasana', customHoldTime: 180 }
    ]
  }
];
