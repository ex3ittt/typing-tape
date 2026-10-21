/** Fingers, left little to right little; thumbs share the space bar. */
export type Finger = 'L5' | 'L4' | 'L3' | 'L2' | 'R2' | 'R3' | 'R4' | 'R5' | 'T'

export interface Key {
  char: string
  shift: string
  finger: Finger
  /** The key the finger rests on: А and О have the bumps. */
  home?: boolean
}

const F: Finger[] = ['L5', 'L4', 'L3', 'L2', 'L2', 'R2', 'R2', 'R3', 'R4', 'R5', 'R5', 'R5']

function row(chars: string, shifted: string, fingers: Finger[], homes = ''): Key[] {
  return [...chars].map((c, i) => ({ char: c, shift: shifted[i], finger: fingers[i], home: homes.includes(c) || undefined }))
}

/** ЙЦУКЕН as on a Russian PC keyboard (Windows/macOS «Русская — ПК»). */
export const ROWS: Key[][] = [
  row('ё1234567890-=', 'Ё!"№;%:?*()_+', ['L5', 'L5', 'L4', 'L3', 'L2', 'L2', 'R2', 'R2', 'R3', 'R4', 'R5', 'R5', 'R5']),
  row('йцукенгшщзхъ', 'ЙЦУКЕНГШЩЗХЪ', F),
  row('фывапролджэ', 'ФЫВАПРОЛДЖЭ', F.slice(0, 11), 'ао'),
  row('ячсмитьбю.', 'ЯЧСМИТЬБЮ,', F.slice(0, 10)),
]

const BY_CHAR = new Map<string, { key: Key; shift: boolean }>()
for (const r of ROWS) for (const k of r) {
  BY_CHAR.set(k.char, { key: k, shift: false })
  BY_CHAR.set(k.shift, { key: k, shift: true })
}

export function keyFor(ch: string): { key: Key; shift: boolean } | null {
  if (ch === ' ') return { key: { char: ' ', shift: ' ', finger: 'T' }, shift: false }
  return BY_CHAR.get(ch) ?? null
}

/** Capitals are typed with the opposite hand's little finger on Shift. */
export function shiftSide(finger: Finger): 'left' | 'right' {
  return finger.startsWith('L') ? 'right' : 'left'
}

export const FINGER_NAMES: Record<Finger, string> = {
  L5: 'левый мизинец',
  L4: 'левый безымянный',
  L3: 'левый средний',
  L2: 'левый указательный',
  R2: 'правый указательный',
  R3: 'правый средний',
  R4: 'правый безымянный',
  R5: 'правый мизинец',
  T: 'большой палец',
}
