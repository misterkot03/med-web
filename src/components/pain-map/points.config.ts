export type RegionKey =
  | "full"
  | "head"
  | "torso"
  | "leftArm"
  | "rightArm"
  | "leftLeg"
  | "rightLeg";

export type PointCfg = { id: number; name: string; x: number; y: number };

/** Локальные координаты 0..1000 для каждой части (внутри viewBox зоны). */
export const REGION_POINTS: Record<Exclude<RegionKey, "full">, PointCfg[]> = {
  head: [
    { id: 101, name: "Лоб",          x: 500, y: 250 },
    { id: 102, name: "Переносица",   x: 500, y: 450 },
    { id: 103, name: "Левая щека",   x: 350, y: 600 },
    { id: 104, name: "Правая щека",  x: 650, y: 600 },
    { id: 105, name: "Подбородок",   x: 500, y: 750 },
  ],

  torso: [
    { id: 201, name: "Верх спины",     x: 500, y: 250 },
    { id: 202, name: "Середина спины", x: 500, y: 380 },
    { id: 203, name: "Низ спины",      x: 500, y: 520 },
  ],

  /** ЛЕВАЯ РУКА (вид слева, предплечье смотрит вправо) */
  rightArm: [
    { id: 301, name: "Плечо",    x: 180, y: 120 },  // верхняя «шишка»
    { id: 302, name: "Бицепс",   x: 250, y: 400 },  // ближе к внутренней стороне
    { id: 303, name: "Трицепс",  x: 150, y: 380 },  // сзади руки
    { id: 304, name: "Локоть",   x: 230, y: 590 },
    { id: 305, name: "Запястье", x: 600, y: 750 },
  ],

  /** ПРАВАЯ РУКА (вид справа, предплечье смотрит влево) */
  leftArm: [
    { id: 401, name: "Плечо",    x: 820, y: 120 },
    { id: 402, name: "Бицепс",   x: 740, y: 390 },
    { id: 403, name: "Трицепс",  x: 850, y: 380 },
    { id: 404, name: "Локоть",   x: 750, y: 600 },
    { id: 405, name: "Запястье", x: 400, y: 750 },
  ],

  leftLeg: [
    { id: 501, name: "Бедро",  x: 560, y: 420 },
    { id: 502, name: "Колено", x: 560, y: 590 },
    { id: 503, name: "Стопа",  x: 580, y: 920 },
  ],

  rightLeg: [
    { id: 601, name: "Бедро",  x: 440, y: 420 },
    { id: 602, name: "Колено", x: 440, y: 590 },
    { id: 603, name: "Стопа",  x: 420, y: 920 },
  ],
};

/** Быстрый поиск названия по id */
export const POINT_NAME_BY_ID: Record<number, string> = Object.fromEntries(
  Object.values(REGION_POINTS).flat().map(p => [p.id, p.name])
);
