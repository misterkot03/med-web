"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/AuthContext";
import { getRecommendationsForUser } from "@/lib/api";
import styles from "./recommendations.module.css";

type Recommendation = {
  recommendation_id: number;
  recommendation_name: string;
  recommendation_description?: string;
};

type SourceStatus = "ok" | "partial" | "empty";

function StatusPill({ status, label }: { status: SourceStatus; label: string }) {
  const className = [
    styles.statusPill,
    status === "ok" && styles.statusOk,
    status === "partial" && styles.statusPartial,
    status === "empty" && styles.statusEmpty,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={className}>{label}</span>;
}

export default function RecommendationsPage() {
  const { session } = useAuth();
  const userId = session?.userId;

  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    getRecommendationsForUser(userId)
      .then((data) => {
        setRecs(data ?? []);
      })
      .catch((e: any) => {
        setError(e?.message || "Не удалось загрузить рекомендации");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const hasRecs = !!recs && recs.length > 0;

  // Пока у нас нет точной аналитики по заполненности,
  // делаем мягкую “заглушку” — когда появятся рекомендации,
  // считаем что всё ок
  const sources = useMemo(
    () => [
      {
        key: "survey",
        title: "Анкета / опросы",
        desc: "Анкета здоровья помогает уточнить самочувствие, образ жизни и факторы риска.",
        status: hasRecs ? ("ok" as SourceStatus) : ("partial" as SourceStatus),
      },
      {
        key: "metrics",
        title: "Показатели (давление, пульс, вес и др.)",
        desc: "Чем больше свежих показателей, тем точнее будут рекомендации.",
        status: hasRecs ? ("ok" as SourceStatus) : ("empty" as SourceStatus),
      },
      {
        key: "painmap",
        title: "Карта болей",
        desc: "Записи по зонам боли помогают отслеживать динамику состояния.",
        status: hasRecs ? ("ok" as SourceStatus) : ("partial" as SourceStatus),
      },
      {
        key: "ready",
        title: "Сформированные рекомендации",
        desc: "Рекомендации появятся автоматически, когда данных будет достаточно.",
        status: hasRecs ? ("ok" as SourceStatus) : ("empty" as SourceStatus),
      },
    ],
    [hasRecs]
  );

  return (
    <div className={styles.page}>
      {/* Заголовок */}
      <Card>
        <div className={styles.header}>
          <h1 className={styles.title}>Персональные рекомендации</h1>

          {error && <Alert type="error">{error}</Alert>}

          {!error && (
            <Alert type={hasRecs ? "success" : "info"}>
              {hasRecs ? (
                <>Ниже — подсказки, подобранные под ваши данные.</>
              ) : (
                <>
                  Пока нет готовых рекомендаций. Система начнёт подсказывать,
                  когда наберётся достаточно информации. Ниже — шаги, которые
                  помогут это настроить.
                </>
              )}
            </Alert>
          )}
        </div>
      </Card>

      {/* Если есть рекомендации — показываем их отдельным блоком */}
      {hasRecs && (
        <Card title="Что система рекомендует сейчас" className={styles.card}>
          <ul className={styles.recList}>
            {recs!.map((r) => (
              <li key={r.recommendation_id} className={styles.recItem}>
                <h3 className={styles.recTitle}>{r.recommendation_name}</h3>
                {r.recommendation_description && (
                  <p className={styles.recText}>
                    {r.recommendation_description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Основная сетка: состояние данных + шаги */}
      <div className={styles.grid}>
        <Card
          title="Состояние данных для рекомендаций"
          className={styles.card}
        >
          <div className={styles.sources}>
            {sources.map((s) => (
              <div key={s.key} className={styles.sourceRow}>
                <div className={styles.sourceText}>
                  <div className={styles.sourceHeader}>
                    <span className={styles.sourceTitle}>{s.title}</span>
                    <StatusPill
                      status={s.status}
                      label={
                        s.status === "ok"
                          ? "данных достаточно"
                          : s.status === "partial"
                          ? "данных пока недостаточно"
                          : "данных нет"
                      }
                    />
                  </div>
                  <p className={styles.sourceDesc}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Что сделать, чтобы появились рекомендации"
          className={styles.card}
        >
          <ol className={styles.steps}>
            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Заполнить анкету здоровья</h3>
                <p className={styles.stepDesc}>
                  Ответьте на вопросы о самочувствии, образе жизни и хронических
                  заболеваниях.
                </p>
                <Button disabled className={styles.stepButton}>
                  Перейти к анкете
                </Button>
              </div>
            </li>

            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>
                  Добавить показатели организма
                </h3>
                <p className={styles.stepDesc}>
                  Внесите давление, пульс, вес, сахар, холестерин и другие
                  важные параметры.
                </p>
                <Button disabled className={styles.stepButton}>
                  Открыть показатели
                </Button>
              </div>
            </li>

            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>Вести карту болей</h3>
                <p className={styles.stepDesc}>
                  Отмечайте, где и когда болит, выбирая тип и интенсивность
                  боли.
                </p>
                <Button disabled className={styles.stepButton}>
                  Открыть карту болей
                </Button>
              </div>
            </li>

            <li className={styles.stepItem}>
              <div className={styles.stepNumber}>4</div>
              <div className={styles.stepContent}>
                <h3 className={styles.stepTitle}>
                  (опционально) Импортировать данные из трекера
                </h3>
                <p className={styles.stepDesc}>
                  Если вы пользуетесь фитнес-браслетом или часами, подключите
                  шаги, активность и пульс — это улучшит анализ.
                </p>
                <Button disabled className={styles.stepButton}>
                  Импортировать данные
                </Button>
              </div>
            </li>
          </ol>
        </Card>
      </div>

      {loading && (
        <div className={styles.loadingHint}>Обновляем данные…</div>
      )}
    </div>
  );
}
