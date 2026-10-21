import './style.css'
import { FINGER_NAMES, keyFor, ROWS, shiftSide } from './layout'
import { exercise, LESSONS } from './lessons'
import { heat, press, start, stats, type Session } from './session'
import { TEXTS } from './words'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const track = $('track')
const tapeWrap = $('tape-wrap')

const FREE = 0 // lesson id for free text

interface Best {
  cpm: number
  accuracy: number
}

const store = {
  get(): Record<number, Best> {
    try {
      return JSON.parse(localStorage.getItem('tape:best') ?? '{}')
    } catch {
      return {}
    }
  },
  save(id: number, r: Best): void {
    try {
      const all = store.get()
      if (!all[id] || r.cpm > all[id].cpm) localStorage.setItem('tape:best', JSON.stringify({ ...all, [id]: r }))
    } catch {
      // Private mode: results just aren't remembered.
    }
  },
}

let lessonId = 1
let session: Session = start('')
let spans: HTMLSpanElement[] = []
let charWidth = 24
let ticker = 0

// ── keyboard drawing ────────────────────────────────────────────────────

const caps = new Map<string, HTMLElement>()
const shifts: Record<'left' | 'right', HTMLElement | null> = { left: null, right: null }

function drawKeyboard(): void {
  const kb = $('keyboard')
  const extras: [string, string][] = [['', ''], ['Tab', ''], ['Caps', 'Enter'], ['Shift', 'Shift']]
  ROWS.forEach((row, r) => {
    const el = document.createElement('div')
    el.className = 'krow'
    const [before, after] = extras[r]
    if (before) el.append(cap(before, 'wide', r === 3 ? 'left' : undefined))
    for (const k of row) {
      const c = cap(k.char === 'ё' || /\d|[-=.]/.test(k.char) ? k.char : k.char.toUpperCase(), k.home ? 'home' : '')
      caps.set(k.char, c)
      el.append(c)
    }
    if (after) el.append(cap(after, 'wide', r === 3 ? 'right' : undefined))
    kb.append(el)
  })
  const bottom = document.createElement('div')
  bottom.className = 'krow'
  const space = cap('', 'space')
  caps.set(' ', space)
  bottom.append(cap('', 'wide'), space, cap('', 'wide'))
  kb.append(bottom)

  function cap(label: string, cls: string, shiftSlot?: 'left' | 'right'): HTMLElement {
    const c = document.createElement('div')
    c.className = `cap ${cls}`.trim()
    c.textContent = label
    if (shiftSlot) shifts[shiftSlot] = c
    return c
  }
}

function clearKeyboard(): void {
  for (const c of caps.values()) {
    c.classList.remove('target')
    c.style.background = ''
    c.style.color = ''
  }
  shifts.left?.classList.remove('shift-target')
  shifts.right?.classList.remove('shift-target')
}

function highlightNext(): void {
  clearKeyboard()
  const ch = session.text[session.pos]
  const k = ch === undefined ? null : keyFor(ch)
  if (!k) {
    $('next-key').textContent = ''
    return
  }
  caps.get(k.key.char)?.classList.add('target')
  if (k.shift) shifts[shiftSide(k.key.finger)]?.classList.add('shift-target')
  const label = ch === ' ' ? 'пробел' : ch
  $('next-key').innerHTML = `Сейчас: <b>${label}</b> — ${FINGER_NAMES[k.key.finger]}${k.shift ? ', Shift другой рукой' : ''}`
}

/** After a run: tint each key from slate to red by its error rate. */
function showHeat(): void {
  clearKeyboard()
  const h = heat(session)
  for (const [ch, rate] of h) {
    // «,» lives on the «.» key, capitals on their letters.
    const c = caps.get(keyFor(ch)?.key.char ?? ch)
    if (!c || rate === 0) continue
    c.style.background = `color-mix(in srgb, var(--wrong) ${Math.round(20 + rate * 80)}%, var(--cap))`
    c.style.color = '#fff'
  }
  $('next-key').textContent = ''
}

// ── tape ────────────────────────────────────────────────────────────────

function renderTape(): void {
  track.innerHTML = ''
  spans = [...session.text].map((ch) => {
    const s = document.createElement('span')
    s.textContent = ch
    if (ch === ' ') s.classList.add('space')
    track.append(s)
    return s
  })
  charWidth = spans[0]?.getBoundingClientRect().width || charWidth
  updateTape(false)
}

function updateTape(wrong: boolean): void {
  const i = session.pos
  const prev = spans[i - 1]
  if (prev && !prev.classList.contains('done')) {
    prev.classList.remove('now', 'wrong')
    prev.classList.add('done')
    if (session.wrongAt[i - 1] > 0) prev.classList.add('had-error')
  }
  const cur = spans[i]
  if (cur) {
    cur.classList.add('now')
    cur.classList.toggle('wrong', wrong)
    if (wrong) {
      // Restart the nudge animation on every wrong press.
      cur.style.animation = 'none'
      void cur.offsetWidth
      cur.style.animation = ''
    }
  }
  // The caret stays put; the tape slides under it.
  track.style.translate = `${-i * charWidth}px 0`
  highlightNext()
}

// ── stats ───────────────────────────────────────────────────────────────

function renderStats(): void {
  const s = stats(session, performance.now())
  $('cpm').textContent = String(s.cpm)
  $('acc').textContent = s.accuracy.toLocaleString('ru-RU')
  $('err').textContent = String(s.errors)
}

const KEY_NAMES: Record<string, string> = { ' ': 'пробел', '.': 'точка', ',': 'запятая', '-': 'дефис', '!': 'восклицательный знак', '?': 'вопросительный знак' }

function worstKeys(): string[] {
  return [...heat(session)]
    .filter(([, r]) => r >= 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ch]) => (KEY_NAMES[ch] ? `«${KEY_NAMES[ch]}»` : ch.toUpperCase()))
}

function finish(): void {
  clearInterval(ticker)
  const s = stats(session, session.finishedAt!)
  store.save(lessonId, { cpm: s.cpm, accuracy: s.accuracy })
  renderLessons()
  showHeat()
  const worst = worstKeys()
  $('result-line').textContent = `${s.cpm} знаков в минуту, точность ${s.accuracy.toLocaleString('ru-RU')} %`
  $('result-note').textContent = worst.length
    ? `Больше всего ошибок на ${worst.length > 1 ? 'клавишах' : 'клавише'} ${worst.join(', ')} — ${worst.length > 1 ? 'они подсвечены' : 'она подсвечена'} на клавиатуре.`
    : s.errors === 0
      ? 'Ни одной ошибки.'
      : 'Ошибки разбросаны по разным клавишам — ни одна не выделяется.'
  $('next').hidden = lessonId === FREE || lessonId === LESSONS.length
  $('result').hidden = false
  $('sr').textContent = $('result-line').textContent
  ;($(lessonId === FREE || lessonId === LESSONS.length ? 'again' : 'next') as HTMLButtonElement).focus()
}

// ── lessons ─────────────────────────────────────────────────────────────

function renderLessons(): void {
  const best = store.get()
  const nav = $('lessons')
  nav.innerHTML = ''
  const add = (id: number, label: string, title: string, cls = '') => {
    const b = document.createElement('button')
    b.textContent = label
    b.title = title + (best[id] ? ` — лучший результат ${best[id].cpm} зн/мин` : '')
    b.className = `${cls}${best[id] ? ' done' : ''}`.trim()
    b.setAttribute('aria-current', String(id === lessonId))
    b.addEventListener('click', () => load(id))
    nav.append(b)
  }
  for (const l of LESSONS) add(l.id, String(l.id), `Урок ${l.id}: ${l.title}`)
  add(FREE, 'Свободный текст', 'Связный текст с заглавными буквами и знаками препинания', 'free')
}

function load(id: number): void {
  lessonId = id
  clearInterval(ticker)
  $('result').hidden = true
  const lesson = LESSONS.find((l) => l.id === id)
  const text = lesson ? exercise(lesson, 150) : TEXTS[Math.floor(Math.random() * TEXTS.length)]
  $('lesson-hint').innerHTML = lesson
    ? `Урок ${lesson.id} — <b>${lesson.title}</b>. ${lesson.hint}`
    : 'Свободный текст: заглавные буквы, запятые и точки. Shift нажимай мизинцем противоположной руки.'
  session = start(text)
  renderLessons()
  renderTape()
  renderStats()
  tapeWrap.focus()
}

// ── input ───────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === 'Escape') {
    load(lessonId)
    return
  }
  if (!$('result').hidden) return
  if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
  if (e.key.length !== 1) return
  e.preventDefault()
  $('layout-warning').hidden = !/[a-z]/i.test(e.key)
  const before = session.pos
  const wasStarted = session.startedAt !== null
  session = press(session, e.key, performance.now())
  if (!wasStarted && session.startedAt !== null) ticker = window.setInterval(renderStats, 250)
  updateTape(session.pos === before)
  renderStats()
  if (session.finishedAt !== null) finish()
})

$('again').addEventListener('click', () => load(lessonId))
$('next').addEventListener('click', () => load(Math.min(LESSONS.length, lessonId + 1)))
window.addEventListener('resize', () => {
  charWidth = spans[0]?.getBoundingClientRect().width || charWidth
  track.style.translate = `${-session.pos * charWidth}px 0`
})

drawKeyboard()
document.fonts.ready.then(() => load(1))
