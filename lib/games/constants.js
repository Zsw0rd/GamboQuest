export const SLOT_SYMBOLS = [
  { name: 'Triple Diamonds', id: 'triple_diamonds', threeOfKindPayout: 50, twoOfKindPayout: 0 },
  { name: 'Diamond', id: 'diamond', threeOfKindPayout: 25, twoOfKindPayout: 0 },
  { name: 'Coins', id: 'coins', threeOfKindPayout: 10, twoOfKindPayout: 0 },
  { name: 'Apple', id: 'apple', threeOfKindPayout: 4, twoOfKindPayout: 1.5 },
  { name: 'Mango', id: 'mango', threeOfKindPayout: 2, twoOfKindPayout: 1.3 },
]

export const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6,
  27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
  16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
]

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36])

export const MINES_BASE_MULTIPLIER = { 3: 1.2, 5: 1.5, 10: 2.0 }

export const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
export const CARD_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
