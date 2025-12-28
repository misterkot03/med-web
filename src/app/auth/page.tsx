'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { loginUser, registerUser } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import styles from "./auth.module.css";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { setSession } = useAuth();
  const router = useRouter();

  const goToCabinet = () => {
    // даём контексту примениться и сразу уходим в кабинет
    router.replace("/app");
  };

  const onLogin = async (form: FormData) => {
    setErr(null); setLoading(true);
    try {
      const username = String(form.get("login") || "").trim();
      const password = String(form.get("password") || "");
      const res = await loginUser({ username, password });
      setSession({ userId: res.user_id, username: res.username, email: res.email });
      goToCabinet();
    } catch (e: any) {
      setErr(e?.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (form: FormData) => {
    setErr(null); setLoading(true);
    try {
      const username = String(form.get("username") || "").trim();
      const email = String(form.get("email") || "").trim();
      const password = String(form.get("password") || "");
      const res = await registerUser({ username, email, password });
      setSession({ userId: res.user_id, username, email });
      goToCabinet();
    } catch (e: any) {
      setErr(e?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <Card
        title={mode === "login" ? "Вход" : "Регистрация"}
        headerRight={
          <Button variant="secondary" size="sm" onClick={() => setMode(m => m === "login" ? "register" : "login")}>
            {mode === "login" ? "Создать аккаунт" : "У меня есть аккаунт"}
          </Button>
        }
      >
        <p className={styles.sub}>
          {mode === "login" ? "Авторизуйтесь, чтобы перейти в кабинет" : "Создайте аккаунт для доступа к платформе"}
        </p>

        {err && (
          <div style={{ background: "#fff3f3", border: "1px solid #ffd1d1", color: "#9b1c1c", borderRadius: 12, padding: 12 }}>
            {err}
          </div>
        )}

        {mode === "login" ? (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); onLogin(new FormData(e.currentTarget)); }}
          >
            <Input name="login" label="Логин или E-mail" placeholder="user@example.com" required />
            <PasswordInput name="password" label="Пароль" required />
            <div className={styles.hr} />
            <Button type="submit" block loading={loading}>Войти</Button>
          </form>
        ) : (
          <form
            className={styles.form}
            onSubmit={(e) => { e.preventDefault(); onRegister(new FormData(e.currentTarget)); }}
          >
            <Input name="username" label="Имя пользователя" placeholder="ivan_petrov" required />
            <Input name="email" type="email" label="E-mail" placeholder="user@example.com" required />
            <PasswordInput name="password" label="Пароль" required />
            <div className={styles.hr} />
            <Button type="submit" block loading={loading}>Зарегистрироваться</Button>
          </form>
        )}
      </Card>
    </div>
  );
}
