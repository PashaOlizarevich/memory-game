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
  panel.tabIndex = -1;

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
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Закрыть');
  header.append(heading, closeButton);

  const contentRoot = document.createElement('div');
  contentRoot.className = 'modal-content';
  panel.append(header, contentRoot);
  overlay.append(panel);
  backgroundRoot.after(overlay);

  let destroyed = false;
  let savedBackground = null;
  let returnTarget = null;

  function isAvailable(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected
      || element.matches(':disabled') || element.getClientRects().length === 0) return false;
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (current.hidden || current.inert || style.display === 'none'
        || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
    }
    return true;
  }

  function getFocusTargets() {
    return [...panel.querySelectorAll('button, a[href], area[href], input, select, textarea, summary, [tabindex], [contenteditable]')]
      .filter((element) => isAvailable(element)
        && (element.tabIndex >= 0 || (element.isContentEditable && !element.hasAttribute('tabindex'))))
      .sort((first, second) => {
        const firstOrder = first.tabIndex > 0 ? first.tabIndex : Infinity;
        const secondOrder = second.tabIndex > 0 ? second.tabIndex : Infinity;
        return firstOrder - secondOrder;
      });
  }

  function focusInside() {
    (getFocusTargets()[0] || panel).focus({ preventScroll: true });
  }

  function lockBackground() {
    const overflowNames = ['overflow', 'overflow-x', 'overflow-y'];
    savedBackground = {
      inert: backgroundRoot.inert,
      scroll: [document.documentElement, document.body].map((element) => ({
        element,
        declarations: [...element.style]
          .filter((name) => overflowNames.includes(name))
          .map((name) => ({ name, value: element.style.getPropertyValue(name), priority: element.style.getPropertyPriority(name) })),
      })),
    };
    backgroundRoot.inert = true;
    for (const { element } of savedBackground.scroll) {
      element.style.setProperty('overflow', 'hidden', 'important');
    }
  }

  function restoreBackground() {
    backgroundRoot.inert = savedBackground.inert;
    for (const { element, declarations } of savedBackground.scroll) {
      for (const name of ['overflow', 'overflow-x', 'overflow-y']) element.style.removeProperty(name);
      for (const { name, value, priority } of declarations) element.style.setProperty(name, value, priority);
    }
    savedBackground = null;
  }

  function handleFocusIn(event) {
    if (isOpen() && !panel.contains(event.target)) focusInside();
  }

  function handleOverlayClick(event) {
    if (event.target === overlay) close();
  }

  function handleKeydown(event) {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const targets = getFocusTargets();
      const index = targets.indexOf(document.activeElement);
      const nextIndex = event.shiftKey
        ? (index <= 0 ? targets.length - 1 : index - 1)
        : (index + 1) % targets.length;
      (targets[nextIndex] || panel).focus({ preventScroll: true });
    }
  }

  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', handleOverlayClick);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('focusin', handleFocusIn);

  function open({ title, content, returnFocus }) {
    if (destroyed) return;
    if (typeof title !== 'string' || title.trim() === '') {
      throw new TypeError('title must be a non-empty string');
    }
    if (!(content instanceof Node) || ![1, 3, 11].includes(content.nodeType)
      || content.contains(backgroundRoot) || content.contains(overlay)
      || [panel, header, heading, closeButton, contentRoot].includes(content)) {
      throw new TypeError('content must be a DOM node outside the modal shell');
    }

    if (!isOpen()) {
      returnTarget = returnFocus;
      lockBackground();
    } else if (returnFocus !== undefined) {
      returnTarget = returnFocus;
    }
    contentRoot.replaceChildren(content);
    heading.textContent = title;
    overlay.hidden = false;
    focusInside();
  }

  function close() {
    if (!isOpen()) return;
    overlay.hidden = true;
    contentRoot.replaceChildren();
    heading.textContent = '';
    restoreBackground();
    if (isAvailable(returnTarget)) returnTarget.focus({ preventScroll: true });
    if (document.activeElement !== returnTarget || !isAvailable(returnTarget)) {
      const fallback = backgroundRoot.querySelector('.app-header .button-primary');
      if (isAvailable(fallback)) fallback.focus({ preventScroll: true });
    }
    returnTarget = null;
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
    document.removeEventListener('focusin', handleFocusIn);
    overlay.remove();
  }

  return { open, close, isOpen, destroy };
}
