import { getDifficulty } from './difficulty.js';

export const cards = [
  {
    pairId: 'astromech',
    animated: true,
    label: 'Купольный астродроид',
    imageUrl: './public/assets/images/cards/astromech.svg',
  },
  {
    pairId: 'protocol-droid',
    animated: true,
    label: 'Протокольный дроид',
    imageUrl: './public/assets/images/cards/protocol-droid.svg',
  },
  {
    pairId: 'trooper-helmet',
    animated: true,
    label: 'Белый шлем солдата',
    imageUrl: './public/assets/images/cards/trooper-helmet.svg',
  },
  {
    pairId: 'dark-helmet',
    animated: true,
    label: 'Тёмный шлем',
    imageUrl: './public/assets/images/cards/dark-helmet.svg',
  },
  {
    pairId: 'lightsaber',
    animated: true,
    label: 'Световой меч',
    imageUrl: './public/assets/images/cards/lightsaber.svg',
  },
  {
    pairId: 'starfighter',
    animated: true,
    label: 'Крылатый истребитель',
    imageUrl: './public/assets/images/cards/starfighter.svg',
  },
  {
    pairId: 'freighter',
    animated: true,
    label: 'Круглый грузовой корабль',
    imageUrl: './public/assets/images/cards/freighter.svg',
  },
  {
    pairId: 'space-station',
    animated: true,
    label: 'Космическая станция',
    imageUrl: './public/assets/images/cards/space-station.svg',
  },
  {
    pairId: 'yoda',
    label: 'Йода',
    imageUrl: './public/assets/images/cards/yoda.svg',
  },
  {
    pairId: 'chewbacca',
    label: 'Чубакка',
    imageUrl: './public/assets/images/cards/chewbacca.svg',
  },
  {
    pairId: 'leia',
    label: 'Лея',
    imageUrl: './public/assets/images/cards/leia.svg',
  },
  {
    pairId: 'darth-maul',
    label: 'Дарт Мол',
    imageUrl: './public/assets/images/cards/darth-maul.svg',
  },
  {
    pairId: 'luke',
    label: 'Люк',
    imageUrl: './public/assets/images/cards/luke.svg',
  },
  {
    pairId: 'han-solo',
    label: 'Хан Соло',
    imageUrl: './public/assets/images/cards/han-solo.svg',
  },
  {
    pairId: 'boba-fett',
    label: 'Боба Фетт',
    imageUrl: './public/assets/images/cards/boba-fett.svg',
  },
  {
    pairId: 'ahsoka',
    label: 'Асока',
    imageUrl: './public/assets/images/cards/ahsoka.svg',
  },
  {
    pairId: 'obi-wan',
    label: 'Оби-Ван',
    imageUrl: './public/assets/images/cards/obi-wan.svg',
  },
  {
    pairId: 'palpatine',
    label: 'Палпатин',
    imageUrl: './public/assets/images/cards/palpatine.svg',
  },
  {
    pairId: 'grievous',
    label: 'Гривус',
    imageUrl: './public/assets/images/cards/grievous.svg',
  },
  {
    pairId: 'jawa',
    label: 'Джава',
    imageUrl: './public/assets/images/cards/jawa.svg',
  },
];

export const backImageUrl = './public/assets/images/cards/card-back.svg';

// Level membership depends on these IDs, never on catalog insertion order.
export const cardOrder = Object.freeze([
  'astromech', 'protocol-droid', 'trooper-helmet', 'dark-helmet',
  'lightsaber', 'starfighter', 'freighter', 'space-station',
  'yoda', 'chewbacca', 'leia', 'darth-maul',
  'luke', 'han-solo', 'boba-fett', 'ahsoka',
  'obi-wan', 'palpatine', 'grievous', 'jawa',
]);

export function getCardsForDifficulty(difficultyId, catalog = cards) {
  const { pairCount } = getDifficulty(difficultyId);
  return cardOrder.slice(0, pairCount).map((pairId) => {
    const matches = catalog.filter((card) => card.pairId === pairId);
    if (matches.length !== 1) {
      throw new RangeError('Difficulty requires exactly one catalog entry: ' + pairId);
    }
    return { ...matches[0] };
  });
}
