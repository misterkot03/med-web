import styles from "./Alert.module.css";
import clsx from "clsx";

export function Alert({
  children,
  type = "info",
  className,
}: {
  children: React.ReactNode;
  type?: "info" | "error";
  className?: string;
}) {
  return <div className={clsx(styles.root, styles[type], className)}>{children}</div>;
}
