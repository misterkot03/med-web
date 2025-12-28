import { RequireAuth } from "@/lib/route-guard";
import Link from "next/link";
import styles from "./patient-layout.module.css";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className={styles.grid}>
        <aside className={styles.aside}>
          <div className={styles.sectionTitle}>Пациент</div>
          <nav className={styles.nav}>
            <Link href="/app">Главная</Link>
            <Link href="/app/interviews">Анкеты</Link>
            <Link href="/app/indicators">Показатели</Link>
            <Link href="/app/recommendations">Рекомендации</Link>
            <Link href="/app/pain-map">Карта болей</Link>
          </nav>
        </aside>
        <section className={styles.content}>{children}</section>
      </div>
    </RequireAuth>
  );
}
