import { cards, getCardsForDifficulty, backImageUrl } from './game/cards.js';
import { DEFAULT_DIFFICULTY_ID, getDifficulty } from './game/difficulty.js';
import { createGame } from './game/engine.js';
import { createAppView } from './ui/app-view.js';
import { createModal } from './ui/modal.js';
import { createVictoryContent, createLeaderboardContent } from './ui/modal-content.js';
import { createLeaderboardStore } from './storage/leaderboard.js';

let activeDifficultyId = DEFAULT_DIFFICULTY_ID;
const initialCards = getCardsForDifficulty(activeDifficultyId);
const store = createLeaderboardStore();
let handledRoundId = null;

const game = createGame({
  pairIds: initialCards.map((card) => card.pairId),
  onChange: (snapshot, event) => {
    view.render(snapshot, activeDifficultyId);
    if (event !== 'finished' || handledRoundId === snapshot.roundId) return;

    handledRoundId = snapshot.roundId;
    const { persistence } = store.addResult({
      difficultyId: activeDifficultyId,
      moves: snapshot.moves,
      completedAt: snapshot.completedAt,
    });
    modal.open({
      title: 'Сила памяти с вами!',
      content: createVictoryContent({
        moves: snapshot.moves,
        totalPairs: snapshot.totalPairs,
        difficulty: getDifficulty(activeDifficultyId),
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
  musicUrl: './public/assets/audio/star-wars-theme.mp3',
  onCard: (cardId) => {
    if (!modal.isOpen()) game.choose(cardId);
  },
  onNewGame: startNewGame,
  onStartGame: startSelectedGame,
  onLeaderboard: () => {
    const returnFocus = view.root.querySelector('.app-header .button-secondary');
    const { results, persistence } = store.getResults(activeDifficultyId);
    modal.open({
      title: 'Таблица лидеров',
      content: createLeaderboardContent({
        results,
        persistence,
        difficultyId: activeDifficultyId,
        onDifficultyChange: (id) => store.getResults(id),
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

function startSelectedGame(difficultyId) {
  const selectedCards = getCardsForDifficulty(difficultyId);
  modal.close();
  activeDifficultyId = difficultyId;
  game.restart({ pairIds: selectedCards.map((card) => card.pairId) });
}

store.getResults(activeDifficultyId);
game.restart();
