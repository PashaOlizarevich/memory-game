import { createModal } from '../src/ui/modal.js';
import { createVictoryContent, createLeaderboardContent } from '../src/ui/modal-content.js';

export function runModalContentTests() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const passed = [];
  const warning = 'Постоянное сохранение недоступно. Результаты доступны в текущем сеансе и могут потеряться после перезагрузки';
  let newGames = 0;
  let closes = 0;
  const actions = { onNewGame: () => { newGames += 1; }, onClose: () => { closes += 1; } };
  const victory = createVictoryContent({ moves: 17, persistence: 'persistent', ...actions });
  assert(victory instanceof HTMLElement && !victory.querySelector('[role="dialog"]'), 'content must not create another shell');
  assert(victory.textContent.includes('Все 8 пар найдены') && victory.textContent.includes('Ходы: 17'), 'victory must show the actual result');
  assert(!victory.textContent.includes(warning), 'persistent victory must not show memory warning');
  const buttons = [...victory.querySelectorAll('button')];
  assert(buttons.length === 2 && buttons.every((button) => button.type === 'button'), 'victory must provide two genuine actions');
  buttons.find((button) => button.textContent === 'Новая игра').click();
  buttons.find((button) => button.textContent === 'Закрыть').click();
  assert(newGames === 1 && closes === 1, 'each victory action must invoke its callback once');
  passed.push('victory result and independent action callbacks without an extra shell');

  const memoryVictory = createVictoryContent({ moves: 8, persistence: 'memory', ...actions });
  assert(memoryVictory.textContent.includes(warning) && memoryVictory.textContent.includes('Ходы: 8'), 'memory warning must preserve the victory result');
  passed.push('memory persistence warning preserves the victory result');

  const results = [
    { moves: 12, completedAt: new Date(2024, 0, 2, 12).getTime() },
    { moves: 8, completedAt: new Date(2024, 10, 23, 12).getTime() },
  ];
  const before = JSON.stringify(results);
  const leaderboard = createLeaderboardContent({ results, persistence: 'persistent', onClose: actions.onClose });
  const table = leaderboard.querySelector('table');
  assert(table && table.textContent.includes('10 лучших завершённых игр'), 'leaderboard must have a named real table');
  assert([...table.querySelectorAll('thead th')].map((cell) => cell.textContent).join('|') === 'Место|Ходы|Дата', 'table columns must match DESIGN');
  assert([...table.querySelectorAll('thead th')].every((cell) => cell.scope === 'col'), 'column headers must have scope');
  const rows = [...table.querySelectorAll('tbody tr')].map((row) => [...row.children].map((cell) => cell.textContent));
  assert(rows.length === 2 && rows[0].join('|') === '1|12|02.01.2024' && rows[1].join('|') === '2|8|23.11.2024', 'table must display supplied order, positions and local dates');
  assert(JSON.stringify(results) === before, 'rendering must preserve source results');
  leaderboard.querySelector('button').click();
  assert(closes === 2, 'leaderboard close action must invoke its callback');
  passed.push('semantic leaderboard, local dates, supplied order and immutable input');

  const empty = createLeaderboardContent({ results: [], persistence: 'persistent', onClose: actions.onClose });
  assert(empty.textContent.includes('Пока нет результатов. Завершите игру, чтобы попасть в таблицу лидеров'), 'empty leaderboard must explain how to get results');
  assert(!empty.querySelector('table') && !empty.textContent.includes(warning), 'empty persistent state must not invent rows or warnings');
  const emptyMemory = createLeaderboardContent({ results: [], persistence: 'memory', onClose: actions.onClose });
  assert(emptyMemory.textContent.includes(warning) && emptyMemory.textContent.includes('Пока нет результатов.'), 'memory empty state must keep both messages');
  passed.push('empty leaderboard and memory warning without invented results');

  const backgroundRoot = document.createElement('main');
  document.body.append(backgroundRoot);
  const modal = createModal({ backgroundRoot });
  try {
    modal.open({ title: 'Сила памяти с вами!', content: victory });
    const shell = document.querySelector('.modal-panel');
    assert(shell.contains(victory), 'victory must mount in the common shell');
    const closeable = createLeaderboardContent({ results, persistence: 'memory', onClose: () => modal.close() });
    modal.open({ title: 'Таблица лидеров', content: closeable });
    assert(document.querySelectorAll('[role="dialog"]').length === 1 && shell.contains(closeable) && !shell.contains(victory), 'both contents must reuse a single shell');
    closeable.querySelector('button').click();
    assert(!modal.isOpen(), 'content close callback must close the common shell');
    passed.push('victory and leaderboard reuse the modal and content action closes it');
  } finally {
    modal.destroy();
    backgroundRoot.remove();
  }
  return { passed };
}
