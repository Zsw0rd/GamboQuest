import crypto from 'crypto'

export function randomInt(max) {
  return crypto.randomInt(0, max)
}

export function randomIntRange(min, max) {
  return crypto.randomInt(min, max + 1)
}

/** 0..100 with 2 decimal precision */
export function randomRoll100() {
  return crypto.randomInt(0, 10001) / 100
}

export function shuffle(array) {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function pickUniquePositions(count, total) {
  const positions = new Set()
  while (positions.size < count) {
    positions.add(randomInt(total))
  }
  return [...positions]
}
