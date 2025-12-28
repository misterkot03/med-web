"use client";
import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import s from "./PolygonMap.module.css";

export type PolygonMapProps = {
  /** Пока делаем только мужское тело спереди */
  variant?: "male-front";
  /** Предвыбранные зоны (id путей из SVG, например "1_1_28") */
  selected?: string[];
  /** Срабатывает на одиночный клик (после переключения выбранности) */
  onSelect?: (id: string, selected: boolean, allSelected: string[]) => void;
  /** Срабатывает на двойной клик — удобно открывать модалку */
  onDoubleClick?: (id: string) => void;
};

const SVG_BY_VARIANT: Record<string, string> = {
  "male-front": "/pain-map/Male_full_front.svg",
};

export default function PolygonMap({
  variant = "male-front",
  selected = [],
  onSelect,
  onDoubleClick,
}: PolygonMapProps) {
  const [svgText, setSvgText] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedSetRef = useRef<Set<string>>(new Set(selected));

  // синхронизация выделения (если придёт извне)
  useEffect(() => {
    selectedSetRef.current = new Set(selected);
    if (rootRef.current) {
      const paths = rootRef.current.querySelectorAll<SVGPathElement>("path[id]");
      paths.forEach((p) => {
        if (selectedSetRef.current.has(p.id)) p.classList.add(s.selected);
        else p.classList.remove(s.selected);
      });
    }
  }, [selected]);

  // загрузка SVG из public
  useEffect(() => {
    let isMounted = true;
    fetch(SVG_BY_VARIANT[variant])
      .then((r) => r.text())
      .then((t) => {
        if (!isMounted) return;
        setSvgText(t);
      })
      .catch((err) => {
        console.error("Failed to load SVG", err);
        setSvgText(`<div class="${s.error}">Не удалось загрузить SVG: ${String(err)}</div>`);
      });
    return () => {
      isMounted = false;
    };
  }, [variant]);

  // навешиваем интерактив как только svg вставлен в DOM
  useEffect(() => {
    if (!svgText || !rootRef.current) return;

    const container = rootRef.current;
    const paths = container.querySelectorAll<SVGPathElement>("path[id]");
    paths.forEach((p) => {
      p.classList.add(s.area);
      if (selectedSetRef.current.has(p.id)) p.classList.add(s.selected);
      p.style.cursor = "pointer";
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.tagName.toLowerCase() !== "path") return;
      const id = (target as SVGPathElement).id;
      if (!id) return;

      const set = selectedSetRef.current;
      const willSelect = !set.has(id);
      if (willSelect) {
        set.add(id);
        target.classList.add(s.selected);
        target.classList.remove(s.bump);
        // reflow
        void (target as any).offsetWidth;
        target.classList.add(s.bump);
      } else {
        set.delete(id);
        target.classList.remove(s.selected);
      }
      onSelect?.(id, willSelect, Array.from(set));
    };

    const handleDbl = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || target.tagName.toLowerCase() !== "path") return;
      const id = (target as SVGPathElement).id;
      if (!id) return;
      onDoubleClick?.(id);
    };

    container.addEventListener("click", handleClick);
    container.addEventListener("dblclick", handleDbl);
    return () => {
      container.removeEventListener("click", handleClick);
      container.removeEventListener("dblclick", handleDbl);
    };
  }, [svgText, onSelect, onDoubleClick]);

  return (
    <div className={s.wrap}>
      <div
        ref={rootRef}
        className={clsx(s.svgRoot)}
        dangerouslySetInnerHTML={svgText ? { __html: svgText } : undefined}
      />
      {!svgText && <div className={s.loading}>Загрузка…</div>}
    </div>
  );
}
