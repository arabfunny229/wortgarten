import type { Direction, Word } from '../model';
import { getAnswerStatus } from '../model';

type WordRowProps = {
  word: Word;
  mode: Direction;
  onAnswerChange: (id: string, answer: string) => void;
  onAnswerBlur: (id: string) => void;
  onDelete: (word: Word) => void;
};

function mistakeTier(count: number) {
  if (count === 0) return '';
  if (count <= 2) return 'mistake-count tier-one';
  if (count <= 4) return 'mistake-count tier-two';
  return 'mistake-count tier-three';
}

export default function WordRow({
  word,
  mode,
  onAnswerChange,
  onAnswerBlur,
  onDelete,
}: WordRowProps) {
  const status = getAnswerStatus(word, mode);
  const inputId = 'answer-' + word.id;
  const helpId = inputId + '-help';
  const prompt =
    mode === 'de-ru'
      ? 'Твой перевод на русский для слова «' + word.de + '»'
      : 'Немецкий перевод слова «' + word.ru + '»';
  const statusText =
    status === 'correct'
      ? 'Ответ верный.'
      : status === 'incorrect'
        ? 'Ответ пока не совпадает с переводом.'
        : 'Поле готово для ответа.';

  return (
    <li className="word-row">
      <div className="word-cell cell-de">
        <span className="cell-label">Немецкий</span>
        <span className="word-text" lang="de">
          {word.de}
        </span>
      </div>

      <div className="word-cell cell-practice">
        <label className="visually-hidden" htmlFor={inputId}>
          {prompt}
        </label>
        <input
          id={inputId}
          className={'practice-input ' + status}
          type="text"
          name={'answer-' + word.id}
          autoComplete="off"
          spellCheck={false}
          value={word.answer}
          placeholder={mode === 'de-ru' ? 'Перевод на русском…' : 'Wort auf Deutsch…'}
          aria-invalid={status === 'incorrect'}
          aria-describedby={helpId}
          onChange={(event) => onAnswerChange(word.id, event.currentTarget.value)}
          onBlur={() => onAnswerBlur(word.id)}
        />
        <span className={mistakeTier(word.errorCount)} aria-hidden="true">
          {word.errorCount > 0 ? word.errorCount : ''}
        </span>
        {word.errorCount > 0 && (
          <span className="visually-hidden">Ошибок в этом слове: {word.errorCount}.</span>
        )}
        <span className="visually-hidden" id={helpId} aria-live="polite">
          {statusText}
        </span>
      </div>

      <div className="word-cell cell-ru">
        <span className="cell-label">Русский</span>
        <span className="translation-text" lang="ru">
          {word.ru}
        </span>
      </div>

      <div className="word-actions">
        <button
          className="delete-button"
          type="button"
          aria-label={'Удалить слово «' + word.de + '»'}
          title="Удалить слово"
          onClick={() => onDelete(word)}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M4.5 6.5h11M8 6.5V4.75h4V6.5m-6.25 0 .6 9h7.3l.6-9M8.25 9v4.25m3.5-4.25v4.25" />
          </svg>
        </button>
      </div>
    </li>
  );
}
