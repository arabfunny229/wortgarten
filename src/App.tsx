import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import WordRow from './components/WordRow';
import {
  createWord,
  getAnswerStatus,
  loadAppState,
  parseWordLines,
  STORAGE_KEY,
} from './model';
import type { AppState, Word } from './model';

type ConfirmAction =
  | { type: 'delete-word'; word: Word }
  | { type: 'clear-answers' }
  | { type: 'reset-errors' }
  | null;

type DialogFrameProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy: string;
  children: ReactNode;
  className?: string;
};

function DialogFrame({ open, onClose, labelledBy, describedBy, children, className = '' }: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={'dialog ' + className}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function LeafMark() {
  return (
    <svg className="leaf-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M9 39C9 22 20 9 39 9 39 28 26 39 9 39Z"
        fill="currentColor"
        fillOpacity=".16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11 37c7-10 13-16 23-23"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M19 29c.5-4.5-.8-7.7-3.8-10.1M25 23c3.7.2 6.6 1.6 8.4 4.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardsIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="5.25" y="3.25" width="10.5" height="13.5" rx="2" />
      <path d="M3.25 6v9.25a2 2 0 0 0 2 2h7.5" />
      <path d="M8.5 7h4m-4 3h4" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M3 5h2.25c4.25 0 5.25 10 9.5 10H17" />
      <path d="m14.5 12.5 2.5 2.5-2.5 2.5M3 15h2.25c1.45 0 2.5-1.15 3.45-2.6M11.3 7.55C12.25 6.1 13.3 5 14.75 5H17" />
      <path d="m14.5 2.5 2.5 2.5-2.5 2.5" />
    </svg>
  );
}

function App() {
  const [state, setState] = useState<AppState>(loadAppState);
  const [filterHard, setFilterHard] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [form, setForm] = useState({ de: '', ru: '' });
  const [formIssue, setFormIssue] = useState<'de' | 'ru' | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importHasError, setImportHasError] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const germanInputRef = useRef<HTMLInputElement>(null);
  const russianInputRef = useRef<HTMLInputElement>(null);

  const { words } = state;
  const visibleWords = filterHard ? words.filter((word) => word.errorCount > 0) : words;
  const totalErrors = words.reduce((sum, word) => sum + word.errorCount, 0);
  const hardCount = words.filter((word) => word.errorCount > 0).length;
  const number = new Intl.NumberFormat('ru-RU');
  const currentFlashcardIndex =
    words.length === 0 ? 0 : Math.min(flashcardIndex, words.length - 1);
  const currentFlashcard = words[currentFlashcardIndex];

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          words: state.words,
          showDe: state.showDe,
          showRu: state.showRu,
          mode: state.mode,
        }),
      );
    } catch {
      setStorageUnavailable(true);
    }
  }, [state]);

  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const de = form.de.trim();
    const ru = form.ru.trim();

    if (!de) {
      setFormIssue('de');
      germanInputRef.current?.focus();
      return;
    }

    if (!ru) {
      setFormIssue('ru');
      russianInputRef.current?.focus();
      return;
    }

    setState((current) => ({
      ...current,
      words: [...current.words, createWord(de, ru)],
    }));
    setForm({ de: '', ru: '' });
    setFormIssue(null);
    setAnnouncement('Слово «' + de + '» добавлено в список.');
    germanInputRef.current?.focus();
  }

  function updateAnswer(id: string, answer: string) {
    setState((current) => ({
      ...current,
      words: current.words.map((word) => {
        if (word.id !== id) return word;

        const updated = { ...word, answer };
        const stillIncorrect = getAnswerStatus(updated, current.mode) === 'incorrect';
        return {
          ...updated,
          errorCounted: stillIncorrect ? word.errorCounted : false,
        };
      }),
    }));
  }

  function countErrorIfNeeded(id: string) {
    setState((current) => {
      const word = current.words.find((entry) => entry.id === id);
      if (!word || word.errorCounted || getAnswerStatus(word, current.mode) !== 'incorrect') {
        return current;
      }

      return {
        ...current,
        words: current.words.map((entry) =>
          entry.id === id
            ? { ...entry, errorCount: entry.errorCount + 1, errorCounted: true }
            : entry,
        ),
      };
    });
  }

  function openFlashcards() {
    setFlashcardIndex(0);
    setFlashcardFlipped(false);
    setFlashcardsOpen(true);
  }

  function openImportExport() {
    setImportText('');
    setImportMessage('');
    setImportHasError(false);
    setImportOpen(true);
  }

  function exportWords() {
    const text = state.words.map((word) => word.de + ' - ' + word.ru).join('\n');
    setImportText(text);
    setImportHasError(false);
    setImportMessage(text ? 'Список подготовлен. Скопируй его из поля выше.' : 'В списке пока нет слов.');
  }

  function importWords(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedWords = parseWordLines(importText);

    if (parsedWords.length === 0) {
      setImportHasError(true);
      setImportMessage('Не удалось распознать пары. Напиши слово и перевод через дефис, двоеточие или табуляцию.');
      return;
    }

    setState((current) => ({
      ...current,
      words: [...current.words, ...parsedWords.map((word) => createWord(word.de, word.ru))],
    }));
    setImportOpen(false);
    setAnnouncement('Добавлено слов: ' + number.format(parsedWords.length) + '.');
  }

  function runConfirmedAction() {
    if (!confirmAction) return;

    if (confirmAction.type === 'delete-word') {
      const word = confirmAction.word;
      setState((current) => ({
        ...current,
        words: current.words.filter((entry) => entry.id !== word.id),
      }));
      setAnnouncement('Слово «' + word.de + '» удалено.');
    } else if (confirmAction.type === 'clear-answers') {
      setState((current) => ({
        ...current,
        words: current.words.map((word) => ({
          ...word,
          answer: '',
          errorCounted: false,
        })),
      }));
      setAnnouncement('Введённые ответы очищены.');
    } else {
      setState((current) => ({
        ...current,
        words: current.words.map((word) => ({
          ...word,
          errorCount: 0,
          errorCounted: false,
        })),
      }));
      setFilterHard(false);
      setAnnouncement('Статистика ошибок сброшена.');
    }

    setConfirmAction(null);
  }

  function shuffleWords() {
    setState((current) => {
      const shuffled = [...current.words];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
      }

      return { ...current, words: shuffled };
    });
    setAnnouncement('Порядок слов перемешан.');
  }

  const confirmTitle =
    confirmAction?.type === 'delete-word'
      ? 'Удалить слово?'
      : confirmAction?.type === 'clear-answers'
        ? 'Очистить ответы?'
        : 'Сбросить статистику?';
  const confirmDescription =
    confirmAction?.type === 'delete-word'
      ? '«' + confirmAction.word.de + '» будет удалено из твоего списка.'
      : confirmAction?.type === 'clear-answers'
        ? 'Все введённые ответы и текущие отметки ошибок на полях будут очищены.'
        : 'Счётчики ошибок для всех слов обнулятся.';
  const confirmButton =
    confirmAction?.type === 'delete-word'
      ? 'Удалить слово'
      : confirmAction?.type === 'clear-answers'
        ? 'Очистить ответы'
        : 'Сбросить статистику';

  return (
    <>
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>

      <div className="page-shell">
        <header className="site-header">
          <div className="brand">
            <span className="brand-mark">
              <LeafMark />
            </span>
            <div className="brand-copy">
              <h1 translate="no">Wortgarten</h1>
              <p>Твой сад немецких слов — выращивай словарный запас каждый день</p>
            </div>
          </div>

          <div className="garden-count" role="group" aria-label="Счётчик слов">
            <span className="count-number">{number.format(words.length)}</span>
            <span className="count-caption">слов в саду</span>
          </div>
        </header>

        <main id="main-content">
          <section className="add-panel panel" aria-labelledby="add-heading">
            <div className="panel-heading">
              <div>
                <h2 id="add-heading">Посади новое слово</h2>
                <p>Запиши немецкое слово и перевод, чтобы повторять их в тренировке.</p>
              </div>
              <span className="panel-leaf" aria-hidden="true">
                <LeafMark />
              </span>
            </div>

            <form className="add-form" onSubmit={addWord} noValidate>
              <div className="field">
                <label htmlFor="input-de">Немецкое слово</label>
                <input
                  ref={germanInputRef}
                  id="input-de"
                  name="german-word"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Например, der Tisch…"
                  value={form.de}
                  aria-invalid={formIssue === 'de'}
                  aria-describedby={formIssue === 'de' ? 'input-de-error' : undefined}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, de: event.currentTarget.value }));
                    if (formIssue === 'de') setFormIssue(null);
                  }}
                />
                {formIssue === 'de' && (
                  <span className="field-error" id="input-de-error" role="alert">
                    Введи немецкое слово.
                  </span>
                )}
              </div>

              <div className="field">
                <label htmlFor="input-ru">Перевод на русском</label>
                <input
                  ref={russianInputRef}
                  id="input-ru"
                  name="russian-translation"
                  type="text"
                  autoComplete="off"
                  placeholder="Например, стол…"
                  value={form.ru}
                  aria-invalid={formIssue === 'ru'}
                  aria-describedby={formIssue === 'ru' ? 'input-ru-error' : undefined}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, ru: event.currentTarget.value }));
                    if (formIssue === 'ru') setFormIssue(null);
                  }}
                />
                {formIssue === 'ru' && (
                  <span className="field-error" id="input-ru-error" role="alert">
                    Введи перевод на русском.
                  </span>
                )}
              </div>

              <button className="button button-primary add-button" type="submit">
                Добавить слово
              </button>
            </form>
          </section>

          <section className="practice-section" aria-labelledby="practice-heading">
            <div className="section-heading">
              <div>
                <h2 id="practice-heading">Слова для тренировки</h2>
                <p>Выбери направление и проверь, что уже запомнилось.</p>
              </div>
              <div className="difficulty-note">
                <span className="difficulty-dot" aria-hidden="true" />
                <span>
                  Сложных слов: <strong>{number.format(hardCount)}</strong>
                </span>
              </div>
            </div>

            <div className="practice-toolbar">
              <div className="toolbar-group">
                <div className="segmented" role="group" aria-label="Направление тренировки">
                  <button
                    className={state.mode === 'de-ru' ? 'mode-button selected' : 'mode-button'}
                    type="button"
                    aria-label="Тренировка: немецкий → русский"
                    aria-pressed={state.mode === 'de-ru'}
                    onClick={() => setState((current) => ({ ...current, mode: 'de-ru' }))}
                  >
                    DE <span aria-hidden="true">→</span> RU
                  </button>
                  <button
                    className={state.mode === 'ru-de' ? 'mode-button selected' : 'mode-button'}
                    type="button"
                    aria-label="Тренировка: русский → немецкий"
                    aria-pressed={state.mode === 'ru-de'}
                    onClick={() => setState((current) => ({ ...current, mode: 'ru-de' }))}
                  >
                    RU <span aria-hidden="true">→</span> DE
                  </button>
                </div>

                <button
                  className={state.showDe ? 'pill-button' : 'pill-button active'}
                  type="button"
                  aria-pressed={!state.showDe}
                  onClick={() => setState((current) => ({ ...current, showDe: !current.showDe }))}
                >
                  {state.showDe ? 'Скрыть немецкий' : 'Показать немецкий'}
                </button>
                <button
                  className={state.showRu ? 'pill-button' : 'pill-button active'}
                  type="button"
                  aria-pressed={!state.showRu}
                  onClick={() => setState((current) => ({ ...current, showRu: !current.showRu }))}
                >
                  {state.showRu ? 'Скрыть русский' : 'Показать русский'}
                </button>
              </div>

              <div className="toolbar-group toolbar-actions">
                <button
                  className="pill-button"
                  type="button"
                  disabled={words.length === 0}
                  onClick={openFlashcards}
                >
                  <CardsIcon />
                  Карточки
                </button>
                <button
                  className="pill-button"
                  type="button"
                  disabled={words.length < 2}
                  onClick={shuffleWords}
                >
                  <ShuffleIcon />
                  Перемешать
                </button>
                <button
                  className="pill-button"
                  type="button"
                  aria-pressed={filterHard}
                  onClick={() => setFilterHard((current) => !current)}
                >
                  {filterHard ? 'Показать все слова' : 'Сложные слова'}
                </button>
                <button className="pill-button" type="button" onClick={openImportExport}>
                  Импорт и экспорт
                </button>
                <button
                  className="pill-button"
                  type="button"
                  disabled={!words.some((word) => word.answer)}
                  onClick={() => setConfirmAction({ type: 'clear-answers' })}
                >
                  Очистить ответы
                </button>
              </div>
            </div>

            <div
              className={
                'word-list-frame' +
                (state.showDe ? '' : ' hide-de') +
                (state.showRu ? '' : ' hide-ru')
              }
            >
              <div className="list-head" aria-hidden="true">
                <span className="cell-de">Немецкий</span>
                <span className="cell-practice">Твой ответ</span>
                <span className="cell-ru">Русский</span>
                <span aria-hidden="true" />
              </div>

              {words.length === 0 ? (
                <div className="empty-state">
                  <LeafMark />
                  <h3>В саду пока тихо</h3>
                  <p>Добавь первое немецкое слово в поле выше — здесь появится тренировка.</p>
                </div>
              ) : visibleWords.length === 0 ? (
                <div className="empty-state compact">
                  <h3>Сложных слов пока нет</h3>
                  <p>Продолжай тренировку или покажи весь список.</p>
                </div>
              ) : (
                <ul className="word-list" aria-label="Слова для тренировки">
                  {visibleWords.map((word) => (
                    <WordRow
                      key={word.id}
                      word={word}
                      mode={state.mode}
                      onAnswerChange={updateAnswer}
                      onAnswerBlur={countErrorIfNeeded}
                      onDelete={(selectedWord) =>
                        setConfirmAction({ type: 'delete-word', word: selectedWord })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="stats-bar">
              <p>
                <strong>{number.format(words.length)}</strong> слов
                <span aria-hidden="true"> · </span>
                <strong>{number.format(totalErrors)}</strong> ошибок за всё время
              </p>
              <button
                className="text-button"
                type="button"
                disabled={totalErrors === 0}
                onClick={() => setConfirmAction({ type: 'reset-errors' })}
              >
                Сбросить статистику
              </button>
            </footer>
          </section>

          <p className="storage-note" hidden={!storageUnavailable}>
            Браузер не разрешил сохранить изменения. Открой Wortgarten в обычном режиме, чтобы
            данные сохранялись на этом устройстве.
          </p>
        </main>
      </div>

      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <DialogFrame
        open={flashcardsOpen}
        onClose={() => setFlashcardsOpen(false)}
        labelledBy="flashcard-title"
        describedBy="flashcard-description"
        className="flashcard-dialog"
      >
        <div className="dialog-heading">
          <div>
            <span className="dialog-kicker">Повторение</span>
            <h2 id="flashcard-title">Карточки слов</h2>
          </div>
          <button
            className="icon-close"
            type="button"
            aria-label="Закрыть карточки"
            onClick={() => setFlashcardsOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="dialog-intro" id="flashcard-description">Переверни карточку, чтобы проверить перевод.</p>

        {currentFlashcard && (
          <>
            <div className="flashcard-stage">
              <button
                className={flashcardFlipped ? 'flashcard flipped' : 'flashcard'}
                type="button"
                aria-label={
                  flashcardFlipped
                    ? 'Показать немецкое слово «' + currentFlashcard.de + '»'
                    : 'Показать перевод слова «' + currentFlashcard.de + '»'
                }
                aria-pressed={flashcardFlipped}
                onClick={() => setFlashcardFlipped((current) => !current)}
              >
                <span className="flashcard-face flashcard-front" aria-hidden={flashcardFlipped}>
                  <span className="flashcard-language">
                    {state.mode === 'de-ru' ? 'Немецкий' : 'Русский'}
                  </span>
                  <span className="flashcard-word" lang={state.mode === 'de-ru' ? 'de' : 'ru'}>
                    {state.mode === 'de-ru' ? currentFlashcard.de : currentFlashcard.ru}
                  </span>
                  <span className="flashcard-hint">Нажми, чтобы увидеть перевод</span>
                </span>
                <span className="flashcard-face flashcard-back" aria-hidden={!flashcardFlipped}>
                  <span className="flashcard-language">
                    {state.mode === 'de-ru' ? 'Русский' : 'Немецкий'}
                  </span>
                  <span className="flashcard-word" lang={state.mode === 'de-ru' ? 'ru' : 'de'}>
                    {state.mode === 'de-ru' ? currentFlashcard.ru : currentFlashcard.de}
                  </span>
                </span>
              </button>
            </div>

            <div className="flashcard-controls">
              <button
                className="button button-secondary"
                type="button"
                disabled={currentFlashcardIndex === 0}
                onClick={() => {
                  setFlashcardIndex((index) => Math.max(0, index - 1));
                  setFlashcardFlipped(false);
                }}
              >
                Назад
              </button>
              <span className="flashcard-counter" aria-live="polite" aria-atomic="true">
                {number.format(currentFlashcardIndex + 1)} из {number.format(words.length)}
              </span>
              <button
                className="button button-secondary"
                type="button"
                disabled={currentFlashcardIndex >= words.length - 1}
                onClick={() => {
                  setFlashcardIndex((index) => Math.min(words.length - 1, index + 1));
                  setFlashcardFlipped(false);
                }}
              >
                Вперёд
              </button>
            </div>
          </>
        )}

        <div className="dialog-actions">
          <button className="button button-primary" type="button" onClick={() => setFlashcardsOpen(false)}>
            Закрыть карточки
          </button>
        </div>
      </DialogFrame>

      <DialogFrame
        open={importOpen}
        onClose={() => setImportOpen(false)}
        labelledBy="import-title"
        describedBy="import-description"
        className="import-dialog"
      >
        <div className="dialog-heading">
          <div>
            <span className="dialog-kicker">Список слов</span>
            <h2 id="import-title">Импорт и экспорт</h2>
          </div>
          <button
            className="icon-close"
            type="button"
            aria-label="Закрыть импорт и экспорт"
            onClick={() => setImportOpen(false)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="dialog-intro" id="import-description">
          Каждая пара — с новой строки. Разделяй немецкое слово и перевод дефисом, тире,
          двоеточием или табуляцией.
        </p>

        <form className="import-form" onSubmit={importWords}>
          <label className="visually-hidden" htmlFor="io-textarea">
            Слова для импорта или экспортированный список
          </label>
          <textarea
            id="io-textarea"
            name="word-list"
            rows={9}
            placeholder={'der Tisch — стол\ndas Haus — дом\nlernen — учить'}
            value={importText}
            onChange={(event) => {
              setImportText(event.currentTarget.value);
              setImportMessage('');
              setImportHasError(false);
            }}
          />
          {importMessage && (
            <p className={importHasError ? 'dialog-message error' : 'dialog-message'} role={importHasError ? 'alert' : 'status'}>
              {importMessage}
            </p>
          )}

          <div className="dialog-actions split-actions">
            <button className="button button-secondary" type="button" onClick={exportWords}>
              Подготовить экспорт
            </button>
            <div className="dialog-actions">
              <button className="button button-primary" type="submit">
                Импортировать
              </button>
              <button className="button button-secondary" type="button" onClick={() => setImportOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </form>
      </DialogFrame>

      <DialogFrame
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        labelledBy="confirm-title"
        describedBy="confirm-description"
        className="confirm-dialog"
      >
        <div className="dialog-heading">
          <div>
            <span className="dialog-kicker">Подтверди действие</span>
            <h2 id="confirm-title">{confirmTitle}</h2>
          </div>
          <button
            className="icon-close"
            type="button"
            aria-label="Отменить действие"
            onClick={() => setConfirmAction(null)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <p className="dialog-intro" id="confirm-description">{confirmDescription}</p>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={() => setConfirmAction(null)}>
            Отмена
          </button>
          <button className="button button-danger" type="button" onClick={runConfirmedAction}>
            {confirmButton}
          </button>
        </div>
      </DialogFrame>
    </>
  );
}

export default App;
