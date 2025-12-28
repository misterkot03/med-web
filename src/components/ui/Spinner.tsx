import styles from "./Spinner.module.css";
export function Spinner({ label = "Загрузка…" }: { label?: string }) {
  return (
    <div className={styles.dots} aria-live="polite" aria-busy="true">
      <span className={styles.dot} /><span className={styles.dot} /><span className={styles.dot} />
      <span style={{ marginLeft: 8 }}>{label}</span>
    </div>
  );
}
