export function createCrawlBackground() {
  const root = document.createElement('div');
  root.className = 'crawl-background';
  root.setAttribute('aria-hidden', 'true');

  const text = document.createElement('div');
  text.className = 'crawl-text';
  const roll = document.createElement('div');
  roll.className = 'crawl-roll';

  const paragraphs = [
    'В далёкой галактике среди звёзд затерялись образы кораблей, дроидов и героев. Только сила памяти способна собрать их вновь.',
    'Перед вами шестнадцать карточек. За каждой скрывается знакомый силуэт. Открывайте их по две, запоминайте расположение и находите пары.',
    'Каждый ход приближает вас к разгадке. Сохраняйте спокойствие, доверяйте своей памяти и отыщите все восемь пар.',
    'Новая миссия начинается с нового порядка карточек. Да прибудет с вами сила!',
  ];
  // Identical passes make the repeat seamless without resetting on game renders.
  for (let index = 0; index < 2; index += 1) {
    const pass = document.createElement('div');
    pass.className = 'crawl-pass';
    const episode = document.createElement('p');
    episode.className = 'crawl-episode';
    episode.textContent = 'Эпизод VIII';
    const title = document.createElement('p');
    title.className = 'crawl-title';
    title.textContent = 'ГАЛАКТИЧЕСКАЯ ПАМЯТЬ';
    pass.append(episode, title);
    for (const paragraph of paragraphs) {
      const element = document.createElement('p');
      element.textContent = paragraph;
      pass.append(element);
    }
    roll.append(pass);
  }

  text.append(roll);
  root.append(text);
  return root;
}
