import { createModal } from '../src/ui/modal.js';

export function runModalFocusTests() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const passed = [];
  const backgroundRoot = document.createElement('main');
  const header = document.createElement('header');
  header.className = 'app-header';
  const fallback = document.createElement('button');
  fallback.className = 'button button-primary';
  fallback.textContent = 'Новая игра';
  const trigger = document.createElement('button');
  trigger.textContent = 'Открыть рейтинг';
  header.append(fallback, trigger);
  backgroundRoot.append(header);
  const outside = document.createElement('button');
  outside.textContent = 'Внешняя кнопка';
  document.body.append(backgroundRoot, outside);
  const roots = [document.documentElement, document.body];
  const initialStyles = roots.map((root) => root.getAttribute('style'));
  const modal = createModal({ backgroundRoot });
  const panel = document.querySelector('.modal-panel');
  const closeButton = panel.querySelector('.modal-close');
  const content = () => {
    const root = document.createElement('div');
    const input = document.createElement('input');
    const last = document.createElement('button');
    last.textContent = 'Последняя кнопка';
    root.append(input, last);
    return { root, input, last };
  };
  const tab = (shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return event;
  };
  const savedOverflow = (root) => ['overflow-x', 'overflow-y'].map((property) => [
    root.style.getPropertyValue(property), root.style.getPropertyPriority(property),
  ]);
  try {
    document.documentElement.style.setProperty('overflow-x', 'clip', 'important');
    document.documentElement.style.setProperty('overflow-y', 'scroll');
    document.body.style.setProperty('overflow', 'auto', 'important');
    const before = roots.map(savedOverflow);
    trigger.focus();
    let controls = content();
    modal.open({ title: 'Рейтинг', content: controls.root, returnFocus: trigger });
    assert(backgroundRoot.inert, 'background must be inert while open');
    assert(roots.every((root) => getComputedStyle(root).overflowX === 'hidden' && getComputedStyle(root).overflowY === 'hidden'), 'page scrolling must be locked');
    assert(panel.contains(document.activeElement), 'opening must move focus inside');
    trigger.focus();
    assert(panel.contains(document.activeElement), 'inert background must not receive focus');
    outside.focus();
    assert(panel.contains(document.activeElement), 'external focus must be contained');
    passed.push('opening locks the background and page scrolling and contains focus');

    const hidden = document.createElement('div');
    hidden.hidden = true;
    hidden.append(document.createElement('button'));
    const disabled = document.createElement('button');
    disabled.disabled = true;
    controls.root.append(hidden, disabled);
    controls.last.focus();
    assert(tab().defaultPrevented && document.activeElement === closeButton, 'Tab at last must wrap to first available control');
    assert(tab(true).defaultPrevented && document.activeElement === controls.last, 'Shift+Tab at first must wrap to last available control');
    const added = document.createElement('button');
    added.textContent = 'Добавленная кнопка';
    controls.root.append(added);
    added.focus();
    tab();
    assert(document.activeElement === closeButton, 'trap must include dynamically added controls');
    added.remove();
    passed.push('Tab boundaries ignore unavailable controls and refresh after content changes');

    controls = content();
    modal.open({ title: 'Победа', content: controls.root });
    assert(backgroundRoot.inert && panel.contains(document.activeElement), 'content replacement must preserve locking and focus');
    modal.close();
    assert(!backgroundRoot.inert && document.activeElement === trigger, 'close after replacement must restore original focus target');
    assert(JSON.stringify(roots.map(savedOverflow)) === JSON.stringify(before), 'close must restore overflow values and priorities');
    document.body.style.setProperty('overflow-y', 'visible');
    modal.close();
    assert(document.body.style.overflowY === 'visible', 'repeated close must not restore old styles again');
    passed.push('replacement preserves original state and close restores values, priorities and focus once');

    for (const mode of ['removed', 'disabled', 'hidden']) {
      const target = document.createElement('button');
      backgroundRoot.append(target);
      modal.open({ title: 'Рейтинг', content: content().root, returnFocus: target });
      if (mode === 'removed') target.remove();
      if (mode === 'disabled') target.disabled = true;
      if (mode === 'hidden') target.hidden = true;
      modal.close();
      assert(document.activeElement === fallback, `unavailable ${mode} return target must use New Game`);
      target.remove();
    }
    modal.open({ title: 'Автоматическая победа', content: content().root });
    modal.close();
    assert(document.activeElement === fallback, 'automatic opening must use header New Game fallback');
    passed.push('removed, disabled and hidden targets use the header fallback');

    closeButton.disabled = true;
    modal.open({ title: 'Нет действий', content: document.createTextNode('Информация') });
    assert(document.activeElement === panel, 'panel must receive focus when no controls are available');
    assert(tab().defaultPrevented && document.activeElement === panel, 'Tab must remain on an empty panel');
    assert(tab(true).defaultPrevented && document.activeElement === panel, 'Shift+Tab must remain on an empty panel');
    modal.close();
    closeButton.disabled = false;
    passed.push('panel fallback retains focus when no controls are available');

    backgroundRoot.inert = true;
    modal.open({ title: 'Исходно заблокированный фон', content: content().root });
    modal.close();
    assert(backgroundRoot.inert, 'pre-existing inert state must be restored');
    backgroundRoot.inert = false;
    const beforeDestroy = roots.map(savedOverflow);
    modal.open({ title: 'Уничтожение', content: content().root, returnFocus: trigger });
    modal.destroy();
    assert(!backgroundRoot.inert && document.activeElement === trigger, 'destroy must restore background and focus');
    assert(JSON.stringify(roots.map(savedOverflow)) === JSON.stringify(beforeDestroy), 'destroy must restore scrolling');
    outside.focus();
    assert(document.activeElement === outside, 'destroy must release focus containment');
    modal.destroy();
    passed.push('pre-existing inert state and destroy restore state and release focus handling');
    return { passed };
  } finally {
    modal.destroy();
    roots.forEach((root, index) => {
      if (initialStyles[index] === null) root.removeAttribute('style');
      else root.setAttribute('style', initialStyles[index]);
    });
    backgroundRoot.remove();
    outside.remove();
  }
}
