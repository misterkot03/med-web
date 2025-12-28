'use client';

import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/lib/AuthContext';

import {
  getInterviewsDescription,
  getInterviewAnswers,
  fetchInterviewStructure,
  sendInterviewAnswers,
  type InterviewDescription,
  type InterviewAnswer,
  type InterviewQuestion,
  type SaveInterviewPayload,
} from '@/lib/api';

import styles from './interviews.module.css';

/* --------- типы для списка --------- */

type InterviewWithStatus = InterviewDescription & {
  answersCount: number;
  lastAnswerAt?: string | null;
};

type AnswersState = {
  [questionOfInterviewId: number]: {
    optionId?: number;
  };
};

function formatDate(iso?: string | null) {
  if (!iso) return 'ещё не заполняли';
  const d = new Date(iso);
  return d.toLocaleString();
}

/* ================== СТРАНИЦА СПИСКА АНКЕТ ================== */

export default function InterviewsPage() {
  const { session } = useAuth();
  const userId = session?.userId;

  const [items, setItems] = useState<InterviewWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // какая анкета сейчас открыта в модалке
  const [activeInterview, setActiveInterview] =
    useState<InterviewDescription | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // 1. берём список анкет
        const desc = await getInterviewsDescription();

        // 2. для каждой анкеты подтягиваем ответы пользователя
        const result: InterviewWithStatus[] = [];

        for (const interview of desc) {
          let answers: InterviewAnswer[] = [];
          try {
            answers = await getInterviewAnswers(interview.id, userId);
          } catch {
            answers = [];
          }

          const answersCount = Array.isArray(answers) ? answers.length : 0;

          let last: string | null | undefined = null;
          if (answersCount > 0) {
            const times = answers
              .map((a) => a.response_time)
              .filter((x): x is string => !!x)
              .sort();
            last = times[times.length - 1] ?? null;
          }

          result.push({
            ...interview,
            answersCount,
            lastAnswerAt: last ?? null,
          });
        }

        if (!cancelled) {
          setItems(result);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || 'Не удалось загрузить анкеты');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const total = items.length;
  const withData = items.filter((i) => i.answersCount > 0).length;

  return (
    <div className={styles.root}>
      {/* Верхняя карточка-заголовок */}
      <Card title="Анкеты пациента">
        <p className={styles.headerText}>
          Здесь собираются ответы на опросы о самочувствии, образе жизни и
          факторах риска. Чем полнее заполнены анкеты, тем точнее будут
          персональные рекомендации.
        </p>
        {userId && total > 0 && (
          <p className={styles.headerText} style={{ marginTop: 8 }}>
            Сейчас доступно <strong>{total}</strong> анкет(ы). Данные есть по{' '}
            <strong>{withData}</strong> из них.
          </p>
        )}
        {!userId && (
          <p className={styles.headerText} style={{ marginTop: 8 }}>
            Для работы с анкетами нужно войти в систему.
          </p>
        )}
      </Card>

      <div className={styles.grid}>
        {/* Левая колонка — список анкет */}
        <Card title="Ваши анкеты">
          {!userId && (
            <Alert type="info">Авторизуйтесь, чтобы увидеть свои анкеты.</Alert>
          )}

          {userId && error && <Alert type="error">{error}</Alert>}

          {userId && loading && !error && (
            <Spinner label="Загрузка анкет…" />
          )}

          {userId && !loading && !error && items.length === 0 && (
            <Alert type="info">
              Пока для вас нет доступных анкет. Когда врач подключит опросы,
              они появятся здесь.
            </Alert>
          )}

          {userId && !loading && !error && items.length > 0 && (
            <div className={styles.list}>
              {items.map((i) => {
                const hasData = i.answersCount > 0;
                return (
                  <div key={i.id} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <div className={styles.itemTitleBlock}>
                        <div className={styles.itemTitle}>{i.name}</div>
                        {i.description && (
                          <div className={styles.itemSubtitle}>
                            {i.description}
                          </div>
                        )}
                      </div>
                      <span
                        className={
                          styles.chip +
                          ' ' +
                          (hasData ? styles.chipOk : styles.chipEmpty)
                        }
                      >
                        {hasData
                          ? `есть ответы (${i.answersCount})`
                          : 'данных пока нет'}
                      </span>
                    </div>

                    <div className={styles.itemMeta}>
                      Последний ответ:{' '}
                      <strong>{formatDate(i.lastAnswerAt)}</strong>
                    </div>

                    <div className={styles.itemFooter}>
                      <Button
                        disabled={!userId}
                        onClick={() => userId && setActiveInterview(i)}
                      >
                        {userId
                          ? 'Открыть анкету'
                          : 'Войдите, чтобы заполнить'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Правая колонка — подсказки */}
        <Card title="Зачем заполнять анкеты">
          <div className={styles.helpList}>
            <div>
              <div className={styles.helpItemTitle}>
                <span className={styles.helpNum}>1</span>
                Точность рекомендаций
              </div>
              Чем больше система знает о самочувствии, привычках и факторах
              риска, тем точнее подсказывает, на что обратить внимание.
            </div>

            <div>
              <div className={styles.helpItemTitle}>
                <span className={styles.helpNum}>2</span>
                Экономия времени на приёме
              </div>
              Врач видит заранее подготовленные ответы и может быстрее перейти
              к обсуждению важного – жалоб и плана действий.
            </div>

            <div>
              <div className={styles.helpItemTitle}>
                <span className={styles.helpNum}>3</span>
                История в одном месте
              </div>
              Ответы сохраняются и помогают отслеживать, как меняется ваше
              состояние со временем.
            </div>
          </div>
        </Card>
      </div>

      {/* Модалка с выбранной анкетой */}
      {activeInterview && userId && (
        <InterviewModal
          interview={activeInterview}
          userId={userId}
          onClose={() => setActiveInterview(null)}
        />
      )}
    </div>
  );
}

/* ================== МОДАЛКА АНКЕТЫ ================== */

type InterviewModalProps = {
  interview: InterviewDescription;
  userId: number;
  onClose: () => void;
};

function InterviewModal({ interview, userId, onClose }: InterviewModalProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<AnswersState>({});
  const [previousAnswers, setPreviousAnswers] = useState<InterviewAnswer[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // грузим структуру анкеты + историю ответов и сразу проставляем последние варианты
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setSaveError(null);
        setSaveOk(false);
        setAnswers({});

        const [structure, rawAnswers] = await Promise.all([
          fetchInterviewStructure(interview.id),
          getInterviewAnswers(interview.id, userId),
        ]);

        if (cancelled) return;

        const qList = structure ?? [];
        setQuestions(qList);

        const prev = Array.isArray(rawAnswers) ? rawAnswers : [];
        setPreviousAnswers(prev);

        // проставляем по каждому вопросу последний ответ
        if (qList.length > 0 && prev.length > 0) {
          const byQuestion = new Map<number, InterviewAnswer[]>();

          for (const a of prev) {
            if (!a.question_of_interview_id || !a.response_time) continue;
            const list = byQuestion.get(a.question_of_interview_id) ?? [];
            list.push(a);
            byQuestion.set(a.question_of_interview_id, list);
          }

          const initial: AnswersState = {};

          for (const q of qList) {
            const list = byQuestion.get(q.question_of_interview_id);
            if (!list || list.length === 0) continue;

            // сортируем по времени и берём последний ответ
            list.sort((a, b) => {
              const ta = a.response_time ?? '';
              const tb = b.response_time ?? '';
              return ta.localeCompare(tb);
            });
            const last = list[list.length - 1];
            if (!last || last.option_of_question_id == null) continue;

            const opt = q.question_options?.find(
              (o) => o.options_of_question_id === last.option_of_question_id,
            );
            if (!opt) continue;

            initial[q.question_of_interview_id] = { optionId: opt.option_id };
          }

          setAnswers(initial);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message ??
              'Не удалось загрузить анкету. Попробуйте обновить страницу.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [interview.id, userId]);

  const handleChangeOption = (qId: number, optId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { optionId: optId },
    }));
    setSaveError(null);
    setSaveOk(false);
  };

  const handleReset = () => {
    setAnswers({});
    setSaveError(null);
    setSaveOk(false);
  };

  const handleSubmit = async () => {
    if (!questions) return;

    const payload: SaveInterviewPayload = {
      user_id: userId,
      answers: [],
    };

    for (const q of questions) {
      const st = answers[q.question_of_interview_id];
      if (!st?.optionId) continue;

      const opt =
        q.question_options?.find((o) => o.option_id === st.optionId) ?? null;

      if (!opt) continue;

      payload.answers.push({
        question_of_interview_id: q.question_of_interview_id,
        question_id: q.question_id,
        option_id: st.optionId,
        answer_text: opt?.option_text ?? '',
      });
    }

    if (payload.answers.length === 0) {
      setSaveError('Нужно выбрать хотя бы один ответ');
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveOk(false);
      await sendInterviewAnswers(payload);
      setSaveOk(true);
    } catch (e: any) {
      setSaveError(e?.message || 'Не удалось сохранить ответы');
    } finally {
      setSaving(false);
    }
  };

  // время последнего ответа по этой анкете
  const lastAnswerTimeIso =
    previousAnswers
      .map((a) => a.response_time)
      .filter((x): x is string => !!x)
      .sort()
      .slice(-1)[0] ?? null;

  const totalQuestions = questions?.length ?? 0;
  const answeredCount = questions
    ? questions.reduce(
        (acc, q) =>
          acc + (answers[q.question_of_interview_id]?.optionId ? 1 : 0),
        0,
      )
    : 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={interview.name}
      subtitle={
        interview.description ||
        'Ответы на вопросы помогут системе точнее подбирать рекомендации.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            Сбросить ответы
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            Сохранить ответы
          </Button>
        </>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      {saveError && <Alert type="error">{saveError}</Alert>}
      {saveOk && <Alert type="info">Ответы сохранены</Alert>}


      {lastAnswerTimeIso && (
        <div className={styles.historyBox}>
          <div className={styles.historyTitle}>
            Ранее вы уже заполняли анкету
          </div>
          <div className={styles.historyText}>
            Последний раз вы отвечали{' '}
            <strong>{formatDate(lastAnswerTimeIso)}</strong>. Текущие варианты
            уже подставлены из последнего заполнения — при необходимости
            измените их и сохраните ещё раз.
          </div>
        </div>
      )}

      {questions && questions.length > 0 && (
        <div className={styles.progress}>
          Заполнено {answeredCount} из {totalQuestions} вопросов
        </div>
      )}

      {loading && !error && <Spinner label="Загрузка анкеты…" />}

      {!loading && !error && questions && questions.length === 0 && (
        <Alert type="info">
          Для этой анкеты ещё не настроены вопросы. Попробуйте позже.
        </Alert>
      )}

      {!loading && !error && questions && questions.length > 0 && (
        <div className={styles.questions}>
          {questions.map((q, idx) => (
            <div
              key={q.question_of_interview_id}
              style={{
                borderRadius: 16,
                background: '#f9fafb',
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                  marginBottom: 4,
                }}
              >
                {idx + 1}. {q.question_name}
              </div>

              {q.question_description && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    marginBottom: 6,
                  }}
                >
                  {q.question_description}
                </div>
              )}

              {q.question_options && q.question_options.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  {q.question_options.map((opt) => (
                    <label
                      key={opt.option_id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        color: '#111827',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name={`q-${q.question_of_interview_id}`}
                        value={opt.option_id}
                        checked={
                          answers[q.question_of_interview_id]?.optionId ===
                          opt.option_id
                        }
                        onChange={() =>
                          handleChangeOption(
                            q.question_of_interview_id,
                            opt.option_id,
                          )
                        }
                      />
                      <span>{opt.option_text}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 12,
                    color: '#9ca3af',
                    marginTop: 4,
                  }}
                >
                  Этот тип вопроса пока не поддержан в веб-интерфейсе.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

