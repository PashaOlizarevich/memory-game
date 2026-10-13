import { difficulties, DEFAULT_DIFFICULTY_ID, getDifficulty } from '../game/difficulty.js';
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

export function createVictoryContent({ moves, totalPairs = 8, difficulty = getDifficulty(DEFAULT_DIFFICULTY_ID), persistence, onNewGame, onClose }) {
  const root = document.createElement('div');
  root.className = 'victory-content';
  root.append(
    createText('p', 'modal-description', `Все ${totalPairs} пар найдены`),
    createText('p', 'victory-difficulty', `Уровень: ${difficulty.label}`),
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

export function createLeaderboardContent({ results, persistence, difficultyId = DEFAULT_DIFFICULTY_ID, onDifficultyChange, onClose }) {
  const root = document.createElement('div');
  root.className = 'leaderboard-content';

  const label = createText('label', '', 'Рейтинг уровня');
  const select = document.createElement('select');
  select.className = 'difficulty-select leaderboard-difficulty';
  select.id = 'leaderboard-difficulty';
  label.htmlFor = select.id;
  for (const difficulty of difficulties) {
    const option = createText('option', '', `${difficulty.label} — ${difficulty.pairCount * 2}`);
    option.value = difficulty.id;
    select.append(option);
  }
  select.value = difficultyId;
  const controls = document.createElement('div');
  controls.className = 'leaderboard-controls';
  controls.append(label, select);
  const entries = document.createElement('div');
  entries.className = 'leaderboard-entries';
  entries.setAttribute('aria-live', 'polite');
  root.append(controls, entries);

  function renderResults(results, persistence) {
    entries.replaceChildren();
    if (results.length === 0) {
      entries.append(
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
      entries.append(table);
    }
    appendPersistenceMessage(entries, persistence);
  }
  renderResults(results, persistence);
  select.addEventListener('change', () => {
    if (typeof onDifficultyChange !== 'function') return;
    const next = onDifficultyChange(select.value);
    renderResults(next.results, next.persistence);
  });
  const actions = document.createElement('div');
  actions.className = 'modal-actions';
  actions.append(createAction('Закрыть', 'button-secondary', onClose));
  root.append(actions);
  return root;
}
