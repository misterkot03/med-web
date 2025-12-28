'use client';
import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";
import clsx from "clsx";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  block?: boolean;
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  block,
  size = "md",
  loading,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={clsx(styles.btn, styles[variant], block && styles.block, size === "sm" && styles.sm, className)}
      disabled={loading || rest.disabled}
    >
      {loading ? "Загрузка…" : children}
    </button>
  );
}
