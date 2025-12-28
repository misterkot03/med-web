'use client';
import styles from "./Select.module.css";

export type Option = { label: string; value: string | number };

export function Select({
  label,
  value,
  onChange,
  options,
  name,
}: {
  label?: string;
  value?: string | number;
  onChange?: (v: string) => void;
  options: Option[];
  name?: string;
}) {
  return (
    <label className={styles.root}>
      {label && <div className={styles.label}>{label}</div>}
      <select
        className={styles.select}
        name={name}
        value={value as any}
        onChange={(e) => onChange?.(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
