import { populateTimerDots } from './timerShell.js';

export function calculateStrengthGridGeometry(width, height, {
  minPitch = 12,
  maxPitch = 20
} = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const pitch = Math.max(minPitch, Math.min(maxPitch, safeWidth / 96));
  const columns = Math.ceil(safeWidth / pitch);
  const rows = Math.ceil(safeHeight / pitch);

  return {
    pitch,
    columns,
    rows,
    count: columns * rows
  };
}

export function getStrengthLitDotCount(elapsedSeconds, totalDots) {
  return Math.min(
    Math.max(0, Math.floor(Number(totalDots) || 0)),
    Math.max(0, Math.floor(Number(elapsedSeconds) || 0))
  );
}

export function createStrengthDotField(grid, { getElapsedSeconds = () => 0 } = {}) {
  let dots = [];
  let litDots = 0;
  let resizeFrame = null;
  let destroyed = false;

  function sync(elapsedSeconds = getElapsedSeconds()) {
    if (destroyed) return;
    const nextLitDots = getStrengthLitDotCount(elapsedSeconds, dots.length);

    if (nextLitDots > litDots) {
      for (let index = litDots; index < nextLitDots; index++) dots[index]?.classList.add('active');
    } else if (nextLitDots < litDots) {
      for (let index = nextLitDots; index < litDots; index++) dots[index]?.classList.remove('active');
    }
    litDots = nextLitDots;
  }

  function resize() {
    if (destroyed) return;
    const bounds = grid.getBoundingClientRect();
    const geometry = calculateStrengthGridGeometry(bounds.width, bounds.height);
    grid.style.setProperty('--strength-grid-pitch', `${geometry.pitch}px`);
    grid.style.setProperty('--strength-grid-columns', geometry.columns);
    grid.style.setProperty('--strength-grid-rows', geometry.rows);
    dots = Array.from(populateTimerDots(grid, geometry.count, 'strength-timer__dot'));
    litDots = 0;
    sync();
  }

  function scheduleResize() {
    if (resizeFrame != null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = null;
      resize();
    });
  }

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(scheduleResize)
    : null;

  if (observer) observer.observe(grid);
  else window.addEventListener('resize', scheduleResize);
  resize();

  return {
    resize,
    sync,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeFrame != null) cancelAnimationFrame(resizeFrame);
    }
  };
}
