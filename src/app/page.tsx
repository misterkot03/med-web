"use client";

import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { Card } from "@/components/ui/Card";

import styles from "./page.module.css";

export default function LandingPage() {
  const { session } = useAuth();
  const isAuthed = !!session;
  const cabinetHref = "/app/app"; // при необходимости подправь путь

  const primaryCta = isAuthed ? (
    <Link href={cabinetHref} className={styles.primaryBtn}>
      Перейти в кабинет
    </Link>
  ) : (
    <Link href="/auth" className={styles.primaryBtn}>
      Войти в систему
    </Link>
  );

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Баннер */}
        <section className={styles.banner}>
          <div className={styles.bannerLeft}>
            <p className={styles.bannerLabel}>Бета-версия</p>
            <p className={styles.bannerTitle}>
              Платформа развивается — функционал будет расширяться
            </p>
            <p className={styles.bannerText}>
              Уже доступны анкеты, показатели, карта болей и рекомендации.
              В дальнейшем появятся новые отчёты и визуализации.
            </p>
          </div>

          <div className={styles.bannerRight}>
            <span className={styles.bannerPill}>
              Учебный медицинский проект
            </span>
          </div>
        </section>

        {/* Основной блок */}
        <section id="how" className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.heroBadge}>Цифровой медицинский помощник</p>
            <h1 className={styles.heroTitle}>
              Оценка самочувствия, анкеты, показатели и карта болей — в одном
              месте
            </h1>
            <p className={styles.heroLead}>
              Пациент отмечает симптомы и показатели, система их обрабатывает,
              а эксперт настраивает рекомендации. Всё это помогает врачу
              быстрее увидеть картину состояния.
            </p>

            <div className={styles.heroActions}>{primaryCta}</div>
          </div>

          <div className={styles.heroAside}>
            <Card title="Как это работает">
              <ol className={styles.stepsList}>
                <li>
                  Пациент заполняет анкеты, показатели и отмечает зоны боли.
                </li>
                <li>Система считает производные параметры и проверяет условия.</li>
                <li>
                  Эксперт настраивает рекомендации, которые видит пациент в
                  кабинете.
                </li>
              </ol>
            </Card>
          </div>
        </section>

        {/* Блоки «для кого» и безопасность */}
<section id="roles" className={styles.sectionGrid}>
  <Card title="Для пациента">
    <ul className={styles.bullets}>
      <li>Личный кабинет с анкетами, показателями и картой болей.</li>
      <li>История отметок и показателей в одном интерфейсе.</li>
      <li>
        Персональные рекомендации, сформированные автоматически на
        основе данных.
      </li>
    </ul>
  </Card>

  <Card title="Для эксперта">
    <ul className={styles.bullets}>
      <li>Админка для настройки условий и групп рекомендаций.</li>
      <li>Гибкая логика пороговых значений показателей.</li>
      <li>Доступ к структурированным данным пациентов.</li>
    </ul>
  </Card>

  <Card title="Безопасность данных">
    <div id="security">
      <ul className={styles.bullets}>
        <li>Разделение ролей пациента и эксперта.</li>
        <li>Авторизация по личным аккаунтам.</li>
        <li>Обмен данными через backend-API проекта.</li>
      </ul>
    </div>
  </Card>
</section>

      </main>
    </div>
  );
}
