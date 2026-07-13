export const TUNER_PRESETS = [
  { value: 7.83, label: '7.83 Hz', description: 'Resonancia Schumann' },
  { value: 174, label: '174 Hz', description: 'Alivio del dolor' },
  { value: 285, label: '285 Hz', description: 'Regeneracion de tejidos' },
  { value: 396, label: '396 Hz', description: 'Liberar miedo y culpa' },
  { value: 417, label: '417 Hz', description: 'Facilitar el cambio' },
  { value: 432, label: '432 Hz', description: 'Calma y armonia natural' },
  { value: 528, label: '528 Hz', description: 'Transformacion y milagro' },
  { value: 639, label: '639 Hz', description: 'Conexion y relaciones' },
  { value: 741, label: '741 Hz', description: 'Desintoxicacion (Limpieza)' },
  { value: 852, label: '852 Hz', description: 'Despertar de la intuicion' },
  { value: 963, label: '963 Hz', description: 'Conexion universal / Unidad' }
];

export const FREQ_DESCRIPTIONS = {
  174: '174 Hz — Alivio del dolor',
  285: '285 Hz — Regeneración de tejidos',
  396: '396 Hz — Liberar miedo y culpa',
  417: '417 Hz — Facilitar el cambio',
  432: '432 Hz — Calma y armonía natural',
  528: '528 Hz — Transformación y milagro',
  639: '639 Hz — Conexión y relaciones',
  741: '741 Hz — Despertar de la intuición',
  852: '852 Hz — Retorno al orden espiritual',
  963: '963 Hz — Conexión universal / Unidad'
};

export function getFreqLabel(freq) {
  const freqNum = parseFloat(freq);
  for (const key of Object.keys(FREQ_DESCRIPTIONS)) {
    if (Math.abs(parseFloat(key) - freqNum) < 0.05) {
      return FREQ_DESCRIPTIONS[key];
    }
  }
  const displayVal = freqNum % 1 === 0 ? freqNum.toFixed(0) : freqNum.toFixed(1);
  return `${displayVal} Hz`;
}

export function getWaveStateName(freq) {
  if (freq <= 4.0) return 'DELTA';
  if (freq <= 8.0) return 'THETA';
  if (freq <= 12.0) return 'ALPHA';
  return 'BETA';
}

export function valueToFreq(v) {
  if (v <= 25) {
    return 0.5 + (v / 25) * 3.5;
  } else if (v <= 50) {
    return 4.0 + ((v - 25) / 25) * 4.0;
  } else if (v <= 75) {
    return 8.0 + ((v - 50) / 25) * 4.0;
  } else {
    return 12.0 + ((v - 75) / 25) * 18.0;
  }
}

export function freqToValue(f) {
  if (f <= 4.0) {
    return ((f - 0.5) / 3.5) * 25;
  } else if (f <= 8.0) {
    return 25 + ((f - 4.0) / 4.0) * 25;
  } else if (f <= 12.0) {
    return 50 + ((f - 8.0) / 4.0) * 25;
  } else {
    return 75 + ((f - 12.0) / 18.0) * 25;
  }
}
