import { hashSHA256 } from '../utils/crypto.js';

// Hashes autorizados
const HASHES = {
  CREADORA: 'a3f8f2ea80b7f5a909c74d996235548f45abe8d0518f0cbd620ba6673bf5af0c', // Meridiano-Crea-Admin-2026!
  INVITADO: '9886afbf31f0ed88c959c55e74c9e9274047f18de5a29fba6a2210de4a8297e2'  // Meridiano-Invita-Access-2026?
};

/**
 * Renderiza la pantalla de Login con diseño Braun minimalista (tipografía limpia y sin cajas toscas).
 * 
 * @param {HTMLElement} container Contenedor donde se dibuja la vista
 * @param {Function} onLoginSuccess Callback tras iniciar sesión
 */
export function renderLogin(container, onLoginSuccess) {
  container.innerHTML = `
    <div class="login-container fade-in">
      <div class="login-card glass-panel" style="text-align: center; max-width: 380px;">
        <!-- Logo en tipografía pura y espaciada -->
        <h1 style="font-size: 2.2rem; font-weight: 300; letter-spacing: 0.18em; margin-bottom: 8px; color: var(--color-text-main);">
          MERIDIANO
        </h1>
        <p class="login-sub">SISTEMA DE REPOSO Y INTEGRACIÓN</p>
        
        <form id="login-form" style="text-align: left; margin-top: 32px;">
          <div class="form-group">
            <label for="access-code" class="form-label">Código de Acceso</label>
            <input 
              type="password" 
              id="access-code" 
              class="form-input" 
              placeholder="Introduce tu código..."
              required
              autocomplete="current-password"
            />
            <div id="login-error" class="error-message">Código de acceso incorrecto.</div>
          </div>
          
          <button type="submit" class="btn-primary" style="margin-top: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase;">
            Ingresar
          </button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#login-form');
  const input = container.querySelector('#access-code');
  const errorMsg = container.querySelector('#login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.classList.remove('visible');
    
    const code = input.value.trim();
    if (!code) return;

    try {
      const hashedCode = await hashSHA256(code);
      
      let role = null;
      if (hashedCode === HASHES.CREADORA) {
        role = 'creadora';
      } else if (hashedCode === HASHES.INVITADO) {
        role = 'invitado';
      }

      if (role) {
        onLoginSuccess({ role });
      } else {
        errorMsg.classList.add('visible');
        input.value = '';
        input.focus();
      }
    } catch (err) {
      console.error('[Login] Error hashing code:', err);
      errorMsg.textContent = 'Ocurrió un error al verificar el código. Inténtalo de nuevo.';
      errorMsg.classList.add('visible');
    }
  });
}
