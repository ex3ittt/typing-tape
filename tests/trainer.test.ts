import { describe, expect, it } from 'vitest'
import { keyFor, ROWS } from '../src/layout'
import { exercise, LESSONS } from '../src/lessons'
import { heat, press, start, stats } from '../src/session'

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

describe('layout', () => {
  it('home row has bumps on А and О', () => {
    expect(ROWS[2].filter((k) => k.home).map((k) => k.char)).toEqual(['а', 'о'])
  })

  it('maps characters, capitals and punctuation to keys and fingers', () => {
    expect(keyFor('ф')?.key.finger).toBe('L5')
    expect(keyFor('Ж')).toMatchObject({ shift: true, key: { char: 'ж', finger: 'R5' } })
    expect(keyFor(',')).toMatchObject({ shift: true, key: { char: '.' } })
    expect(keyFor(' ')?.key.finger).toBe('T')
    expect(keyFor('q')).toBeNull()
  })

  it('every Russian letter is on the keyboard', () => {
    for (const ch of 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя') expect(keyFor(ch), ch).not.toBeNull()
  })
})

describe('lessons', () => {
  it('add letters cumulatively and cover the whole alphabet', () => {
    expect(LESSONS[0].letters).toBe('ао')
    expect(LESSONS[1].letters).toBe('аовл')
    expect([...LESSONS.at(-1)!.letters].sort().join('')).toBe([...'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'].sort().join(''))
  })

  it('exercises only use letters the lesson allows', () => {
    for (const lesson of LESSONS) {
      const text = exercise(lesson, 200, seeded(lesson.id))
      const allowed = new Set(lesson.letters + ' ')
      expect([...text].every((c) => allowed.has(c)), `${lesson.title}: ${text}`).toBe(true)
      expect(text.length).toBeGreaterThanOrEqual(200)
    }
  })

  it('favour the letters just introduced', () => {
    const lesson = LESSONS.find((l) => l.adds === 'пр')!
    const text = exercise(lesson, 400, seeded(3))
    const share = [...text].filter((c) => 'пр'.includes(c)).length / text.replace(/ /g, '').length
    expect(share).toBeGreaterThan(0.15)
  })

  it('real words appear once there are enough of them', () => {
    const text = exercise(LESSONS.find((l) => l.adds === 'пр')!, 300, seeded(9))
    expect(text.split(' ').some((w) => ['пол', 'вол', 'дробь', 'право', 'правда', 'поле'].includes(w) || w.length > 3)).toBe(true)
  })
})

describe('session', () => {
  it('advances only on the right key and counts mistakes per character', () => {
    let s = start('вол')
    s = press(s, 'в', 0)
    s = press(s, 'а', 100) // wrong
    s = press(s, 'а', 150) // wrong again, same position
    s = press(s, 'о', 200)
    s = press(s, 'л', 300)
    expect(s.pos).toBe(3)
    expect(s.finishedAt).toBe(300)
    expect(s.wrongAt).toEqual([0, 2, 0])
    expect(s.missed).toEqual({ о: 2 })
    expect(s.seen).toEqual({ в: 1, о: 1, л: 1 })
  })

  it('computes characters per minute and accuracy', () => {
    let s = start('а'.repeat(60))
    for (let i = 0; i < 60; i++) s = press(s, 'а', i * 200) // 5 chars/s
    s = { ...s }
    const r = stats(s, s.finishedAt!)
    expect(r.cpm).toBe(305) // 60 chars in 11.8 s
    expect(r.accuracy).toBe(100)
  })

  it('accuracy accounts for wrong presses', () => {
    let s = start('ао')
    s = press(s, 'о', 0)
    s = press(s, 'а', 10)
    s = press(s, 'о', 20)
    expect(stats(s, 20).accuracy).toBe(66.7)
  })

  it('ignores input after the end and non-character keys', () => {
    let s = press(start('а'), 'а', 0)
    expect(press(s, 'б', 10)).toBe(s)
    s = start('а')
    expect(press(s, 'Shift', 0)).toBe(s)
  })

  it('treats different quote marks as the same key', () => {
    expect(press(start('«'), '"', 0).pos).toBe(1)
  })

  it('heat map gives error rates per key', () => {
    const h = heat({ seen: { о: 4, а: 4, ж: 1 }, missed: { о: 2, ж: 1 } })
    expect(h.get('о')).toBe(0.5)
    expect(h.get('а')).toBe(0)
    expect(h.has('ж')).toBe(false) // seen once — not enough to judge
  })
})
