'use client';
import { InputHTMLAttributes, forwardRef } from "react";
import styles from "./Input.module.css";

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, hint, error, className, ...rest }, ref) => {
    return (
      <label className={styles.root}>
        {label && <div className={styles.label}>{label}</div>}
        <div className={styles.field}>
          <input ref={ref} {...rest} className={styles.input} />
        </div>
        {hint && !error && <div className={styles.hint}>{hint}</div>}
        {error && <div className={styles.error}>{error}</div>}
      </label>
    );
  }
);
Input.displayName = "Input";
