'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './BodyMap.module.css';
import { POINT_NAME_BY_ID } from './points.config';

/** Пол/сторона */
export type GenderCode = 'male' | 'female';
export type Side = 'front' | 'back';

/** То, что возвращаем наружу при клике по зоне */
export type ZoneClickPayload = {
  zone_code: string;      // id path из SVG, напр. "1_1_24"
  zone_name: string;      // человекочитаемое имя зоны
  gender_code: GenderCode; // "male" | "female"
  side: Side;             // "front" | "back"
};

/** Пропсы карты */
type BodyMapProps = {
  userId?: number;
  onPickZone?: (payload: ZoneClickPayload) => void;
  initialGender?: GenderCode;
  initialSide?: Side;
};

/** Карты файлов SVG */
const FILES = {
  male: {
    front: {
      full: '/pain-map/Male_full_front.svg',
      head: '/pain-map/Male_head_front.svg',
    },
    back: {
      full: '/pain-map/Male_full_back.svg',
      head: '/pain-map/Male_head_back.svg',
    },
  },
  female: {
    front: {
      full: '/pain-map/Female_full_front.svg',
      head: '/pain-map/Female_head_front.svg',
    },
    back: {
      full: '/pain-map/Female_full_back.svg',
      head: '/pain-map/Female_head_back.svg',
    },
  },
} as const;

/** Имя зоны по id из SVG */
function zoneNameFromId(id: string): string {
  if (id === 'head') return 'Голова';

  // id вида "1_1_24" → "11124"
  const digits = id.replace(/[^\d]/g, '');
  const num = Number(digits);
  if (Number.isFinite(num) && POINT_NAME_BY_ID[num]) {
    return POINT_NAME_BY_ID[num];
  }

  // запасной вариант — просто "1.1.24"
  return id.replaceAll('_', '.');
}

/** Заменяет/создаёт <title> у path, чтобы нативный тултип работал */
function setPathTitle(el: SVGElement, text: string) {
  el.querySelectorAll('title').forEach((t) => t.remove());
  const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
  t.textContent = text;
  el.prepend(t);
}

export default function BodyMap({
  userId,
  onPickZone,
  initialGender = 'male',
  initialSide = 'front',
}: BodyMapProps) {
  /** UI-состояние */
  const [gender, setGender] = useState<GenderCode>(initialGender);
  const [side, setSide] = useState<Side>(initialSide);
  const [view, setView] = useState<'full' | 'head'>('full'); // full ↔ head

  /** загрузка SVG */
  const [svgText, setSvgText] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const src = useMemo(() => FILES[gender][side][view], [gender, side, view]);

  // подгружаем SVG каждого изменения вида/пола/стороны
  useEffect(() => {
    let cancelled = false;
    setSvgText(null);

    fetch(src)
      .then((r) => r.text())
      .then((txt) => !cancelled && setSvgText(txt))
      .catch((err) => {
        console.error('BodyMap: failed to load', src, err);
        !cancelled &&
          setSvgText(
            `<div class="${styles.error}">Не удалось загрузить SVG</div>`,
          );
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  // навешиваем интерактив
  useEffect(() => {
    if (!svgText || !rootRef.current) return;

    const container = rootRef.current;
    const paths = container.querySelectorAll<SVGPathElement>('path[id]');

    // подготовка стилей и тултипов
    paths.forEach((p) => {
      p.classList.add(styles.area);
      p.style.cursor = 'pointer';
      setPathTitle(p, zoneNameFromId(p.id));
    });

    const handleClick = (e: MouseEvent) => {
      const target = e.target;

      // гарантируем TS, что это именно SVGPathElement
      if (!(target instanceof SVGPathElement)) {
        return;
      }

      const path: SVGPathElement = target;
      const id = path.id;
      if (!id) return;

      const zoneName = zoneNameFromId(id);

      // 1) В full-виде по клику на голову (id="head") → показываем SVG головы
      if (view === 'full' && id === 'head') {
        setView('head');
        return;
      }

      // 2) Любой клик (кроме head в full) → отдаём зону наружу, открываем модалку
      let cx = 0;
      let cy = 0;
      try {
        const box = path.getBBox();
        cx = box.x + box.width / 2;
        cy = box.y + box.height / 2;
      } catch {
        // если getBBox не сработал — оставим (0,0), но это редкость
      }

      onPickZone?.({
        zone_code: id,
        zone_name: zoneName,
        gender_code: gender,
        side,
      });

      // лёгкий bump-эффект
      path.classList.remove(styles.bump);
      void (path as any).offsetWidth;
      path.classList.add(styles.bump);
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [svgText, view, gender, side, onPickZone]);

  return (
    <div className={styles.wrap}>
      {/* Панель управления — оставил твой стиль сегментов */}
      <div className={styles.toolbar}>
        <div className={styles.segment}>
          <button
            className={`${styles.segmentBtn} ${
              gender === 'male' ? styles.active : ''
            }`}
            onClick={() => {
              setGender('male');
              setView('full');
            }}
          >
            Мужской
          </button>
          <button
            className={`${styles.segmentBtn} ${
              gender === 'female' ? styles.active : ''
            }`}
            onClick={() => {
              setGender('female');
              setView('full');
            }}
          >
            Женский
          </button>
        </div>

        <div className={styles.segment}>
          <button
            className={`${styles.segmentBtn} ${
              side === 'front' ? styles.active : ''
            }`}
            onClick={() => {
              setSide('front');
              setView('full');
            }}
          >
            Спереди
          </button>
          <button
            className={`${styles.segmentBtn} ${
              side === 'back' ? styles.active : ''
            }`}
            onClick={() => {
              setSide('back');
              setView('full');
            }}
          >
            Сзади
          </button>
        </div>

        {view === 'head' && (
          <button className={styles.backBtn} onClick={() => setView('full')}>
            ← К общему виду
          </button>
        )}
      </div>

      {/* Сам SVG */}
      <div
        ref={rootRef}
        className={`${styles.svgRoot} ${
          svgText ? styles.fadeIn : styles.fadeOut
        }`}
        dangerouslySetInnerHTML={svgText ? { __html: svgText } : undefined}
      />
      {!svgText && <div className={styles.loading}>Загрузка…</div>}
    </div>
  );
}
