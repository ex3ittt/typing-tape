import { WORDS } from './words'

export interface Lesson {
  id: number
  title: string
  /** Letters introduced in this lesson. */
  adds: string
  /** Every letter allowed by now. */
  letters: string
  hint: string
}

const STEPS: [string, string, string][] = [
  ['ао', 'А и О', 'Указательные пальцы на А и О — на них выпуклые метки.'],
  ['вл', 'В и Л', 'Средние пальцы. Не поднимай указательные с меток.'],
  ['ыд', 'Ы и Д', 'Безымянные пальцы.'],
  ['фж', 'Ф и Ж', 'Мизинцы — самые слабые, не торопись.'],
  ['пр', 'П и Р', 'Указательные пальцы тянутся к центру.'],
  ['э', 'Э', 'Правый мизинец, ещё правее Ж.'],
  ['ен', 'Е и Н', 'Первый выход в верхний ряд: указательные вверх.'],
  ['кг', 'К и Г', 'Указательные пальцы, верхний ряд.'],
  ['уш', 'У и Ш', 'Средние пальцы, верхний ряд.'],
  ['цщ', 'Ц и Щ', 'Безымянные пальцы, верхний ряд.'],
  ['йзхъ', 'Й, З, Х и Ъ', 'Мизинцы в верхнем ряду.'],
  ['ми', 'М и И', 'Нижний ряд, левый указательный.'],
  ['ст', 'С и Т', 'Левый средний и правый указательный.'],
  ['бь', 'Б и Ь', 'Правый средний и правый указательный.'],
  ['чюя', 'Ч, Ю и Я', 'Безымянные и левый мизинец, нижний ряд.'],
  ['ё', 'Ё', 'Левый мизинец, самый верхний ряд.'],
]

export const LESSONS: Lesson[] = STEPS.reduce<Lesson[]>((acc, [adds, title, hint], i) => {
  const letters = (acc[i - 1]?.letters ?? '') + adds
  acc.push({ id: i + 1, title, adds, letters, hint })
  return acc
}, [])

/**
 * Builds an exercise of about `length` characters using only the allowed
 * letters. Real words come first; while a lesson has too few of them,
 * syllables built from the new letters fill in. New letters are favoured
 * so the lesson actually trains them.
 */
export function exercise(lesson: Lesson, length = 140, rand: () => number = Math.random): string {
  const allowed = new Set(lesson.letters)
  const words = WORDS.filter((w) => [...w].every((c) => allowed.has(c)))
  const fresh = words.filter((w) => [...lesson.adds].some((c) => w.includes(c)))
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]

  const syllable = () => {
    const n = 2 + Math.floor(rand() * 3)
    let s = ''
    for (let i = 0; i < n; i++) s += i % 2 === 0 ? pick([...lesson.adds]) : pick([...lesson.letters])
    return s
  }

  const out: string[] = []
  let size = 0
  let previous = ''
  while (size <= length) {
    let w: string
    const r = rand()
    if (fresh.length >= 3 && r < 0.6) w = pick(fresh)
    else if (words.length >= 6 && r < 0.9) w = pick(words)
    else w = syllable()
    if (w === previous) continue
    out.push(w)
    previous = w
    size += w.length + 1
  }
  return out.join(' ')
}
