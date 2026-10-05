import { cards, backImageUrl } from './game/cards.js';
import { createGame } from './game/engine.js';
import { createAppView } from './ui/app-view.js';
import { createModal } from './ui/modal.js';
import { createVictoryContent, createLeaderboardContent } from './ui/modal-content.js';
import { createLeaderboardStore } from './storage/leaderboard.js';

const store = createLeaderboardStore();
let handledRoundId = null;

const game = createGame({
  pairIds: cards.map((card) => card.pairId),
  onChange: (snapshot, event) => {
    view.render(snapshot);
    if (event !== 'finished' || handledRoundId === snapshot.roundId) return;

    handledRoundId = snapshot.roundId;
    const { persistence } = store.addResult({
      moves: snapshot.moves,
      completedAt: snapshot.completedAt,
    });
    modal.open({
      title: 'Сила памяти с вами!',
      content: createVictoryContent({
        moves: snapshot.moves,
        persistence,
        onNewGame: startNewGame,
        onClose: () => modal.close(),
      }),
      returnFocus: view.getNewGameButton(),
    });
  },
});

const view = createAppView({
  cards,
  backImageUrl,
  onCard: (cardId) => {
    if (!modal.isOpen()) game.choose(cardId);
  },
  onNewGame: startNewGame,
  onLeaderboard: () => {
    const returnFocus = view.root.querySelector('.app-header .button-secondary');
    const { results, persistence } = store.getResults();
    modal.open({
      title: 'Таблица лидеров',
      content: createLeaderboardContent({
        results,
        persistence,
        onClose: () => modal.close(),
      }),
      returnFocus,
    });
  },
});

const modal = createModal({ backgroundRoot: view.root });

function startNewGame() {
  modal.close();
  game.restart();
}

store.getResults();
game.restart();
