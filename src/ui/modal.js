export function createModal({ backgroundRoot }) {
  if (!(backgroundRoot instanceof Element) || !backgroundRoot.parentNode) {
    throw new TypeError('backgroundRoot must be a mounted DOM element');
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.hidden = true;

  const panel = document.createElement('section');
  panel.className = 'modal-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  const header = document.createElement('div');
  header.className = 'modal-header';
  const heading = document.createElement('h2');
  heading.className = 'modal-title';
  let headingId = 'memory-game-modal-title';
  let suffix = 1;
  while (document.getElementById(headingId)) {
    headingId = `memory-game-modal-title-${suffix++}`;
  }
  heading.id = headingId;
  panel.setAttribute('aria-labelledby', headingId);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'button modal-close';
  closeButton.textContent = 'Закрыть';
  header.append(heading, closeButton);

  const contentRoot = document.createElement('div');
  contentRoot.className = 'modal-content';
  panel.append(header, contentRoot);
  overlay.append(panel);
  backgroundRoot.after(overlay);

  let destroyed = false;

  function handleOverlayClick(event) {
    if (event.target === overlay) close();
  }

  function handleKeydown(event) {
    if (event.key !== 'Escape' || !isOpen()) return;
    event.preventDefault();
    close();
  }

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', handleOverlayClick);
  document.addEventListener('keydown', handleKeydown);

  function open({ title, content }) {
    if (destroyed) return;
    if (typeof title !== 'string' || title.trim() === '') {
      throw new TypeError('title must be a non-empty string');
    }
    if (!(content instanceof Node) || ![1, 3, 11].includes(content.nodeType)
      || content.contains(backgroundRoot) || content.contains(overlay)
      || [panel, header, heading, closeButton, contentRoot].includes(content)) {
      throw new TypeError('content must be a DOM node outside the modal shell');
    }

    contentRoot.replaceChildren(content);
    heading.textContent = title;
    overlay.hidden = false;
  }

  function close() {
    if (destroyed) return;
    overlay.hidden = true;
    contentRoot.replaceChildren();
    heading.textContent = '';
  }

  function isOpen() {
    return !destroyed && !overlay.hidden;
  }

  function destroy() {
    if (destroyed) return;
    close();
    destroyed = true;
    closeButton.removeEventListener('click', close);
    overlay.removeEventListener('click', handleOverlayClick);
    document.removeEventListener('keydown', handleKeydown);
    overlay.remove();
  }

  return { open, close, isOpen, destroy };
}
