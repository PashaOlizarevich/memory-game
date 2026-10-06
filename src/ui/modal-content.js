import { formatDate } from '../utils/format-date.js';

const persistenceMessage = 'Постоянное сохранение недоступно. Результаты доступны в текущем сеансе и могут потеряться после перезагрузки';

function createText(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function createAction(text, className, callback) {
  const button = createText('button', `button ${className}`, text);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
}

function appendPersistenceMessage(root, persistence) {
  if (persistence === 'memory') {
    root.append(createText('p', 'modal-persistence', persistenceMessage));
  }
}

export function createVictoryContent({ moves, persistence, onNewGame, onClose }) {
  const root = document.createElement('div');
  root.className = 'victory-content';
  root.append(
    createText('p', 'modal-description', 'Все 8 пар найдены'),
    createText('p', 'victory-result', `Ходы: ${moves}`),
  );
  appendPersistenceMessage(root, persistence);

  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.append(
    createAction('Новая игра', 'button-primary', onNewGame),
    createAction('Закрыть', 'button-secondary', onClose),
  );
  root.append(actions);
  return root;
}

export function createLeaderboardContent({ results, persistence, onClose }) {
  const root = document.createElement('div');
  root.className = 'leaderboard-content';

  if (results.length === 0) {
    root.append(
      createText('p', 'modal-description', '10 лучших завершённых игр'),
      createText('p', 'leaderboard-empty', 'Пока нет результатов. Завершите игру, чтобы попасть в таблицу лидеров'),
    );
  } else {
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    table.append(createText('caption', 'modal-description', '10 лучших завершённых игр'));
    const head = document.createElement('thead');
    const headingRow = document.createElement('tr');
    for (const label of ['Место', 'Ходы', 'Дата']) {
      const heading = createText('th', '', label);
      heading.scope = 'col';
      headingRow.append(heading);
    }
    head.append(headingRow);
    const body = document.createElement('tbody');
    results.forEach(({ moves, completedAt }, index) => {
      const row = document.createElement('tr');
      const date = formatDate(completedAt);
      for (const value of [index + 1, moves, date]) {
        row.append(createText('td', '', value));
      }
      body.append(row);
    });
    table.append(head, body);
    root.append(table);
  }
  appendPersistenceMessage(root, persistence);
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.append(createAction('Закрыть', 'button-secondary', onClose));
  root.append(actions);
  return root;
}
