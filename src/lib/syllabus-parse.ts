// Syllabus → exams + due dates, entirely on-device with plain rules (no AI, no
// network, no cost). Feed it the syllabus TEXT (pasted, or pulled out of a PDF /
// photo by the native syllabus-reader module) and it returns candidate items for
// the review screen. It is deliberately forgiving: anything with a date AND an
// exam/deadline word is pre-ticked; a dated line with no such word is still
// offered, unticked, so a messy syllabus loses nothing — the student decides.

export type SyllabusKind = 'exam' | 'task';

export type SyllabusItem = {
  /** Stable key for list rendering. */
  key: string;
  kind: SyllabusKind;
  title: string;
  /** YYYY-MM-DD */
  dateISO: string;
  /** HH:MM (24h) when the line carried a time, else null. */
  time: string | null;
  /** Pre-ticked in review: the line had an exam/deadline keyword. */
  confident: boolean;
  /** The original line, shown small under the title so mistakes are easy to spot. */
  source: string;
};

export type ParseOptions = {
  /** Today as YYYY-MM-DD — anchors year inference. */
  todayISO: string;
  /** True when "3/4" means 3 April (most of the world); false = 4 March (US). */
  dayFirst: boolean;
};

// ── keywords (all 7 app languages: the syllabus is often not in the app language) ──
const EXAM_WORDS = [
  // en
  'exam', 'midterm', 'mid-term', 'final', 'quiz', 'test', 'assessment', 'oral',
  // es
  'examen', 'parcial', 'prueba', 'evaluación', 'evaluacion', 'control',
  // fr
  'examen', 'partiel', 'contrôle', 'controle', 'interro', 'épreuve', 'epreuve',
  // ja
  '試験', 'テスト', '小テスト', '中間', '期末',
  // ko
  '시험', '중간고사', '기말고사', '퀴즈', '테스트',
  // zh / zh-Hant
  '考试', '考試', '测验', '測驗', '期中', '期末', '小测', '小測',
];
const DUE_WORDS = [
  // en
  'due', 'deadline', 'assignment', 'homework', 'hw', 'essay', 'paper', 'project',
  'presentation', 'report', 'lab', 'submit', 'submission', 'problem set', 'pset',
  'draft', 'proposal', 'portfolio', 'reading response', 'worksheet',
  // es
  'entrega', 'tarea', 'trabajo', 'ensayo', 'proyecto', 'presentación', 'presentacion', 'informe', 'fecha límite', 'fecha limite',
  // fr
  'rendu', 'devoir', 'dissertation', 'projet', 'exposé', 'expose', 'rapport', 'à rendre', 'date limite',
  // ja
  '提出', '締切', '締め切り', '課題', '宿題', 'レポート', '発表',
  // ko
  '제출', '마감', '과제', '숙제', '보고서', '발표',
  // zh / zh-Hant
  '截止', '提交', '作业', '作業', '报告', '報告', '论文', '論文', '项目', '項目', '展示',
];

const CJK = /[぀-ヿ㐀-鿿가-힯]/;

function hasWord(line: string, words: string[]): boolean {
  const lower = line.toLowerCase();
  return words.some((w) => {
    if (CJK.test(w)) return lower.includes(w);
    // Whole-word match for Latin words so "test" doesn't fire on "contest",
    // "lab" on "syllabus", "due" on "residue".
    const re = new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
    return re.test(lower);
  });
}

// ── month names ──
const MONTHS: Record<string, number> = {};
const addMonths = (names: string[][]) =>
  names.forEach((variants, i) => variants.forEach((n) => { MONTHS[n] = i + 1; }));
addMonths([
  ['january', 'jan', 'enero', 'ene', 'janvier', 'janv'],
  ['february', 'feb', 'febrero', 'février', 'fevrier', 'févr', 'fevr', 'fév', 'fev'],
  ['march', 'mar', 'marzo', 'mars'],
  ['april', 'apr', 'abril', 'abr', 'avril', 'avr'],
  ['may', 'mayo', 'mai'],
  ['june', 'jun', 'junio', 'juin'],
  ['july', 'jul', 'julio', 'juillet', 'juil'],
  ['august', 'aug', 'agosto', 'ago', 'août', 'aout'],
  ['september', 'sep', 'sept', 'septiembre', 'septembre'],
  ['october', 'oct', 'octubre', 'octobre'],
  ['november', 'nov', 'noviembre', 'novembre'],
  ['december', 'dec', 'diciembre', 'dic', 'décembre', 'decembre', 'déc'],
]);
const MONTH_RE = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .map((m) => m.replace('.', '\\.'))
  .join('|');

type Found = { y: number | null; m: number; d: number; index: number; length: number };

const pad = (n: number) => String(n).padStart(2, '0');

function validDay(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Every date mentioned on a line, in order. */
function findDates(line: string, dayFirst: boolean): Found[] {
  const out: Found[] = [];
  const taken: [number, number][] = [];
  const push = (f: Found) => {
    if (taken.some(([a, b]) => f.index < b && f.index + f.length > a)) return;
    taken.push([f.index, f.index + f.length]);
    out.push(f);
  };
  const yr = (s: string | undefined) => {
    if (!s) return null;
    const n = parseInt(s, 10);
    return s.length === 2 ? 2000 + n : n;
  };
  let m: RegExpExecArray | null;

  // 2026-10-12 / 2026/10/12 / 2026.10.12
  const iso = /(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/g;
  while ((m = iso.exec(line))) push({ y: +m[1], m: +m[2], d: +m[3], index: m.index, length: m[0].length });

  // 2026年10月12日 / 10月12日 / 10月12号
  const cjk = /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号號]?/g;
  while ((m = cjk.exec(line))) push({ y: m[1] ? +m[1] : null, m: +m[2], d: +m[3], index: m.index, length: m[0].length });

  // 2026년 10월 12일 / 10월 12일
  const ko = /(?:(\d{4})\s*년\s*)?(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  while ((m = ko.exec(line))) push({ y: m[1] ? +m[1] : null, m: +m[2], d: +m[3], index: m.index, length: m[0].length });

  // October 12th, 2026 / Oct. 12 / Oct 12-14 (takes the first day)
  const md = new RegExp(`(?<![\\p{L}])(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d|:\\d)(?:\\s*[-–]\\s*\\d{1,2})?(?:,?\\s+(\\d{4}))?`, 'giu');
  while ((m = md.exec(line))) {
    const mo = MONTHS[m[1].toLowerCase().replace('.', '')];
    if (mo) push({ y: m[3] ? +m[3] : null, m: mo, d: +m[2], index: m.index, length: m[0].length });
  }

  // 12 October 2026 / 12 oct. / 12 de octubre de 2026 / le 12 octobre
  const dm = new RegExp(`(?<!\\d)(\\d{1,2})(?:er|st|nd|rd|th)?\\s+(?:de\\s+)?(${MONTH_RE})\\.?(?![\\p{L}])(?:\\s+(?:de\\s+)?(\\d{4}))?`, 'giu');
  while ((m = dm.exec(line))) {
    const mo = MONTHS[m[2].toLowerCase().replace('.', '')];
    if (mo) push({ y: m[3] ? +m[3] : null, m: mo, d: +m[1], index: m.index, length: m[0].length });
  }

  // 10/12, 10/12/26, 10-12-2026, 12.10.2026 — order from region, but a part > 12
  // settles it either way. Dashes/dots need a year: a bare "1-3" or "2-4pm" is a
  // range ("Ch. 1-3", office hours), not a date.
  const slash = /(?<![\d/.:-])(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?![\d/:])/g;
  const dashed = /(?<![\d/.:-])(\d{1,2})[.-](\d{1,2})[.-](\d{4}|\d{2})(?![\d/.:-])/g;
  for (const re of [slash, dashed]) {
    while ((m = re.exec(line))) {
      const a = +m[1];
      const b = +m[2];
      let mo: number;
      let d: number;
      if (a > 12 && b <= 12) { d = a; mo = b; }
      else if (b > 12 && a <= 12) { mo = a; d = b; }
      else if (dayFirst) { d = a; mo = b; }
      else { mo = a; d = b; }
      push({ y: yr(m[3]), m: mo, d, index: m.index, length: m[0].length });
    }
  }

  return out.sort((x, y) => x.index - y.index);
}

/** HH:MM from "2pm", "2:30 PM", "14:00", "14h30". */
function findTime(line: string): string | null {
  let m = /(?<!\d)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?(?![\p{L}])/iu.exec(line);
  if (m) {
    let h = +m[1] % 12;
    if (m[3].toLowerCase() === 'p') h += 12;
    const min = m[2] ? +m[2] : 0;
    if (h < 24 && min < 60) return `${pad(h)}:${pad(min)}`;
  }
  m = /(?<![\d/.])([01]?\d|2[0-3])[:h]([0-5]\d)(?!\d)/.exec(line);
  if (m) return `${pad(+m[1])}:${m[2]}`;
  return null;
}

function resolveYear(f: Found, todayISO: string): number {
  if (f.y) return f.y;
  const [ty, tm] = todayISO.split('-').map(Number);
  // A syllabus is for the coming term: a month that's more than ~2 months behind
  // today means next year (a January exam on a syllabus read in November).
  return f.m < tm - 2 ? ty + 1 : ty;
}

const WEEKDAY_WORDS = /\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day|nesday|rsday|urday)?\b\.?,?|\b(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b,?|[（(]?[月火水木金土日][曜]?[日]?[)）]|[（(][월화수목금토일][)）]|星期[一二三四五六日天]|週[一二三四五六日]|周[一二三四五六日]/giu;

function cleanTitle(line: string, dates: Found[]): string {
  let s = line;
  // Cut the date text out (right to left so indices stay valid).
  [...dates].sort((a, b) => b.index - a.index).forEach((f) => {
    s = s.slice(0, f.index) + ' ' + s.slice(f.index + f.length);
  });
  s = s
    .replace(/(?<!\d)\d{1,2}(?::\d{2})?\s*[ap]\.?\s*m\.?(?![\p{L}])/giu, ' ')
    .replace(/(?<![\d/.])([01]?\d|2[0-3])[:h][0-5]\d(?!\d)/g, ' ')
    .replace(WEEKDAY_WORDS, ' ')
    .replace(/\b(week|wk|semana|semaine)\s*\d+\b[:.]?/gi, ' ')
    .replace(/第\s*\d+\s*[周週回]|\d+\s*주차/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s*,(\s*,)+/g, ',')
    .replace(/\s+,/g, ',');
  // Strip leading bullets/numbers and dangling glue words at the end ("… due by").
  for (let k = 0; k < 4; k++) {
    s = s
      .replace(/^[\s\-–—•·*|:,.;)(\]\[#]+/, '')
      .replace(/[\s\-–—•·*|:,;(\[]+$/, '')
      .replace(/\s+(due|on|by|at|the|el|le|la|à|a las|before|on or before)$/i, '')
      .trim();
  }
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.length > 80 ? s.slice(0, 77).trimEnd() + '…' : s;
}

/** Parse syllabus text into review candidates, sorted by date. */
export function parseSyllabus(text: string, opts: ParseOptions): SyllabusItem[] {
  const rawLines = text
    .replace(/\r/g, '')
    .split(/\n|(?<=[.;])\s{2,}/)
    .map((l) => l.replace(/\t/g, '  ').trim())
    .filter(Boolean);

  const items: SyllabusItem[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const dates = findDates(line, opts.dayFirst);
    if (!dates.length) continue;

    // Table layouts often split "Oct 12" and "Midterm 1" across lines. If this line
    // is basically just a date, borrow the next line's text (when it has no date).
    let text = line;
    let title = cleanTitle(line, dates);
    if (title.replace(/[^\p{L}]/gu, '').length < 2 && i + 1 < rawLines.length && !findDates(rawLines[i + 1], opts.dayFirst).length) {
      text = `${line} ${rawLines[i + 1]}`;
      title = cleanTitle(rawLines[i + 1], []);
      i++;
    }
    if (title.replace(/[^\p{L}]/gu, '').length < 2) continue;

    const isExam = hasWord(text, EXAM_WORDS);
    const isDue = hasWord(text, DUE_WORDS);
    // "Final project due" is a deadline, not an exam — due words win over a bare
    // "final" unless a stronger exam word is present.
    const strongExam = isExam && !(isDue && /\bfinal\b/i.test(text) && !hasWord(text, EXAM_WORDS.filter((w) => w !== 'final')));
    const kind: SyllabusKind = strongExam ? 'exam' : 'task';
    const time = findTime(text);

    // A range "Oct 12 – Oct 14" is one item on its first date; a line listing two
    // separate items ("Quiz 1 Oct 3, Quiz 2 Oct 17") is rare enough to take the first.
    const f = dates[0];
    const y = resolveYear(f, opts.todayISO);
    if (!validDay(y, f.m, f.d)) continue;
    const dateISO = `${y}-${pad(f.m)}-${pad(f.d)}`;

    const dedupe = `${dateISO}|${title.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    items.push({
      key: `${i}_${dateISO}`,
      kind,
      title,
      dateISO,
      time,
      confident: isExam || isDue,
      source: text.length > 120 ? text.slice(0, 117) + '…' : text,
    });
  }

  return items.sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}
