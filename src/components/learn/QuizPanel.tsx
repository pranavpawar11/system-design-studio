import { useId, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { Quiz } from '../../features/learning/types';

export default function QuizPanel({ quiz, passed, onPass }: { quiz: Quiz; passed: boolean; onPass(score: number): void }) {
  const uid = useId();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const total = quiz.questions.length;
  const right = quiz.questions.filter((q) => answers[q.id] === q.correct).length;
  const score = total ? right / total : 0;
  const ok = checked && score >= quiz.passScore - 1e-9;
  const ready = quiz.questions.every((q) => answers[q.id]);
  const check = () => {
    setChecked(true);
    if (score >= quiz.passScore - 1e-9) onPass(score);
  };

  return (
    <section className="quiz" aria-labelledby={`${uid}-t`}>
      <div className="lab-head"><h3 id={`${uid}-t`}>Quick check</h3>{passed && <span className="badge pass">✓ Passed</span>}</div>
      <p className="muted">Answer all {total}. You need {Math.ceil(quiz.passScore * total - 1e-9)} right to pass, and you can try again as often as you like.</p>
      <div className="quiz-questions">
        {quiz.questions.map((q, n) => {
          const questionCorrect = checked && answers[q.id] === q.correct;
          return (
            <section
              key={q.id}
              className={`qq ${checked ? (questionCorrect ? 'is-correct' : 'is-wrong') : ''}`}
              role="group"
              aria-labelledby={`${uid}-${q.id}-prompt`}
            >
              <div className="qq-heading" id={`${uid}-${q.id}-prompt`}>
                <span className="quiz-number" aria-hidden="true">{n + 1}</span>
                <span className="qq-prompt">{q.prompt}</span>
              </div>
              <div className="quiz-options" role="radiogroup" aria-labelledby={`${uid}-${q.id}-prompt`}>
                {q.options.map((o, optionIndex) => {
                  const selected = answers[q.id] === o.id;
                  const isAnswer = checked && o.id === q.correct;
                  const isIncorrect = checked && selected && o.id !== q.correct;
                  return (
                    <label key={o.id} className={`opt ${selected ? 'selected' : ''} ${isAnswer ? 'answer' : ''} ${isIncorrect ? 'incorrect' : ''}`}>
                      <input
                        type="radio"
                        name={`${uid}-${q.id}`}
                        value={o.id}
                        checked={selected}
                        disabled={checked && ok}
                        onChange={() => {
                          setAnswers((current) => ({ ...current, [q.id]: o.id }));
                          if (checked) setChecked(false);
                        }}
                      />
                      <span className="option-key">{String.fromCharCode(65 + optionIndex)}</span>
                      <span className="option-copy">{o.text}</span>
                      {isAnswer && <span className="option-result-icon" aria-label="Correct answer"><Check size={15} /></span>}
                      {isIncorrect && <span className="option-result-icon" aria-label="Your answer">×</span>}
                    </label>
                  );
                })}
              </div>
              {checked && (
                <p className={`qresult ${questionCorrect ? 'right' : 'wrong'}`} role="status">
                  <b>{questionCorrect ? '✓ Correct.' : '✗ Not quite.'}</b> {q.explanation}
                </p>
              )}
            </section>
          );
        })}
      </div>
      <div className="quiz-actions">
        <span className="quiz-action-hint">{ready ? 'All questions answered. Check your understanding.' : `Choose an answer for each question (${Object.keys(answers).length}/${total}).`}</span>
        <div className="quiz-action-buttons">
          {checked && !ok && <button type="button" onClick={() => { setAnswers({}); setChecked(false); }}><RotateCcw size={14} /> Start over</button>}
          <button className="primary" type="button" onClick={check} disabled={!ready || (checked && ok)}>{checked && !ok ? 'Check again' : 'Check my answers'}</button>
        </div>
      </div>
      {checked && <p className={`quiz-score ${ok ? 'right' : 'wrong'}`} role="status">{ok ? `You got ${right} of ${total}. Passed.` : `You got ${right} of ${total}. Read the explanations, change your answers and check again.`}</p>}
    </section>
  );
}
