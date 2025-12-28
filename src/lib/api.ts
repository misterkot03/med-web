/* =========================================
 * API client for ЦМП (Next.js client-side)
 * ========================================= */

// --- новый блок BASE/API со знанием о прокси ---
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE;
const IS_BROWSER = typeof window !== "undefined";

// В браузере ходим в наш прокси (/api/cmp), на сервере (SSR/RSC) — прямо в API
function getBase(): string {
  if (IS_BROWSER) return "/api/cmp"; // <- ключевая строка
  if (!RAW_BASE) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE is not set. Проверьте /.env.local\n" +
        "Например: NEXT_PUBLIC_API_BASE=http://62.84.116.147:8001"
    );
  }
  return RAW_BASE;
}

if (IS_BROWSER) {
  console.log("[API] Using proxy base = /api/cmp (CORS-safe)");
} else {
  console.log("[API] Direct server base =", RAW_BASE);
}

const API = (path: string) => {
  const base = getBase();
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

/* ---------- low level fetch with quiet mode ---------- */

type ApiFail = {
  ok: false;
  status?: number;
  url?: string;
  message?: string;
  detail?: unknown;
};
type ApiOk<T> = { ok: true; data: T };
type ApiResult<T> = ApiOk<T> | ApiFail;

const SILENT_STATUSES = new Set([400, 401, 403, 404, 405, 409, 410, 415, 422]);

function buildError(e: any): ApiFail {
  if (e && typeof e === "object" && "status" in e) return e as ApiFail;
  return { ok: false, message: typeof e?.message === "string" ? e.message : String(e) };
}

/** Низкоуровневый запрос; quiet=true — не логируем ожидаемые 4xx */
async function requestCore<T>(path: string, init?: RequestInit, quiet = false): Promise<ApiResult<T>> {
  const url = API(path);
  try {
    const res = await fetch(url, { ...init, headers: { ...(init?.headers || {}) } });

    if (!res.ok) {
      let message = res.statusText || "";
      let detail: unknown = undefined;
      try {
        detail = await res.clone().json();
        if (detail && typeof detail === "object" && "detail" in (detail as any)) {
          message = JSON.stringify((detail as any).detail);
        } else {
          message = JSON.stringify(detail);
        }
      } catch {
        try {
          const txt = await res.text();
          detail = txt;
          if (txt) message = txt;
        } catch {}
      }
      const err: ApiFail = { ok: false, status: res.status, url, message, detail };
      if (!(quiet && SILENT_STATUSES.has(res.status))) {
        console.error("[API ERROR]", err);
      }
      return err;
    }

    try {
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      // пустое тело
      return { ok: true, data: undefined as unknown as T };
    }
  } catch (e: any) {
    const err = buildError(e);
    err.url = url;
    if (!quiet) console.error("[API ERROR]", err);
    return err;
  }
}

/** Удобный wrapper (шумный) */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await requestCore<T>(path, init, false);
  if (!r.ok) throw r;
  return r.data;
}

/** Тихо пробуем несколько путей; 5xx — сразу бросаем */
async function tryGet<T>(paths: string[]): Promise<T | undefined> {
  for (const p of paths) {
    const r = await requestCore<T>(p, { method: "GET" }, true);
    if (r.ok) return r.data;
    if (r.status && r.status >= 500) throw r;
  }
  return undefined;
}

/* --------------- small helpers --------------- */

function num(x: any): number | undefined {
  if (x == null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function okArray(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.points)) return x.points;
  if (Array.isArray(x?.pain_points)) return x.pain_points;
  if (Array.isArray(x?.records)) return x.records;
  if (Array.isArray(x?.items)) return x.items;
  if (Array.isArray(x?.data)) return x.data;
  return [];
}

function normCoord(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n <= 1 ? n * 1000 : n; // поддержка долей 0..1
}

/* ======================
 *          AUTH
 * ====================== */

export type LoginPayload = { username: string; password: string };
export type LoginResponse = { user_id: number; username?: string; email?: string };

export async function loginUser({ username, password }: LoginPayload): Promise<LoginResponse> {
  // поддерживаем бэки, где логин/email кладут в разные поля
  const body = { login: username, username, email: username, password };
  const data = await request<any>("/AccessPoints/LoginUser/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const user_id =
    num(data?.user_id) ?? num(data?.id) ?? num(data?.userId) ?? num(data?.userid);
  if (!user_id) {
    throw { ok: false, status: 500, message: "Не удалось определить user_id", detail: data } as ApiFail;
  }
  return {
    user_id,
    username: data?.username ?? data?.login,
    email: data?.email,
  };
}

export type RegisterPayload = { username: string; email: string; password: string };
export type RegisterResponse = { user_id: number };

export async function registerUser({ username, email, password }: RegisterPayload): Promise<RegisterResponse> {
  const data = await request<any>("/AccessPoints/RegisterUser/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const user_id =
    num(data?.user_id) ?? num(data?.id) ?? num(data?.userId) ?? num(data?.userid);
  if (!user_id) {
    throw { ok: false, status: 500, message: "Не удалось определить user_id", detail: data } as ApiFail;
  }
  return { user_id };
}

/* ======================
 *     DICTS / СЛОВАРИ
 * ====================== */

export type DictItem = { id: number; name?: string; level?: number; description?: string; period?: string };

export type PainCharacteristics = {
  pain_intensity: DictItem[];
  pain_type: DictItem[];
  body_position: DictItem[];
  breathing_relation: DictItem[];
  physical_activity_relation: DictItem[];
  stress_relation: DictItem[];
  time_of_day: DictItem[];
};

export async function getPainCharacteristics(): Promise<PainCharacteristics> {
let data =
  (await tryGet<any>([
    "/AccessPoints/PainCharacteristics/",
    "/AccessPoints/GetPainCharacteristics/",
    "/AccessPoints/GetPainReferences/",
    "/AccessPoints/References/",
    "/AccessPoints/ReferencePainCharacteristics/",
  ])) || {};

// некоторые бэки кладут полезное внутрь data
if (data && typeof data === "object" && Array.isArray((data as any).data)) {
  data = (data as any).data[0] ?? data;
}

  return {
    pain_intensity: data.pain_intensity ?? data.intensity ?? [],
    pain_type: data.pain_type ?? data.types ?? [],
    body_position: data.body_position ?? data.positions ?? [],
    breathing_relation: data.breathing_relation ?? data.breathing ?? [],
    physical_activity_relation: data.physical_activity_relation ?? data.activity_relation ?? [],
    stress_relation: data.stress_relation ?? data.stress ?? [],
    time_of_day: data.time_of_day ?? data.day_period ?? [],
  };
}


/* ======================
 *     PAIN MAP / ТОЧКИ
 * ====================== */

/** Плоская точка карты (после разворота coordinates[]) */
export type PainPointDto = {
  pain_point_id: number;
  pain_point_name: string;
  body_part_name?: string;
  x: number;
  y: number;
};

/**
 * Точки для платформы:
 *  - корректные пути (c fallback)
 *  - разворачиваем coordinates[] в плоский список
 *  - координаты нормализуем к 0..1000
 */
export async function getPainPoints(platform_id = 1): Promise<PainPointDto[]> {
  const data =
    (await tryGet<any>([
      `/AccessPoints/PainPointForPlatform/?platform_id=${platform_id}`,
      `/AccessPoints/GetPainPointsForPlatform/?platform_id=${platform_id}`,
      `/AccessPoints/GetPainPoints/?platform_id=${platform_id}`,
      `/AccessPoints/PainPoints/?platform_id=${platform_id}`,
      `/AccessPoints/PointsForPlatform/?platform_id=${platform_id}`,
    ])) || [];

  const arr = okArray(data);
  const flat: PainPointDto[] = [];

  for (const p of arr) {
    const pain_point_id =
      num(p?.pain_point_id) ?? num(p?.id) ?? num(p?.point_id);
    if (!pain_point_id) continue;

    const pain_point_name =
      p?.pain_point_name ?? p?.name ?? p?.point_name ?? `Точка ${pain_point_id}`;
    const body_part_name = p?.body_part_name ?? p?.body_part;

    const coords = Array.isArray(p?.coordinates)
      ? p.coordinates
      : (p?.x_coord != null && p?.y_coord != null
          ? [{ x_coord: p.x_coord, y_coord: p.y_coord }]
          : []);

    for (const c of coords) {
      const x = normCoord(c?.x_coord);
      const y = normCoord(c?.y_coord);
      if (x == null || y == null) continue;

      flat.push({
        pain_point_id,
        pain_point_name: String(pain_point_name),
        body_part_name: body_part_name ? String(body_part_name) : undefined,
        x,
        y,
      });
    }
  }

  // console.log("[pain points]", flat);
  return flat;
}

/* ======================
 *  SAVE PAIN POINT (DICT)
 * ====================== */

export type SavePainPointPayload = {
  /** Обязательные для эндпоинта поля */
  platform_id: number;
  /** Координаты только в 0..1000; сервер ждёт заглавные имена */
  X_coord: number;
  Y_coord: number;

  /** Опционально: если точка уже есть в БД и ты хочешь её привязать к платформе */
  pain_point_id?: number;
  /** Или можно прислать имя — сервер создаст новую запись и вернёт id */
  pain_point_name?: string;
  /** Тоже опционально, если бэк это сохраняет */
  body_part_name?: string;
};

export type SavePainPointResponse = {
  pain_point_id: number;
  [k: string]: any;
};

export async function savePainPoint(payload: SavePainPointPayload): Promise<SavePainPointResponse> {
  // NB: этот эндпоинт чувствителен к регистру свойств (X_coord/Y_coord)
  const r = await requestCore<SavePainPointResponse>("/AccessPoints/SavePainPoints/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, /*quiet*/ false);

  if (!r.ok) {
    throw {
      ok: false,
      message: `Не удалось сохранить точку боли (SavePainPoints): ${r.message ?? ""}`,
      detail: r,
    };
  }
  return r.data;
}

/* ======================
 *  SAVE USER PAIN RECORD
 * ====================== */

export type SaveUserPainRecordPayload = {
  user_id: number;

  /** ЛЮБОЕ ОДНО из двух полей: */
  pain_point_id?: number;     // старый способ (точка/координаты)
  pain_zone_code?: string;    // новый способ (полигон, id из SVG, например "1_1_28")

  pain_intensity_id?: number;
  pain_type_id?: number;
  body_position_id?: number;
  breathing_relation_id?: number;
  physical_activity_relation_id?: number;
  stress_relation_id?: number;
  time_of_day_id?: number;
  record_date?: string;       // если не передать, поставим текущий момент
};

export async function saveUserPainRecord(payload: SaveUserPainRecordPayload) {
  const body: Record<string, any> = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") body[k] = v;
  });
  if (!body.record_date) body.record_date = new Date().toISOString();

  // Важно: бэк теперь должен принимать pain_zone_code (строка).
  // Если его нет — можно слать pain_point_id (старый сценарий).
  const r = await requestCore<any>("/AccessPoints/SaveUserPainRecord/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, /*quiet*/ false);

  if (!r.ok) {
    throw {
      ok: false,
      message: `Не удалось сохранить запись боли (SaveUserPainRecord): ${r.message ?? ""}`,
      detail: r,
    };
  }
  return r.data;
}


/* ==========================================================
 *  HIGH-LEVEL: ensure point exists -> save user pain record
 * ========================================================== */



/* ======================
 *  SMART SAVE (точка + запись)
 * ====================== */

/** Попытаться вытащить id из произвольного ответа бэка */
function extractPointId(raw: any): number | undefined {
  const tryNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

  if (raw == null) return undefined;

  // обычные варианты
  const direct =
    tryNum(raw.pain_point_id) ??
    tryNum(raw.point_id) ??
    tryNum(raw.id) ??
    tryNum(raw?.data?.pain_point_id) ??
    tryNum(raw?.data?.id);
  if (direct) return direct;

  // иногда приходят массивы объектов
  if (Array.isArray(raw) && raw.length) {
    const fromArr =
      tryNum(raw[0]?.pain_point_id) ??
      tryNum(raw[0]?.point_id) ??
      tryNum(raw[0]?.id);
    if (fromArr) return fromArr;
  }

  // иногда объект { data: [...] }
  if (Array.isArray(raw?.data) && raw.data.length) {
    const fromData =
      tryNum(raw.data[0]?.pain_point_id) ??
      tryNum(raw.data[0]?.point_id) ??
      tryNum(raw.data[0]?.id);
    if (fromData) return fromData;
  }

  // может вернуть просто число
  if (typeof raw === "number") return tryNum(raw);

  return undefined;
}

/** Найти точку после сохранения: по имени и/или ближайшим координатам */
async function resolvePointIdByList(
  platform_id: number,
  x: number,
  y: number,
  name?: string
): Promise<number | undefined> {
  const data =
    (await tryGet<any>([
      `/AccessPoints/GetPainPoints/?platform_id=${platform_id}`,
      `/AccessPoints/GetPainPointsForPlatform/?platform_id=${platform_id}`,
      `/AccessPoints/PainPoints/?platform_id=${platform_id}`,
      `/AccessPoints/PointsForPlatform/?platform_id=${platform_id}`,
      `/AccessPoints/PainPointForPlatform/?platform_id=${platform_id}`,
    ])) || [];

  const arr = okArray(data);
  if (!arr.length) return undefined;

  // нормализуем имя для сравнения
  const wanted = (name ?? "").trim().toLowerCase();

  // соберём кандидатов с координатами
  type Cand = { id: number; name: string; x: number; y: number; d2: number; nameScore: number };
  const cands: Cand[] = [];

  for (const p of arr) {
    const id =
      num(p?.pain_point_id) ?? num(p?.id) ?? num(p?.point_id);
    if (!id) continue;

    const nm = String(p?.pain_point_name ?? p?.name ?? p?.point_name ?? "");
    const cx = normCoord(p?.x_coord ?? p?.x ?? p?.X_coord) ?? normCoord(p?.coordinates?.[0]?.x_coord);
    const cy = normCoord(p?.y_coord ?? p?.y ?? p?.Y_coord) ?? normCoord(p?.coordinates?.[0]?.y_coord);
    if (cx == null || cy == null) continue;

    const dx = cx - x;
    const dy = cy - y;
    const d2 = dx * dx + dy * dy;

    const nn = nm.trim().toLowerCase();
    let nameScore = 0;
    if (wanted && nn) {
      if (nn === wanted) nameScore = 2;            // точное совпадение
      else if (nn.includes(wanted) || wanted.includes(nn)) nameScore = 1; // частичное
    }

    cands.push({ id, name: nm, x: cx, y: cy, d2, nameScore });
  }

  if (!cands.length) return undefined;

  // приоритет по имени, затем по ближайшим координатам
  cands.sort((a, b) => {
    if (b.nameScore !== a.nameScore) return b.nameScore - a.nameScore;
    return a.d2 - b.d2;
  });

  return cands[0]?.id;
}

/**
 * Универсальная запись:
 * 1) если pain_point_id уже есть — сразу пишем запись пользователя
 * 2) иначе создаём/находим точку через SavePainPoints (с X/Y и platform_id),
 *    получаем id из ответа; если бэк его не вернул — ищем в списке точек
 * 3) затем POST в SaveUserPainRecord
 */
export async function savePainRecordSmart(payload: {
  user_id: number;
  platform_id?: number; // старому сценарию нужно; для полигонов — не обязателен
  x?: number;
  y?: number;

  // либо polygonCode (новое), либо pain_point_id/pain_point_name (старое):
  polygonCode?: string;
  pain_point_name?: string;
  pain_point_id?: number;

  pain_intensity_id?: number;
  pain_type_id?: number;
  body_position_id?: number;
  breathing_relation_id?: number;
  physical_activity_relation_id?: number;
  stress_relation_id?: number;
  time_of_day_id?: number;
}) {
  const toInt = (v: any) =>
    v === undefined || v === null || v === "" ? undefined : Number(v);

  const {
    user_id,
    platform_id,
    x, y,
    polygonCode,              // <-- новый путь (полигон)
    pain_point_name,
    pain_point_id: maybeId,
    pain_intensity_id,
    pain_type_id,
    body_position_id,
    breathing_relation_id,
    physical_activity_relation_id,
    stress_relation_id,
    time_of_day_id,
  } = payload;

  // --- НОВЫЙ ПУТЬ: полигон ---
  if (polygonCode && typeof polygonCode === "string" && polygonCode.trim()) {
    const body: Record<string, any> = {
      user_id: toInt(user_id),
      pain_zone_code: polygonCode.trim(),           // <- ключевая строка
      pain_intensity_id: toInt(pain_intensity_id),
      pain_type_id: toInt(pain_type_id),
      body_position_id: toInt(body_position_id),
      breathing_relation_id: toInt(breathing_relation_id),
      physical_activity_relation_id: toInt(physical_activity_relation_id),
      stress_relation_id: toInt(stress_relation_id),
      time_of_day_id: toInt(time_of_day_id),
    };
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    const res = await requestCore<any>(
      "/AccessPoints/SaveUserPainRecord/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      false
    );

    if (!res.ok) {
      if (res.status === 422) {
        throw new Error(
          typeof res.message === "string"
            ? res.message
            : "Ошибка валидации (422). Проверьте обязательные поля."
        );
      }
      throw new Error(
        "Не удалось сохранить запись боли: сервер отверг запрос SaveUserPainRecord."
      );
    }
    return res.data;
  }

  // --- СТАРЫЙ ПУТЬ: точки (останавливать не будем) ---
  // гарантируем ID точки (как у тебя было раньше)
  let pain_point_id = toInt(maybeId);

  if (!pain_point_id) {
    if (platform_id == null || x == null || y == null) {
      throw new Error("Для старого сценария (точки) нужны platform_id, x, y или уже известный pain_point_id.");
    }

    const saveBody = {
      platform_id: toInt(platform_id),
      X_coord: Math.round(Number(x)),
      Y_coord: Math.round(Number(y)),
      point_name: pain_point_name ?? "Точка боли",
    };

    const saveRes = await requestCore<any>(
      "/AccessPoints/SavePainPoints/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saveBody),
      },
      false
    );

    if (saveRes.ok) {
      const tryNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
      pain_point_id =
        tryNum((saveRes.data as any)?.pain_point_id) ??
        tryNum((saveRes.data as any)?.point_id) ??
        tryNum((saveRes.data as any)?.id);
    }

    if (!pain_point_id) {
      // если бэк не вернул id — можно попытаться найти точку по списку и близости
      const id = await resolvePointIdByList(
        saveBody.platform_id!, saveBody.X_coord, saveBody.Y_coord, saveBody.point_name
      );
      if (id) pain_point_id = id;
    }

    if (!pain_point_id) {
      throw new Error(
        "Сервер не вернул pain_point_id после SavePainPoints и не удалось определить его из списка."
      );
    }
  }

  // записываем user record (старый сценарий)
  const body: Record<string, any> = {
    user_id: toInt(user_id),
    pain_point_id,
    pain_intensity_id: toInt(pain_intensity_id),
    pain_type_id: toInt(pain_type_id),
    body_position_id: toInt(body_position_id),
    breathing_relation_id: toInt(breathing_relation_id),
    physical_activity_relation_id: toInt(physical_activity_relation_id),
    stress_relation_id: toInt(stress_relation_id),
    time_of_day_id: toInt(time_of_day_id),
  };
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const res = await requestCore<any>(
    "/AccessPoints/SaveUserPainRecord/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    false
  );

  if (!res.ok) {
    if (res.status === 422) {
      const msg =
        typeof res.message === "string"
          ? res.message
          : "Ошибка валидации (422). Проверьте обязательные поля.";
      throw new Error(msg);
    }
    throw new Error("Не удалось сохранить запись боли: сервер отверг запрос SaveUserPainRecord.");
  }
  return res.data;
}



/* ======================
 *  PAIN RECORDS / ЗАПИСИ
 * ====================== */

export type PainRecord = {
  id: number;
  record_date: string;
  pain_point_id: number;
  pain_intensity_id?: number;
  pain_type_id?: number;
  body_position_id?: number;
  breathing_relation_id?: number;
  physical_activity_relation_id?: number;
  stress_relation_id?: number;
  time_of_day_id?: number;
};

export async function getUserPainRecords(user_id: number): Promise<PainRecord[]> {
  const data =
    (await tryGet<any>([
      `/AccessPoints/PainRecords/?user_id=${user_id}`,      // чаще всего живой
      `/AccessPoints/GetPainRecords/?user_id=${user_id}`,
      `/AccessPoints/GetRecordsByUser/?user_id=${user_id}`,
      `/AccessPoints/GetUserPainRecords/?user_id=${user_id}`,
      `/AccessPoints/UserPainRecords/?user_id=${user_id}`,
    ])) || [];
  const recs = okArray(data) as PainRecord[];
  // console.log("[pain records]", recs);
  return recs;
}

/** Сохранить запись боли: отправляем только заполненные поля */
export async function savePainRecord(payload: {
  user_id: number;
  pain_point_id: number;
  pain_intensity_id?: number;
  pain_type_id?: number;
  body_position_id?: number;
  breathing_relation_id?: number;
  physical_activity_relation_id?: number;
  stress_relation_id?: number;
  time_of_day_id?: number;
  record_date?: string;
}) {
  const body: Record<string, any> = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") body[k] = v;
  });
  if (!body.record_date) body.record_date = new Date().toISOString();

  // <- самый вероятный живой эндпоинт ставим ПЕРВЫМ
const paths = [
  "/AccessPoints/SavePainPoints/",     // POST { user_id, pain_point_id, ... }
  "/AccessPoints/PainRecord/",      // возможный синоним
  "/AccessPoints/AddPainRecord/",
  "/AccessPoints/SavePainRecord/",
  "/AccessPoints/PainRecordSave/",
];


  const attempts: { url?: string; status?: number; message?: string; detail?: unknown }[] = [];
  for (const p of paths) {
    const r = await requestCore<any>(p, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return r.data;
    attempts.push({
      url: (r as any).url,
      status: (r as any).status,
      message: (r as any).message,
      detail: (r as any).detail
    });
    if (r.status && r.status >= 500) break;
  }

  const lines = attempts.map((a, i) =>
    `#${i + 1} url=${a.url} status=${a.status} msg=${a.message ?? ""} ` +
    (a.detail ? `detail=${typeof a.detail === "string" ? a.detail : JSON.stringify(a.detail)}` : "")
  );
  throw { ok: false, message: `Не удалось сохранить запись боли:\n${lines.join("\n")}`, detail: attempts };
}

/* ======================
 *  SAVE BY ZONE CODE
 * ====================== */

export type SaveByZonePayload = {
  user_id: number;
  zone_code: string;             // например "1_1_24"
  gender_code: 'male' | 'female';

  // справочники (все обязательные на бэке)
  pain_intensity_id: number;
  pain_type_id: number;
  body_position_id: number;
  breathing_relation_id: number;
  physical_activity_relation_id: number;
  stress_relation_id: number;
  time_of_day_id: number;

  record_date?: string;          // если не передан — поставим сейчас
};

export async function savePainRecordByZone(payload: {
  user_id: number;
  zone_code: string;
  gender_code: string;
  pain_intensity_id?: number;
  pain_type_id?: number;
  body_position_id?: number;
  breathing_relation_id?: number;
  physical_activity_relation_id?: number;
  stress_relation_id?: number;
  time_of_day_id?: number;
}) {
  const res = await fetch("/api/cmp/AccessPoints/SaveUserPainRecord", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.Status === "Error") {
    throw new Error(
      data?.Message ||
        data?.error ||
        "Не удалось сохранить запись боли (zone_code)"
    );
  }

  return data;
}

/* ======================
 *        RECOMENDATIONS
 * ====================== */

// ⬇️ где-нибудь рядом с другими типами
export type Recommendation = {
  recommendation_id: number;
  recommendation_name: string;
  recommendation_description: string;
  condition_group_id: number;
};


export async function getUserRecommendations(
  userId: number,
  guideId?: number
): Promise<Recommendation[]> {
  const params = new URLSearchParams({ user_id: String(userId) });
  if (guideId != null) {
    params.append('guide_id', String(guideId));
  }

  const res = await fetch(
    `/api/cmp/AccessPoints/GetRecommendationsForUser?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) {
    throw new Error('Ошибка загрузки рекомендаций');
  }

  return (await res.json()) as Recommendation[];
}
// уже должен быть базовый fetcher для CMP, что-то вроде:
const CMP_BASE = "/api/cmp";

export async function getRecommendationsForUser(userId: number) {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/GetRecommendationsForUser?user_id=${userId}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Не удалось получить рекомендации");
  }
  return (await res.json()) as Recommendation[];
}

// краткий запрос параметров — только чтобы понять «есть/нет»
export async function getUserParametersShort(userId: number) {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/GetUserParameters?user_id=${userId}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Не удалось получить параметры пользователя");
  }
  // там большой JSON; нам важен только факт, есть ли хоть что-то
  return (await res.json()) as any[];
}


/* ======================
 *        ANKETS
 * ====================== */

// ===== Анкеты / опросы =====

export type InterviewDescription = {
  id: number;
  name: string;
  description?: string | null;
  is_published?: boolean | null;
};

export type InterviewAnswer = {
  user_id: number;
  question_of_interview_id: number;
  option_of_question_id: number | null;
  answer_text: string | null;
  type: string | null;
  response_time: string | null;
};

async function fetchJsonMed(path: string) {
  const res = await fetch(`/api/cmp${path}`, {
    // нам важны свежие данные
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Ошибка запроса ${path}: ${res.status}`);
  }
  return res.json();
}

/** Список доступных анкет (id, name, description, is_published) */
export async function getInterviewsDescription(): Promise<InterviewDescription[]> {
  const data = await fetchJsonMed("/AccessPoints/GetInterviewsDescription/");
  return (data ?? []) as InterviewDescription[];
}

/** Ответы пользователя по конкретной анкете */
export async function getInterviewAnswers(
  interviewId: number,
  userId: number
): Promise<InterviewAnswer[]> {
  const params = new URLSearchParams({
    interview_id: String(interviewId),
    user_id: String(userId),
  });

  const data = await fetchJsonMed(
    `/AccessPoints/GetInterviewAnswers/?${params.toString()}`
  );

  return (data ?? []) as InterviewAnswer[];
}

// ======== АНКЕТЫ / ОПРОСЫ ========

// ===================== Анкеты (опросы) =====================

export type InterviewListItem = {
  id: number;
  name: string;
  description?: string | null;
  is_published?: boolean | null;
};

export type InterviewOption = {
  options_of_question_id: number;
  option_id: number;
  option_type: string;
  option_text: string;
  option_constraint?: string | null;
};

export type InterviewQuestion = {
  question_of_interview_id: number;
  question_id: number;
  question_type: string;
  question_name: string;
  question_description?: string | null;
  priority: number;
  max_answers?: number | null;
  transition_type?: string | null;
  question_options?: InterviewOption[] | null;
};

export type SaveInterviewAnswer = {
  question_of_interview_id: number;
  question_id: number;
  option_id: number;
  answer_text: string;
};

export type SaveInterviewPayload = {
  user_id: number;
  answers: SaveInterviewAnswer[];
};

async function cmpGetJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api/cmp${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка запроса ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function cmpPostJson<T>(path: string, body: any): Promise<T> {
  const res = await fetch(`/api/cmp${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка запроса ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// список анкет (то, что уже используется на карточках)
export function fetchInterviewsList() {
  // /AccessPoints/GetInterviewsDescription/
  return cmpGetJson<InterviewListItem[]>(
    "/AccessPoints/GetInterviewsDescription/"
  );
}

// структура конкретной анкеты
export function fetchInterviewStructure(interviewId: number) {
  // /InterviewStructure/{interview_id}
  return cmpGetJson<InterviewQuestion[]>(`/InterviewStructure/${interviewId}`);
}

// отправка ответов
export function sendInterviewAnswers(payload: SaveInterviewPayload) {
  // /AccessPoints/SaveInterviewAnswers/
  return cmpPostJson("/AccessPoints/SaveInterviewAnswers/", {
    interview_result: payload,
  });
}


/* ======================
 *        POKAZATELYS
 * ====================== */

export type ParameterDescription = {
  id: number;
  name: string; // системное имя из БД (англ, snake_case)
  description?: string | null;
  measurement_unit_id?: number | null;
  received_type_id?: number | null; // manual / устройство / вычисляемый
  count?: number | null;
  type_id?: number | null;
  modifiable?: boolean | null; // можно ли редактировать руками
  frequency_rate_id?: number | null;
  show_priority?: number | null; // приоритет отображения
};



export type UserParameterRecord = {
  id?: number;
  user_id: number;
  parameter_id?: number | null;
  parameter_name?: string | null;
  platform_id?: number | null;
  platform_name?: string | null;
  value1?: string | null;
  value2?: string | null;
  time?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type SaveUserParameterPayload = {
  user_id: number;
  parameter_id: number;
  platform_id?: number | null;
  value1: string;
  value2?: string | null;
  time?: string | null; // ISO-строка
};


// --- Показатели: API-функции --- //

// список всех параметров (med.parameter)
export async function getParametersDescription(): Promise<ParameterDescription[]> {
  const res = await fetch(
    "/api/cmp/AccessPoints/GetParametersDescription",
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Не удалось получить список показателей");
  }
  return res.json();
}

// показатели пользователя за последний период (по умолчанию бэк даёт 7 дней)
export async function getUserParameters(
  userId: number
): Promise<UserParameterRecord[]> {
  const params = new URLSearchParams({ user_id: String(userId) });
  const res = await fetch(
    `/api/cmp/AccessPoints/GetUserParameters?${params.toString()}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Не удалось получить показатели пользователя");
  }
  return res.json();
}

// сохранение одного измерения
export async function saveUserParameter(
  payload: SaveUserParameterPayload
): Promise<any> {
  const res = await fetch("/api/cmp/AccessPoints/SaveUserParameters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Не удалось сохранить показатель");
  }

  return res.json();
}
/* =========================================
 *  ADMIN: RECOMMENDATIONS / CONDITIONS
 * ========================================= */



/** Рекомендация для админки (общий список) */
export type AdminRecommendation = {
  id: number;
  name: string;
  description: string;
};

/** Тип сравнения (>, <, между и т.п.) */
export type ComparisonType = {
  id: number;
  type: string;
  description: string;
};

/** Отдельное условие рекомендации */
export type RecommendationCondition = {
  id: number;
  parameter_name: string;
  comparison_type: string;
  value1: string;
  value2: string;
};

/** Группа условий с вложенными рекомендациями и их условиями */
export type RecommendationConditionGroup = {
  group_id: number;
  group_description: string | null;
  recommendations: {
    recommendation_id: number;
    recommendation_name: string;
    conditions: {
      parameter_name: string;
      measurement_unit: string;
      comparison_type: string;
      value1: string;
      value2: string;
    }[];
  }[];
};

/* ---------- Рекомендации ---------- */

export async function getAllRecommendations(): Promise<AdminRecommendation[]> {
  const res = await fetch(`${CMP_BASE}/AccessPoints/GetRecommendations/`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Не удалось загрузить список рекомендаций");
  }
  return (await res.json()) as AdminRecommendation[];
}

export type SaveRecommendationPayload = {
  name: string;
  description: string;
};

export async function saveRecommendation(payload: SaveRecommendationPayload) {
  const res = await fetch(`${CMP_BASE}/AccessPoints/SaveRecommendation/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok || data?.Status === "Error") {
    throw new Error(
      data?.Message || data?.error || "Не удалось сохранить рекомендацию"
    );
  }

  return data as {
    Status: "Success";
    recommendation_id: number;
  };
}

/* ---------- Типы сравнения и условия ---------- */

export async function getComparisonTypes(): Promise<ComparisonType[]> {
  const res = await fetch(`${CMP_BASE}/AccessPoints/GetComparisonTypes/`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Не удалось получить типы сравнения");
  }
  return (await res.json()) as ComparisonType[];
}

export type SaveRecommendationConditionPayload = {
  parameter_id: number;
  comparison_type_id: number;
  value1: string;
  value2?: string | null;
};

export async function saveRecommendationCondition(
  payload: SaveRecommendationConditionPayload
) {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/SaveRecommendationCondition/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok || data?.Status === "Error") {
    throw new Error(
      data?.Message ||
        data?.error ||
        "Не удалось сохранить условие рекомендации"
    );
  }

  return data as {
    Status: "Success";
    recommendation_condition_id: number;
  };
}

export async function getRecommendationConditions(): Promise<
  RecommendationCondition[]
> {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/GetRecommendationConditions/`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Не удалось получить список условий");
  }
  return (await res.json()) as RecommendationCondition[];
}

/* ---------- Группы условий ---------- */

export type SaveConditionGroupPayload = {
  recommendation_id: number;
  description?: string | null;
};

export async function saveConditionGroup(payload: SaveConditionGroupPayload) {
  const res = await fetch(`${CMP_BASE}/AccessPoints/SaveConditionGroup/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok || data?.Status === "Error") {
    throw new Error(
      data?.Message || data?.error || "Не удалось сохранить группу условий"
    );
  }

  return data as {
    Status: "Success";
    condition_group_id: number;
  };
}

export type SaveConditionToGroupPayload = {
  recommendation_condition_id: number;
  recommendation_condition_group_id: number;
};

export async function saveConditionToGroup(
  payload: SaveConditionToGroupPayload
) {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/SaveConditionToGroup/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = await res.json().catch(() => ({} as any));

  if (!res.ok || data?.Status === "Error") {
    throw new Error(
      data?.Message ||
        data?.error ||
        "Не удалось привязать условие к группе"
    );
  }

  return data as {
    Status: "Success";
    condition_to_group_relation_id: number;
  };
}

export async function getRecommendationConditionGroups(): Promise<
  RecommendationConditionGroup[]
> {
  const res = await fetch(
    `${CMP_BASE}/AccessPoints/GetRecommendationConditionGroups/`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error("Не удалось получить группы условий");
  }
  return (await res.json()) as RecommendationConditionGroup[];
}
// предполагаем, что выше объявлены CMP_BASE и общий helper:
async function cmpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CMP_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Ошибка запроса ${path}`);
  }
  return res.json() as Promise<T>;
}

/* ---------- Рекомендации ---------- */

export async function updateRecommendation(
  id: number,
  data: { name: string; description: string }
) {
  return cmpFetch(`/AccessPoints/UpdateRecommendation/?recommendation_id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRecommendation(id: number) {
  return cmpFetch(`/AccessPoints/DeleteRecommendation/?recommendation_id=${id}`, {
    method: "DELETE",
  });
}

/* ---------- Условия и группы ---------- */

export async function updateRecommendationCondition(
  id: number,
  data: {
    parameter_id: number;
    comparison_type_id: number;
    value1: string;
    value2: string | null;
  }
) {
  return cmpFetch(
    `/AccessPoints/UpdateRecommendationCondition/?condition_id=${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteRecommendationCondition(id: number) {
  return cmpFetch(
    `/AccessPoints/DeleteRecommendationCondition/?condition_id=${id}`,
    {
      method: "DELETE",
    }
  );
}

export async function updateConditionGroup(
  groupId: number,
  data: { recommendation_id: number; description: string | null }
) {
  return cmpFetch(
    `/AccessPoints/UpdateConditionGroup/?group_id=${groupId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
}

export async function deleteConditionGroup(groupId: number) {
  return cmpFetch(`/AccessPoints/DeleteConditionGroup/?group_id=${groupId}`, {
    method: "DELETE",
  });
}

export async function deleteConditionFromGroup(
  conditionId: number,
  groupId: number
) {
  return cmpFetch(
    `/AccessPoints/DeleteConditionToGroup/?condition_id=${conditionId}&group_id=${groupId}`,
    { method: "DELETE" }
  );
}

/* ---------- Параметры ---------- */

export async function getParameterReferences() {
  return cmpFetch("/AccessPoints/GetParameterReferences/");
}

export async function saveParameter(data: {
  name: string;
  type_id: number;
  received_type_id: number;
  count: number;
  frequency_rate_id: number | null;
  measurement_unit_id: number | null;
  description: string | null;
}) {
  return cmpFetch("/AccessPoints/SaveParameter/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateParameter(
  id: number,
  data: {
    name: string;
    type_id: number;
    received_type_id: number;
    count: number;
    frequency_rate_id: number | null;
    measurement_unit_id: number | null;
    description: string | null;
  }
) {
  return cmpFetch(`/AccessPoints/UpdateParameter/?parameter_id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteParameter(id: number) {
  return cmpFetch(`/AccessPoints/DeleteParameter/?parameter_id=${id}`, {
    method: "DELETE",
  });
}

/* ---------- Тестирование рекомендаций ---------- */

export async function getRecommendationsForTest(
  userParameters: {
    parameter_id: number;
    value1: string;
    value2: string | null;
  }[],
  guideId?: number
) {
  const q = guideId != null ? `?guide_id=${guideId}` : "";
  return cmpFetch(`/AccessPoints/GetRecommendationsForTest/${q}`, {
    method: "POST",
    body: JSON.stringify(userParameters),
  });
}

/* ======================
 *        PLATFORMS
 * ====================== */

export type Platform = { id: number; name: string };
export const PLATFORMS: Platform[] = [
  { id: 1, name: "Web" },
  { id: 2, name: "Android" },
  { id: 3, name: "iOS" },
];


