/**
 * Seed de ejercicios de fuerza / calistenia y circuitos predefinidos.
 * Basados en las sesiones de Miércoles y Domingo documentadas en 00_CONTEXT/Sesiones.md.
 */

export const defaultStrengthExercises = [
  // --- Sesión Miércoles: Core, Estabilidad y Piernas ---
  {
    id: 'str-sentadilla-pelota',
    name: 'Sentadilla asistida con Pelota',
    focus: 'Piernas y protección lumbar',
    mode: 'reps',
    reps: 12,
    duration: null,
    preparation: 'Colocar la pelota grande entre la zona lumbar (espalda baja) y una pared. Separar pies al ancho de los hombros y dar un pasito hacia adelante (los pies no deben estar pegados a la pared).',
    execution: 'Inhalar y flexionar las rodillas bajando la cadera como para sentarse, dejando que la pelota ruede por la espalda. Bajar hasta donde sea cómodo (idealmente hasta que los muslos estén paralelos al piso). Exhalar y empujar con los talones para volver a subir.',
    equipment: ['Pelota grande'],
    tags: ['piernas', 'core', 'lumbar']
  },
  {
    id: 'str-plancha-pads',
    name: 'Plancha modificada con Pads',
    focus: 'Abdomen y protección de muñecas',
    mode: 'time',
    reps: null,
    duration: 30,
    preparation: 'Extender mat. Colocar los pads debajo de las rodillas. En lugar de apoyar las palmas de las manos (dobla la muñeca y tensa el hombro), apoyar antebrazos directamente en el mat, paralelos entre sí.',
    execution: 'Contraer el abdomen como para recibir un golpecito en la barriga. El cuerpo debe formar una línea recta desde la cabeza hasta las rodillas. Mantener el cuello neutro mirando hacia las manos. Respirar fluidamente (no aguantar la respiración).',
    equipment: ['Mat de yoga', 'Pads para rodillas/muñecas'],
    tags: ['core', 'abdomen', 'plancha']
  },
  {
    id: 'str-puente-gluteos',
    name: 'Puente de Glúteos',
    focus: 'Glúteos y apertura de cadera',
    mode: 'reps',
    reps: 15,
    duration: null,
    preparation: 'Acostada boca arriba en tu mat. Flexionar las rodillas y apoyar las plantas de los pies en el piso, cerca de los glúteos. Dejar los brazos descansando a los lados.',
    execution: 'Inhalar y, al exhalar, apretar los glúteos y levantar la cadera hacia el techo hasta que el cuerpo forme una línea recta desde las rodillas hasta los hombros. Sostener un segundo arriba y bajar lentamente.',
    equipment: ['Mat de yoga'],
    tags: ['gluteos', 'cadera', 'core']
  },

  // --- Sesión Domingo: Postura, Espalda y Coordinación ---
  {
    id: 'str-flexiones-bloques',
    name: 'Flexiones Inclinadas con Bloques en la Pared',
    focus: 'Pecho y hombros seguros',
    mode: 'reps',
    reps: 10,
    duration: null,
    preparation: 'Parada frente a una pared. Colocar un bloque de yoga en cada mano (agarrándolos por los bordes para que las muñecas queden rectas, sin doblarse). Apoyar los bloques planos contra la pared a la altura y anchura de los hombros. Dar un paso hacia atrás con ambos pies.',
    execution: 'Inhalar, mantener el cuerpo recto y flexionar los codos acercando el pecho a la pared. Los codos deben apuntar hacia abajo y en diagonal (forma de flecha), no hacia afuera a los lados. Exhalar y empujar la pared para volver a la posición inicial.',
    equipment: ['2 Bloques de yoga'],
    tags: ['pecho', 'hombros', 'brazos']
  },
  {
    id: 'str-bicho-muerto',
    name: 'El Bicho Muerto (Deadbug) con Pelota',
    focus: 'Abdomen profundo y coordinación',
    mode: 'reps',
    reps: 10,
    duration: null,
    preparation: 'Acostada boca arriba en el mat. Levantar ambas piernas flexionadas a 90 grados (como sentada en una silla imaginaria). Levantar ambos brazos hacia el techo. Colocar la pelota grande de yoga entre las rodillas y las manos, sostenerla allí.',
    execution: 'Manteniendo la pelota apretada entre la mano izquierda y rodilla derecha, estirar el brazo derecho hacia atrás (sin tocar el suelo para no forzar el hombro) y la pierna izquierda hacia adelante. Regresar al centro, asegurar la pelota y cambiar de lado. Todo el tiempo la espalda baja debe estar aplastada contra el mat.',
    equipment: ['Mat de yoga', 'Pelota grande'],
    tags: ['core', 'coordinacion', 'abdomen']
  },
  {
    id: 'str-bisagra-cadera',
    name: 'Bisagra de Cadera abrazando la Pelota',
    focus: 'Isquiotibiales y espalda baja',
    mode: 'reps',
    reps: 12,
    duration: null,
    preparation: 'Parada derecha en el mat. Abrazar la pelota grande contra el pecho. Separar los pies al ancho de las caderas y flexionar ligeramente las rodillas (solo un poco, no es una sentadilla).',
    execution: 'Manteniendo la pelota abrazada y la espalda completamente recta, empujar los glúteos hacia atrás (como para cerrar una puerta con el trasero) mientras el torso se inclina hacia adelante. Se siente estiramiento en la parte posterior de los muslos. Contraer los glúteos para volver a ponerse de pie.',
    equipment: ['Mat de yoga', 'Pelota grande'],
    tags: ['isquiotibiales', 'espalda', 'gluteos']
  }
];

export const defaultStrengthCircuits = [
  {
    id: 'circuit-core-estabilidad',
    name: 'Centro (Core), Estabilidad y Piernas',
    description: 'Circuito de 3 rondas enfocado en core, estabilidad y piernas con implementos de soporte.',
    rounds: 3,
    restBetweenExercises: 18,
    restBetweenRounds: 60,
    equipment: ['Pelota grande', 'Mat de yoga', 'Pads para rodillas/muñecas'],
    exercises: [
      { exerciseId: 'str-sentadilla-pelota', repsOverride: null, durationOverride: null },
      { exerciseId: 'str-plancha-pads', repsOverride: null, durationOverride: 30 },
      { exerciseId: 'str-puente-gluteos', repsOverride: null, durationOverride: null }
    ]
  },
  {
    id: 'circuit-postura-espalda',
    name: 'Postura, Espalda y Coordinación',
    description: 'Circuito de 3 rondas para contrarrestar la postura de trabajar recostada, abriendo el pecho y protegiendo el hombro.',
    rounds: 3,
    restBetweenExercises: 18,
    restBetweenRounds: 60,
    equipment: ['Mat de yoga', '2 Bloques de yoga', 'Pelota grande'],
    exercises: [
      { exerciseId: 'str-flexiones-bloques', repsOverride: null, durationOverride: null },
      { exerciseId: 'str-bicho-muerto', repsOverride: null, durationOverride: null },
      { exerciseId: 'str-bisagra-cadera', repsOverride: null, durationOverride: null }
    ]
  }
];
