export function createMusicControl({ source }) {
  const listeners = new AbortController();
  const root = document.createElement('div');
  root.className = 'music-control';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'button button-secondary music-button';
  button.textContent = 'Музыка: выкл.';
  button.setAttribute('aria-label', 'Фоновая музыка');
  button.setAttribute('aria-pressed', 'false');
  const status = document.createElement('p');
  status.className = 'music-status';
  status.setAttribute('role', 'status');
  const audio = document.createElement('audio');
  audio.src = source;
  audio.preload = 'none';
  audio.loop = true;
  audio.volume = 0.2;
  audio.hidden = true;
  root.append(button, status, audio);
  let destroyed = false;

  function update() {
    const playing = !audio.paused && !audio.error;
    button.textContent = playing ? 'Музыка: вкл.' : 'Музыка: выкл.';
    button.setAttribute('aria-pressed', String(playing));
  }

  function showError() {
    status.textContent = 'Не удалось включить музыку. Попробуйте ещё раз.';
    update();
  }

  audio.addEventListener('playing', update, { signal: listeners.signal });
  audio.addEventListener('pause', update, { signal: listeners.signal });
  audio.addEventListener('error', showError, { signal: listeners.signal });
  button.addEventListener('click', async () => {
    status.textContent = '';
    if (!audio.paused) {
      audio.pause();
      update();
      return;
    }
    button.disabled = true;
    try {
      if (audio.error) audio.load();
      await audio.play();
      if (!destroyed) update();
    } catch {
      if (!destroyed) showError();
    } finally {
      if (!destroyed) button.disabled = false;
    }
  }, { signal: listeners.signal });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    listeners.abort();
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    root.remove();
  }

  return { root, destroy };
}
