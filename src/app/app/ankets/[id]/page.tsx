"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";

import {
  fetchInterviewStructure,
  sendInterviewAnswers,
  getInterviewsDescription,
  type InterviewQuestion,
  type SaveInterviewPayload,
  type InterviewDescription,
} from "@/lib/api";

type AnswersState = {
  [questionOfInterviewId: number]: {
    optionId?: number;
  };
};

type PageProps = {
  params: { id: string };
};

export default function InterviewPage({ params }: PageProps) {
  const interviewId = Number(params.id);
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.userId;

  const [info, setInfo] = useState<InterviewDescription | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<AnswersState>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!interviewId || !Number.isFinite(interviewId)) {
      setError("Неверный идентификатор анкеты");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // параллельно вытягиваем описание и структуру
        const [allDesc, struct] = await Promise.all([
          getInterviewsDescription(),
          fetchInterviewStructure(interviewId),
        ]);

        if (cancelled) return;

        const found = allDesc.find((d) => d.id === interviewId) ?? null;
        setInfo(found);
        setQuestions(struct ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message || "Не удалось загрузить данные анкеты. Попробуйте позже."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [interviewId]);

  const handleChangeOption = (qId: number, optId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: { optionId: optId },
    }));
    setSaveError(null);
    setSaveOk(false);
  };

  const handleSubmit = async () => {
    if (!userId) {
      setSaveError("Нужно войти в систему, чтобы сохранить ответы.");
      return;
    }
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

      payload.answers.push({
        question_of_interview_id: q.question_of_interview_id,
        question_id: q.question_id,
        option_id: st.optionId,
        answer_text: opt?.option_text ?? "",
      });
    }

    if (payload.answers.length === 0) {
      setSaveError("Нужно выбрать хотя бы один ответ.");
      return;
    }

    try {
      setSaving(true);
      setSaveError(null);
      setSaveOk(false);
      await sendInterviewAnswers(payload);
      setSaveOk(true);
    } catch (e: any) {
      setSaveError(e?.message || "Не удалось сохранить ответы.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={info?.name || `Анкета #${interviewId}`}
        headerRight={
          <Button variant="secondary" onClick={() => router.push("/ankets")}>
            ← Назад к списку анкет
          </Button>
        }
      >
        {info?.description && (
          <p
            style={{
              fontSize: 13,
              color: "#6b7280",
              maxWidth: 560,
              marginBottom: 8,
            }}
          >
            {info.description}
          </p>
        )}
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          Отметьте подходящие варианты ответа. После сохранения ответы будут
          учтены при формировании рекомендаций.
        </p>
      </Card>

      <Card title="Вопросы анкеты">
        {error && <Alert type="error">{error}</Alert>}
        {saveError && <Alert type="error">{saveError}</Alert>}
        {saveOk && <Alert type="info">Ответы сохранены</Alert>}


        {loading && !error && <Spinner label="Загрузка вопросов…" />}

        {!loading && !error && questions && questions.length === 0 && (
          <Alert type="info">Для этой анкеты пока нет вопросов.</Alert>
        )}

        {!loading && !error && questions && questions.length > 0 && (
          <>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                maxHeight: "60vh",
                overflowY: "auto",
                paddingRight: 4,
                marginBottom: 16,
              }}
            >
              {questions.map((q, idx) => (
                <div
                  key={q.question_of_interview_id}
                  style={{
                    borderRadius: 16,
                    background: "#f9fafb",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#0f172a",
                      marginBottom: 4,
                    }}
                  >
                    {idx + 1}. {q.question_name}
                  </div>
                  {q.question_description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        marginBottom: 8,
                      }}
                    >
                      {q.question_description}
                    </div>
                  )}

                  {q.question_options && q.question_options.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      {q.question_options.map((opt) => (
                        <label
                          key={opt.option_id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                            color: "#111827",
                            cursor: "pointer",
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
                                opt.option_id
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
                        color: "#9ca3af",
                        marginTop: 4,
                      }}
                    >
                      Этот тип вопроса пока не поддержан в веб-интерфейсе.
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Button variant="secondary" onClick={() => router.push("/ankets")}>
                Отменить
              </Button>
              <Button onClick={handleSubmit} loading={saving}>
                Сохранить ответы
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
