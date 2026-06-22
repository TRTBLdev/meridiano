/**
 * Calcula el hash SHA-256 de una cadena de texto utilizando la API nativa Web Crypto.
 * De esta forma se evitan dependencias externas y se ejecuta localmente de forma ultra-rápida.
 * 
 * @param {string} text Texto a cifrar
 * @returns {Promise<string>} Hash SHA-256 en formato hexadecimal
 */
export async function hashSHA256(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
