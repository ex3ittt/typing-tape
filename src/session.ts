/**
 * One run through a text. Pure state: the UI feeds key presses and
 * timestamps in and reads progress and stats out.
 *
 * Mistakes don't advance the caret — you have to press the right key, the
 * way classic Russian typing courses work. Each wrong press is counted
 * against the character that was expected.
 */
export interface Session {
  text: string
  pos: number
  startedAt: number | null
  finishedAt: number | null
  /** Wrong presses per position. */
  wrongAt: number[]
  /** Wrong presses per expected character — for the keyboard heat map. */
  missed: Record<string, number>
  /** Times each character was expected — the denominator for the heat map. */
  seen: Record<string, number>
  lastWrong: boolean
}

export function start(text: string): Session {
  return { text, pos: 0, startedAt: null, finishedAt: null, wrongAt: Array(text.length).fill(0), missed: {}, seen: {}, lastWrong: false }
}

/** Normalises what a keyboard event may give: ё/е are distinct, quotes are not. */
function same(expected: string, typed: string): boolean {
  if (expected === typed) return true
  const quotes = '«»"„“”'
  return quotes.includes(expected) && quotes.includes(typed)
}

export function press(s: Session, ch: string, now: number): Session {
  if (s.finishedAt !== null || ch.length !== 1) return s
  const expected = s.text[s.pos]
  const startedAt = s.startedAt ?? now
  const seen = s.lastWrong ? s.seen : { ...s.seen, [expected]: (s.seen[expected] ?? 0) + 1 }
  if (!same(expected, ch)) {
    const wrongAt = [...s.wrongAt]
    wrongAt[s.pos]++
    return { ...s, startedAt, seen, wrongAt, missed: { ...s.missed, [expected]: (s.missed[expected] ?? 0) + 1 }, lastWrong: true }
  }
  const pos = s.pos + 1
  return { ...s, startedAt, seen, pos, lastWrong: false, finishedAt: pos === s.text.length ? now : null }
}

export interface Stats {
  /** Characters per minute — the Russian convention, not words per minute. */
  cpm: number
  accuracy: number // 0..100
  errors: number
  seconds: number
}

export function stats(s: Session, now: number): Stats {
  const end = s.finishedAt ?? now
  const seconds = s.startedAt === null ? 0 : (end - s.startedAt) / 1000
  const errors = s.wrongAt.reduce((a, b) => a + b, 0)
  const presses = s.pos + errors
  return {
    // Under two seconds the number jumps around too much to be useful.
    cpm: seconds < 2 ? 0 : Math.round((s.pos / seconds) * 60),
    accuracy: presses === 0 ? 100 : Math.round((s.pos / presses) * 1000) / 10,
    errors,
    seconds,
  }
}

/** Error rate per character, 0..1, for characters seen at least `min` times. */
export function heat(s: Pick<Session, 'missed' | 'seen'>, min = 2): Map<string, number> {
  const out = new Map<string, number>()
  for (const [ch, n] of Object.entries(s.seen)) {
    if (n >= min) out.set(ch.toLowerCase(), Math.min(1, (s.missed[ch] ?? 0) / n))
  }
  return out
}
