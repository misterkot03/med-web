"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";
import {
  getInterviewsDescription,
  getParametersDescription,
  getRecommendationsForUser,
  getUserPainRecords,
} from "@/lib/api";

import styles from "./page.module.css";

type DashboardData = {
  interviewsCount: number | null;
  parametersCount: number | null;
  recommendationsCount: number | null;
  painRecordsCount: number | null;
  lastPainRecordDate: string | null;
};

export default function PatientHomePage() {
  const { session, logout } = useAuth();

  const [data, setData] = useState<DashboardData>({
    interviewsCount: null,
    parametersCount: null,
    recommendationsCount: null,
    painRecordsCount: null,
    lastPainRecordDate: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Если не залогинен — просим войти
  if (!session) {
    return (
      <div className="page-gap">
        <Card
          title="Кабинет пациента"
          headerRight={<Link href="/auth">Войти</Link>}
        >
          <p className={styles.text}>
            Для доступа к личному кабинету необходимо{" "}
            <Link href="/auth" className={styles.link}>
              войти в систему
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [interviews, parameters, recommendations, painRecords] =
          await Promise.all([
            getInterviewsDescription(),
            getParametersDescription(),
            getRecommendationsForUser(session.userId),
            getUserPainRecords(session.userId),
          ]);

        if (cancelled) return;

        const painList = Array.isArray(painRecords) ? painRecords : [];
        const lastPain =
          painList.length > 0
            ? [...painList].sort(
                (a: any, b: any) =>
                  new Date(b.record_date).getTime() -
                  new Date(a.record_date).getTime()
              )[0]
            : null;

        setData({
          interviewsCount: Array.isArray(interviews) ? interviews.length : 0,
          parametersCount: Array.isArray(parameters) ? parameters.length : 0,
          recommendationsCount: Array.isArray(recommendations)
            ? recommendations.length
            : 0,
          painRecordsCount: painList.length,
          lastPainRecordDate: lastPain?.record_date ?? null,
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(
            e?.message ||
              "Не удалось загрузить данные. Попробуйте обновить страницу."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session.userId]);

  const formatDate = (value: string | null) => {
    if (!value) return "нет отметок";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "нет данных";
    return d.toLocaleString();
  };

  return (
    <div className="page-gap">
      {/* Верхний блок с приветствием */}
      <Card
        title="Добро пожаловать!"
        headerRight={
          <div className={styles.headerRight}>
            <span className={styles.userBadge}>
              {session.username || session.email || `ID ${session.userId}`}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Выйти
            </Button>
          </div>
        }
      >
        <h2 className={styles.title}>Это ваш личный кабинет</h2>
        <p className={styles.lead}>
          Здесь собираются ваши анкеты, показатели, рекомендации и карта болей.
          Заполняйте данные в удобном темпе — это помогает врачу точнее
          оценивать ваше состояние.
        </p>

        <div className={styles.quickNav}>
          <span className={styles.quickNavLabel}>Быстрый переход:</span>
          <Link href="/app/app/interviews" className={styles.quickNavLink}>
            Анкеты
          </Link>
          <Link href="/app/app/indicators" className={styles.quickNavLink}>
            Показатели
          </Link>
          <Link href="/app/app/recommendations" className={styles.quickNavLink}>
            Рекомендации
          </Link>
          <Link href="/app/app/pain-map" className={styles.quickNavLink}>
            Карта болей
          </Link>
        </div>

        {error && (
          <div className={styles.topAlert}>
            <Alert type="error">{error}</Alert>
          </div>
        )}
      </Card>

      {/* Основная сетка с краткой сводкой */}
      <div className={styles.grid}>
        {/* Анкеты */}
        <Card title="Анкеты">
          {loading && (
            <p className={styles.muted}>Загружаем данные по анкетам…</p>
          )}
          {!loading && (
            <>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statValue}>
                    {data.interviewsCount ?? "—"}
                  </div>
                  <div className={styles.statLabel}>
                    доступных анкет для заполнения
                  </div>
                </div>
              </div>

              <p className={styles.muted}>
                Ответы помогают уточнить диагноз и понять ваш образ жизни.
              </p>

              <div className={styles.cardFooter}>
                <Link
                  href="/app/app/interviews"
                  className={styles.cardButton}
                >
                  Перейти к анкетам
                </Link>
              </div>
            </>
          )}
        </Card>

        {/* Показатели */}
        <Card title="Показатели">
          {loading && (
            <p className={styles.muted}>Загружаем данные по показателям…</p>
          )}
          {!loading && (
            <>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statValue}>
                    {data.parametersCount ?? "—"}
                  </div>
                  <div className={styles.statLabel}>
                    параметров отслеживается системой
                  </div>
                </div>
              </div>

              <p className={styles.muted}>
                Давление, пульс, вес и другие показатели помогают увидеть
                динамику вашего состояния.
              </p>

              <div className={styles.cardFooter}>
                <Link
                  href="/app/app/indicators"
                  className={styles.cardButton}
                >
                  Открыть показатели
                </Link>
              </div>
            </>
          )}
        </Card>

        {/* Рекомендации */}
        <Card title="Рекомендации">
          {loading && (
            <p className={styles.muted}>Загружаем ваши рекомендации…</p>
          )}
          {!loading && (
            <>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statValue}>
                    {data.recommendationsCount ?? "—"}
                  </div>
                  <div className={styles.statLabel}>
                    активных рекомендаций на основе ваших данных
                  </div>
                </div>
              </div>

              {data.recommendationsCount === 0 && (
                <p className={styles.muted}>
                  Рекомендации появятся после заполнения анкет и показателей.
                </p>
              )}

              <div className={styles.cardFooter}>
                <Link
                  href="/app/app/recommendations"
                  className={styles.cardButton}
                >
                  Посмотреть рекомендации
                </Link>
              </div>
            </>
          )}
        </Card>

        {/* Карта болей */}
        <Card title="Карта болей">
          {loading && (
            <p className={styles.muted}>Загружаем ваши отметки…</p>
          )}
          {!loading && (
            <>
              <div className={styles.statRow}>
                <div>
                  <div className={styles.statValue}>
                    {data.painRecordsCount ?? "—"}
                  </div>
                  <div className={styles.statLabel}>
                    записей о болевых ощущениях
                  </div>
                </div>
              </div>

              <p className={styles.muted}>
                Последняя отметка: {formatDate(data.lastPainRecordDate)}
              </p>

              <div className={styles.cardFooter}>
                <Link href="/app/app/pain-map" className={styles.cardButton}>
                  Открыть карту болей
                </Link>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
