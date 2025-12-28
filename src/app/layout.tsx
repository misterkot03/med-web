import type { Metadata } from "next";
import "./globals.css";
import styles from "./layout.module.css";
import Link from "next/link";
import { AuthProvider } from "@/lib/AuthContext";
import { Backdrop } from "@/components/decors/Backdrop";

export const metadata: Metadata = {
  title: "ЦМП",
  description: "Центр медицинской платформы (ЦМП): карта болей, анкеты и рекомендации",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Backdrop />
        <AuthProvider>
          <header className={styles.header}>
            <div className="container">
              <div className={styles.nav}>
                <Link href="/" className={styles.brand}>
                   ЦМП <small>platform</small>
                </Link>
                <nav className={styles.links}>
                  <Link href="/auth">Войти</Link>
                  <Link href="/app">Пациент</Link>
                  <Link href="/expert">Эксперт</Link>
                </nav>
              </div>
            </div>
          </header>
          <main className="container page-gap">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
