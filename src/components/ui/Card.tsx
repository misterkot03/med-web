import styles from "./Card.module.css";
import clsx from "clsx";

type Props = {
  title?: string;
  className?: string;
  children?: React.ReactNode;
  headerRight?: React.ReactNode;
};

export function Card({ title, className, headerRight, children }: Props) {
  return (
    <section className={clsx(styles.card, className)}>
      {(title || headerRight) && (
        <div className={styles.header}>
          {title && <h2 className={styles.title}>{title}</h2>}
          {headerRight}
        </div>
      )}
      <div className={styles.content}>{children}</div>
    </section>
  );
}
