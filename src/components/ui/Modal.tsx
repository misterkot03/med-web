'use client';
import styles from "./Modal.module.css";

export function Modal({
  open, title, children, footer, onClose,
}: {
  open: boolean;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>{title}</div>
          <button onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className={styles.content}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
