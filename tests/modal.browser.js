import { createModal } from '../src/ui/modal.js';

// Exercise the reusable shell in the real DOM, independently of game integration.
export function runModalTests() {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const passed = [];
  const backgroundRoot = document.createElement('main');
  document.body.append(backgroundRoot);
  const modal = createModal({ backgroundRoot });
  const dialogs = () => [...document.querySelectorAll('[role="dialog"]')];
  const dialog = dialogs()[0];
  const shell = dialog.parentElement;
  try {
    assert(dialogs().length === 1 && !backgroundRoot.contains(dialog), 'shell must be separate from the game');
    assert(!modal.isOpen() && getComputedStyle(shell).display === 'none', 'initial shell must be hidden');
    assert(dialog.getAttribute('aria-modal') === 'true', 'dialog semantics missing');
    const heading = document.getElementById(dialog.getAttribute('aria-labelledby'));
    assert(heading && dialog.contains(heading), 'dialog must reference its own heading');
    passed.push('hidden shell outside the game and named dialog semantics');

    const victory = document.createElement('button');
    victory.textContent = 'Новая игра';
    let clicks = 0;
    victory.addEventListener('click', () => { clicks += 1; });
    modal.open({ title: 'Сила памяти с вами!', content: victory });
    assert(modal.isOpen() && getComputedStyle(shell).display !== 'none', 'open must show the shell');
    assert(heading.textContent === 'Сила памяти с вами!' && dialog.contains(victory), 'victory content missing');
    victory.click();
    assert(clicks === 1, 'content node listeners must survive insertion');
    passed.push('opening preserves the supplied content node and its listeners');

    const fragment = document.createDocumentFragment();
    const table = document.createElement('table');
    fragment.append(table);
    modal.open({ title: 'Таблица лидеров', content: fragment });
    assert(dialogs().length === 1 && dialogs()[0] === dialog && dialog.parentElement === shell, 'reopen must reuse the same shell');
    assert(dialog.contains(table) && !dialog.contains(victory), 'reopen must replace only content');
    assert(heading.textContent === 'Таблица лидеров', 'reopen must update its accessible title');
    passed.push('victory-to-leaderboard replacement reuses the shell and accepts a fragment');

    for (const options of [
      { title: '', content: document.createElement('p') },
      { title: 'Некорректное содержимое', content: '<p>HTML-строка</p>' },
      { title: 'Фоновый экран', content: backgroundRoot },
      { title: 'Оболочка', content: dialog },
    ]) {
      let rejected = false;
      try {
        modal.open(options);
      } catch (error) {
        rejected = error instanceof TypeError;
      }
      assert(rejected, 'invalid input must be rejected');
      assert(modal.isOpen() && heading.textContent === 'Таблица лидеров' && dialog.contains(table), 'invalid input must preserve the current window');
    }
    passed.push('invalid content and title preserve the currently open window');

    const literal = '<img src=x onerror=alert(1)>';
    modal.open({ title: literal, content: document.createTextNode('Результаты') });
    assert(heading.textContent === literal && !heading.querySelector('img'), 'title must be literal text');
    assert(dialog.textContent.includes('Результаты'), 'text nodes must be accepted');
    passed.push('DOM content and literal title avoid HTML parsing');

    modal.close();
    modal.close();
    assert(!modal.isOpen() && getComputedStyle(shell).display === 'none', 'close must be idempotent and hide the shell');
    const reopened = document.createElement('p');
    reopened.textContent = 'Повторное открытие';
    modal.open({ title: 'Рейтинг', content: reopened });
    assert(modal.isOpen() && dialogs()[0] === dialog && dialog.contains(reopened), 'close must allow reopening the same shell');
    passed.push('idempotent close and subsequent reuse');

    const openContent = () => {
      const content = document.createElement('div');
      const nestedButton = document.createElement('button');
      nestedButton.type = 'button';
      const child = document.createElement('span');
      child.textContent = 'Действие внутри окна';
      nestedButton.append(child);
      content.append(nestedButton);
      modal.open({ title: 'Проверка закрытия', content });
      return { content, nestedButton, child };
    };
    const closeButton = dialog.querySelector('.modal-close');
    openContent();
    closeButton.click();
    assert(!modal.isOpen() && shell.hidden, 'close button must hide the window');
    openContent();
    closeButton.click();
    assert(!modal.isOpen(), 'close button must work after reopening');
    passed.push('close button works across repeated openings');

    const nested = openContent();
    let contentClicks = 0;
    nested.nestedButton.addEventListener('click', () => { contentClicks += 1; });
    dialog.click();
    heading.click();
    nested.content.click();
    nested.child.click();
    assert(modal.isOpen() && contentClicks === 1, 'panel and nested content clicks must preserve the window and content handlers');
    shell.click();
    assert(!modal.isOpen() && shell.hidden, 'click on the overlay itself must close');
    passed.push('backdrop closes while panel and nested content clicks stay open');

    const escapeContent = openContent();
    const otherKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    escapeContent.nestedButton.dispatchEvent(otherKey);
    assert(modal.isOpen() && !otherKey.defaultPrevented, 'other keys must not close or be consumed');
    escapeContent.nestedButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!modal.isOpen() && shell.hidden, 'Escape from a content control must close');
    openContent();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert(!modal.isOpen(), 'Escape must also work without focus inside the panel');
    const closedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(closedEscape);
    assert(!modal.isOpen() && !closedEscape.defaultPrevented, 'closed shell must not consume Escape');
    passed.push('Escape closes from content or document and ignores closed windows and other keys');

    openContent();
    modal.destroy();
    modal.destroy();
    assert(!shell.isConnected && !modal.isOpen(), 'destroy must remove the shell');
    modal.open({ title: 'После destroy', content: document.createElement('p') });
    modal.close();
    assert(dialogs().length === 0 && !modal.isOpen(), 'destroy must be terminal');
    assert(backgroundRoot.isConnected, 'destroy must preserve the game');
    closeButton.click();
    shell.click();
    const destroyedEscape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(destroyedEscape);
    assert(!destroyedEscape.defaultPrevented && dialogs().length === 0, 'destroyed shell must not respond to former event sources');
    passed.push('terminal idempotent destroy preserves the background');
    return { passed };
  } finally {
    modal.destroy();
    backgroundRoot.remove();
  }
}
