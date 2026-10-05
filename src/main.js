import { cards, backImageUrl } from './game/cards.js';
import { createGame } from './game/engine.js';
import { createAppView } from './ui/app-view.js';

const game = createGame({
  pairIds: cards.map((card) => card.pairId),
  onChange: (snapshot) => view.render(snapshot),
});

const view = createAppView({
  cards,
  backImageUrl,
  onCard: (cardId) => game.choose(cardId),
  onNewGame: () => game.restart(),
});

game.restart();
