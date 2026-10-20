export type Direction = 'de-ru' | 'ru-de';

export type Word = {
  id: string;
  de: string;
  ru: string;
  answer: string;
  errorCount: number;
  errorCounted: boolean;
};

export type AppState = {
  words: Word[];
  showDe: boolean;
  showRu: boolean;
  mode: Direction;
};

export const STORAGE_KEY = 'wortgarten:data:v1';

const starterWords = [
  { de: 'der Tisch', ru: 'стол' },
  { de: 'das Haus', ru: 'дом' },
  { de: 'lernen', ru: 'учить' },
  { de: 'die Katze', ru: 'кошка' },
  { de: 'schön', ru: 'красивый' },
  { de: 'sprechen', ru: 'говорить' },
  { de: 'das Wasser', ru: 'вода' },
  { de: 'gut', ru: 'хорошо' },
];

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'w-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export function createWord(de: string, ru: string): Word {
  return {
    id: createId(),
    de,
    ru,
    answer: '',
    errorCount: 0,
    errorCounted: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeStoredWord(value: unknown): Word | null {
  if (!isRecord(value) || typeof value.de !== 'string' || typeof value.ru !== 'string') {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : createId(),
    de: value.de,
    ru: value.ru,
    answer: typeof value.answer === 'string' ? value.answer : '',
    errorCount:
      typeof value.errorCount === 'number' && Number.isFinite(value.errorCount)
        ? Math.max(0, value.errorCount)
        : 0,
    errorCounted: value.errorCounted === true,
  };
}

function makeStarterState(): AppState {
  return {
    words: starterWords.map((word) => createWord(word.de, word.ru)),
    showDe: true,
    showRu: true,
    mode: 'de-ru',
  };
}

export function loadAppState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeStarterState();

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.words)) return makeStarterState();

    const words = parsed.words
      .map(normalizeStoredWord)
      .filter((word): word is Word => word !== null);

    return {
      words,
      showDe: parsed.showDe !== false,
      showRu: parsed.showRu !== false,
      mode: parsed.mode === 'ru-de' ? 'ru-de' : 'de-ru',
    };
  } catch {
    return makeStarterState();
  }
}

export function getAnswerStatus(word: Word, mode: Direction) {
  const answer = word.answer.trim().toLocaleLowerCase();
  if (answer === '') return 'empty';

  const expected = (mode === 'de-ru' ? word.ru : word.de)
    .trim()
    .toLocaleLowerCase();

  return answer === expected ? 'correct' : 'incorrect';
}

export function parseWordLines(text: string): Array<{ de: string; ru: string }> {
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const clean = line.trim();
      if (!clean) return [];

      const parts = clean.split(/[-:—,\t]/);
      const de = parts[0]?.trim() ?? '';
      const ru = parts.slice(1).join('-').trim();

      return de && ru ? [{ de, ru }] : [];
    });
}
