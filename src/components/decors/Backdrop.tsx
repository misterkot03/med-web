import styles from "./Backdrop.module.css";

/** Декоративный фон-градиент. Server Component, без 'use client'. */
export function Backdrop() {
  return (
    <div className={styles.root}>
      <div className={styles.layer} />
    </div>
  );
}
