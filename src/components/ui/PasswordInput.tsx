'use client';
import { useState } from "react";
import { Input, type TextInputProps } from "./Input";
import styles from "./Input.module.css";

export type PasswordInputProps = Omit<TextInputProps, "type">;

export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className={styles.field}>
        <Input {...props} type={show ? "text" : "password"} />
        <button
          type="button"
          className={styles.iconBtn}
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        >
          {show ? "Скрыть" : "Показать"}
        </button>
      </div>
    </div>
  );
}
