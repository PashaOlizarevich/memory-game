import { createMusicControl } from '../src/ui/music-control.js';
import { createAppView } from '../src/ui/app-view.js';
import { cards, backImageUrl } from '../src/game/cards.js';
import { createInitialState } from '../src/game/state.js';

export async function runMusicControlTests() {
  const passed = [];
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const control = createMusicControl({ source: './public/assets/audio/star-wars-theme.mp3' });
  document.body.append(control.root);
  const button = control.root.querySelector('button');
  const audio = control.root.querySelector('audio');
  const status = control.root.querySelector('[role="status"]');
  let playCalls = 0;
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  try {
    assert(audio.paused && !audio.autoplay && audio.preload === 'none', 'Music must start off without preloading');
    assert(audio.loop && audio.volume === 0.2, 'Music must loop at low volume');
    assert(button.getAttribute('aria-pressed') === 'false', 'Initial toggle must be accessible');
    passed.push('initial silence, deferred loading and low-volume loop');

    audio.play = () => {
      playCalls += 1;
      return Promise.reject(new DOMException('Playback denied', 'NotAllowedError'));
    };
    button.click();
    await tick();
    assert(playCalls === 1 && !button.disabled && button.getAttribute('aria-pressed') === 'false',
      'Rejected playback must restore the off toggle');
    assert(status.textContent.includes('Не удалось'), 'Playback failure must have a visible status');
    passed.push('playback rejection is handled and announced without breaking the control');

    let finishPlay;
    audio.play = () => {
      playCalls += 1;
      return new Promise((resolve) => { finishPlay = resolve; });
    };
    button.click();
    button.click();
    assert(playCalls === 2 && button.disabled && status.textContent === '',
      'Retry must clear the error and ignore duplicate clicks while starting');
    finishPlay();
    await tick();
    assert(!button.disabled, 'Settled playback must release the button');
    passed.push('retry clears the error and pending start ignores duplicate clicks');

    button.click();
    const detachedText = control.root.textContent;
    control.destroy();
    finishPlay();
    await tick();
    control.destroy();
    button.click();
    assert(playCalls === 3 && !control.root.isConnected && !audio.hasAttribute('src') && audio.paused,
      'Destroy must stop and release media and remove handlers');
    assert(control.root.textContent === detachedText, 'Late play completion must not update destroyed controls');
    passed.push('destroy during pending play releases media and ignores late completion');
  } finally {
    control.destroy();
  }

  const view = createAppView({
    cards, backImageUrl, onCard: () => {}, onNewGame: () => {}, onLeaderboard: () => {},
    musicUrl: './public/assets/audio/star-wars-theme.mp3',
  });
  try {
    const originalAudio = view.root.querySelector('audio');
    const originalControl = view.root.querySelector('.music-control');
    for (const roundId of [1, 2]) {
      view.render(createInitialState({ pairIds: cards.map((card) => card.pairId), roundId }));
    }
    assert(originalAudio === view.root.querySelector('audio') && originalControl === view.root.querySelector('.music-control'),
      'Round renders must preserve the media and its controls');
    view.destroy();
    assert(originalAudio.paused && !originalAudio.hasAttribute('src'), 'View destroy must release music');
    passed.push('new rounds preserve the audio instance and view destroy releases it');
  } finally {
    view.destroy();
  }
  return { passed };
}
