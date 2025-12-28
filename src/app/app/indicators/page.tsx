"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/lib/AuthContext";
import {
  getParametersDescription,
  getUserParameters,
  saveUserParameter,
  type ParameterDescription,
  type UserParameterRecord,
} from "@/lib/api";
import styles from "./metrics.module.css";

type EnhancedParameter = ParameterDescription & {
  lastRecord?: UserParameterRecord;
  lastValue?: string;
  measuresCount: number;
  lastTimeIso?: string | null;
  canManualEdit: boolean;
};

type ModalState = {
  open: boolean;
  parameter: EnhancedParameter | null;
};

type TabKey = "overview" | "history";

type ParameterGroup = "vital" | "lifestyle" | "lab" | "smoke" | "other";

// какие параметры считаем «только из часов» — ручной ввод отключаем
const IMPORT_ONLY_PARAMETER_NAMES = new Set<string>([
  "heart_bpm",
  "step",
  "distance",
  "calories",
  "active_minutes",
  "speed",
  "heart_minutes",
]);

// Человекочитаемые названия и группы для параметров.
// При появлении новых name просто дописываем сюда.
const PARAM_LABELS: Record<
  string,
  {
    label: string;
    description?: string;
    group?: ParameterGroup;
  }
> = {
  heart_bpm: {
    label: "Частота сердечных сокращений",
    description: "Пульс, измеренный устройством.",
    group: "vital",
  },
  step: {
    label: "Количество шагов",
    description: "Шаги за выбранный период.",
    group: "lifestyle",
  },
  distance: {
    label: "Дистанция",
    description: "Пройденная дистанция за период.",
    group: "lifestyle",
  },
  calories: {
    label: "Калории",
    description: "Оценка потраченной энергии.",
    group: "lifestyle",
  },
  active_minutes: {
    label: "Минуты активности",
    description: "Время умеренной и высокой активности.",
    group: "lifestyle",
  },
  speed: {
    label: "Скорость",
    group: "lifestyle",
  },
  heart_minutes: {
    label: "Минуты в целевой ЧСС",
    group: "vital",
  },
  weight: {
    label: "Вес",
    description: "Масса тела.",
    group: "vital",
  },
  bmi: {
    label: "Индекс массы тела",
    description: "Отношение веса к росту.",
    group: "vital",
  },
  // примеры «курительных» параметров — подправишь под реальные name
  pack_year_index: {
    label: "Индекс пачек/лет",
    group: "smoke",
  },
  smoke_dependence_score: {
    label: "Степень табачной зависимости (баллы)",
    group: "smoke",
  },
};

function getPrettyName(p: ParameterDescription): string {
  const meta = PARAM_LABELS[p.name];
  if (meta?.label) return meta.label;
  if (p.description) return p.description;
  return p.name;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function IndicatorsPage() {
  const { session } = useAuth();
  const userId = session?.userId ?? null;

  const [params, setParams] = useState<ParameterDescription[]>([]);
  const [records, setRecords] = useState<UserParameterRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("overview");

  const [search, setSearch] = useState("");
  const [onlyWithData, setOnlyWithData] = useState(false);
  const [onlyImportant, setOnlyImportant] = useState(false);

  const [modal, setModal] = useState<ModalState>({
    open: false,
    parameter: null,
  });

  const [selectedHistoryParamId, setSelectedHistoryParamId] = useState<
    number | null
  >(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Загрузка словаря параметров + последних показателей
  // Загрузка словаря параметров + последних показателей
  useEffect(() => {
    // Явно проверяем на null, чтобы TS сузил тип до number
    if (userId == null) return;

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [pDesc, userRecs] = await Promise.all([
          getParametersDescription(),
          // userId к этому моменту точно не null
          getUserParameters(userId as number),
        ]);

        if (cancelled) return;

        setParams(pDesc ?? []);
        setRecords(userRecs ?? []);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Не удалось загрузить показатели");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);


  // Обогащённые параметры: последняя запись, количество, можно ли редактировать и т.д.
  const enhancedParams = useMemo<EnhancedParameter[]>(() => {
    if (!params.length) return [];

    const byParam = new Map<number, UserParameterRecord[]>();
    for (const r of records ?? []) {
      const pid = r.parameter_id;
      if (!pid) continue;
      const list = byParam.get(pid) ?? [];
      list.push(r);
      byParam.set(pid, list);
    }

    const pickLast = (list: UserParameterRecord[]): UserParameterRecord | undefined => {
      if (!list.length) return undefined;
      if (list.length === 1) return list[0];
      return [...list].sort((a, b) => {
        const ta = new Date(
          a.time || a.end_time || a.start_time || ""
        ).getTime();
        const tb = new Date(
          b.time || b.end_time || b.start_time || ""
        ).getTime();
        return tb - ta;
      })[0];
    };

    return params.map((p) => {
      const list = byParam.get(p.id) ?? [];
      const last = pickLast(list);
      const lastTimeIso = last?.time || last?.end_time || last?.start_time || null;

      let lastValue: string | undefined;
      if (last?.value1) {
        if (last.value2 && last.value2 !== "null" && last.value2 !== "") {
          lastValue = `${last.value1} / ${last.value2}`;
        } else {
          lastValue = last.value1;
        }
      }

      const canManualEdit =
        (p.modifiable ?? true) &&
        !IMPORT_ONLY_PARAMETER_NAMES.has(p.name);

      return {
        ...p,
        lastRecord: last,
        lastValue,
        measuresCount: list.length,
        lastTimeIso,
        canManualEdit,
      };
    });
  }, [params, records]);

  // По умолчанию для истории выбираем первый параметр с данными
  useEffect(() => {
    if (!selectedHistoryParamId && enhancedParams.length > 0) {
      const withData = enhancedParams.filter((p) => p.measuresCount > 0);
      const first = withData[0] ?? enhancedParams[0];
      setSelectedHistoryParamId(first.id);
    }
  }, [enhancedParams, selectedHistoryParamId]);

  const hasAnyData = enhancedParams.some((p) => p.measuresCount > 0);

  const manualParams = enhancedParams.filter((p) => p.canManualEdit);
  const deviceParams = enhancedParams.filter((p) => !p.canManualEdit);

  // Фильтрация + поиск по ручным показателям
  const filteredManualParams = useMemo(() => {
    let list = manualParams;

    if (onlyWithData) {
      list = list.filter((p) => p.measuresCount > 0);
    }

    if (onlyImportant) {
      list = list.filter((p) => (p.show_priority ?? 1) >= 2);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => {
        const name = getPrettyName(p).toLowerCase();
        const raw = (p.name || "").toLowerCase();
        return name.includes(q) || raw.includes(q);
      });
    }

    // внутри групп мы ещё отсортируем, здесь только общая
    return list.slice();
  }, [manualParams, onlyWithData, onlyImportant, search]);

  // Группы для ручных показателей (основные / активность / курение / прочие)
  type VisibleGroupKey = "vital" | "lifestyle" | "smoke" | "other";

  const groupedManualParams = useMemo(
    () => {
      const groups: Record<VisibleGroupKey, EnhancedParameter[]> = {
        vital: [],
        lifestyle: [],
        smoke: [],
        other: [],
      };

      for (const p of filteredManualParams) {
        const meta = PARAM_LABELS[p.name];
        let key: VisibleGroupKey = "other";

        if (meta?.group === "vital") key = "vital";
        else if (meta?.group === "lifestyle") key = "lifestyle";
        else if (meta?.group === "smoke") key = "smoke";
        // lab и всё остальное уходит в "other"

        groups[key].push(p);
      }

      // внутри каждой группы сортируем по приоритету и имени
      (Object.keys(groups) as VisibleGroupKey[]).forEach((k) => {
        groups[k] = groups[k].sort((a, b) => {
          const pa = a.show_priority ?? 1;
          const pb = b.show_priority ?? 1;
          if (pa !== pb) return pb - pa;
          return getPrettyName(a).localeCompare(getPrettyName(b), "ru-RU");
        });
      });

      return groups;
    },
    [filteredManualParams]
  );

  const historyParam = enhancedParams.find(
    (p) => p.id === selectedHistoryParamId
  );
  const historyRecords = useMemo(() => {
    if (!historyParam) return [];
    return (records ?? [])
      .filter((r) => r.parameter_id === historyParam.id)
      .slice()
      .sort((a, b) => {
        const ta = new Date(
          a.time || a.end_time || a.start_time || ""
        ).getTime();
        const tb = new Date(
          b.time || b.end_time || b.start_time || ""
        ).getTime();
        return tb - ta;
      });
  }, [records, historyParam]);

  const openModal = (p: EnhancedParameter) => {
    if (!p.canManualEdit) return;
    setModal({ open: true, parameter: p });
  };

  const closeModal = () => {
    setModal({ open: false, parameter: null });
  };

  const handleSaved = async () => {
    if (!userId) return;
    try {
      const updated = await getUserParameters(userId);
      setRecords(updated ?? []);
    } catch {
      // игнорируем
    }
  };

  const handleCardClick = (p: EnhancedParameter) => {
    setSelectedHistoryParamId(p.id);
    setTab("history");
  };

  const handleSelectHistoryParam = (value: string) => {
    const id = Number(value);
    setSelectedHistoryParamId(Number.isNaN(id) ? null : id);
  };

  // -------- Импорт с носимых устройств --------

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesChange: React.ChangeEventHandler<HTMLInputElement> = async (
    event
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !userId) return;

    setImportBusy(true);
    setImportError(null);
    setImportMessage(null);

    try {
      const fileArray = Array.from(files);

      const readFile = (file: File) =>
        new Promise<{ file: File; text: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({ file, text: String(reader.result || "") });
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file, "utf-8");
        });

      const fileContents = await Promise.all(fileArray.map(readFile));

      type ImportRecord = {
        user_id: number;
        parameter_name: string;
        start_time?: string | null;
        end_time?: string | null;
        value1?: string | null;
        platform_name?: string | null;
      };

      const identifyDataType = (filename: string): string => {
        const name = filename.toLowerCase();
        if (name.includes("heart_rate.bpm")) return "heart_bpm";
        if (name.includes("step_count.delta")) return "step";
        if (name.includes("distance.delta")) return "distance";
        if (name.includes("calories.expended")) return "calories";
        if (name.includes("active_minutes")) return "active_minutes";
        if (name.includes("speed")) return "speed";
        if (name.includes("heart_minutes")) return "heart_minutes";
        if (name.includes("weight")) return "weight";
        return "unknown";
      };

      const nsToUtcString = (
        ns: number | string | null | undefined
      ): string | null => {
        if (ns == null) return null;
        const n =
          typeof ns === "string"
            ? parseInt(ns, 10)
            : typeof ns === "number"
            ? ns
            : NaN;
        if (!Number.isFinite(n)) return null;
        const ms = n / 1e6;
        const d = new Date(ms);
        const pad = (v: number, len = 2) => String(v).padStart(len, "0");
        const year = d.getUTCFullYear();
        const month = pad(d.getUTCMonth() + 1);
        const day = pad(d.getUTCDate());
        const hour = pad(d.getUTCHours());
        const minute = pad(d.getUTCMinutes());
        const second = pad(d.getUTCSeconds());
        const ms3 = pad(d.getUTCMilliseconds(), 3);
        return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms3} UTC`;
      };

      const allRecords: ImportRecord[] = [];

      for (const { file, text } of fileContents) {
        const dataType = identifyDataType(file.name);
        if (dataType === "unknown") continue;

        let json: any;
        try {
          json = JSON.parse(text);
        } catch (e) {
          console.warn("Не удалось распарсить JSON", file.name, e);
          continue;
        }

        const points: any[] = Array.isArray(json["Data Points"])
          ? json["Data Points"]
          : [];

        for (const p of points) {
          const startNs = p?.startTimeNanos;
          const endNs = p?.endTimeNanos;
          const fit = Array.isArray(p?.fitValue) ? p.fitValue : [];
          let val: any = null;
          if (fit.length > 0 && fit[0]?.value) {
            const v = fit[0].value;
            val = v.fpVal ?? v.intVal ?? null;
          }

          allRecords.push({
            user_id: userId,
            parameter_name: dataType,
            start_time: nsToUtcString(startNs),
            end_time: nsToUtcString(endNs),
            value1: val != null ? String(val) : null,
            platform_name: "Google_Fit",
          });
        }
      }

      if (!allRecords.length) {
        setImportError(
          "Не удалось извлечь данные из файлов. Проверьте, что это экспорт Google Fit."
        );
        return;
      }

      const res = await fetch("/api/cmp/AccessPoints/SaveUserParameters/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(allRecords),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          text || "Сервер вернул ошибку при сохранении показателей"
        );
      }

      setImportMessage(
        `Импортировано записей: ${allRecords.length}. Список показателей обновлён.`
      );

      try {
        const updated = await getUserParameters(userId);
        setRecords(updated ?? []);
      } catch {
        // игнорируем
      }
    } catch (e: any) {
      setImportError(
        e?.message ||
          "Не удалось импортировать данные с устройства. Попробуйте ещё раз."
      );
    } finally {
      setImportBusy(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  if (!userId) {
    return (
      <Card title="Показатели здоровья">
        <Alert type="error">
          Не удалось определить пользователя. Попробуйте перезайти.
        </Alert>
      </Card>
    );
  }

  const renderParamCard = (p: EnhancedParameter) => {
    const prettyName = getPrettyName(p);
    const lastValue = p.lastValue ?? "Нет данных";
    const time = p.lastTimeIso ? formatDate(p.lastTimeIso) : null;

    return (
      <button
        key={p.id}
        type="button"
        className={styles.cardRow}
        onClick={() => handleCardClick(p)}
      >
        <div className={styles.cardMain}>
          <div className={styles.cardTitle}>{prettyName}</div>
          {p.description && (
            <div className={styles.cardDescription}>{p.description}</div>
          )}
          <div className={styles.cardMeta}>
            {p.measuresCount > 0 ? (
              <>
                <span>Измерений: {p.measuresCount}</span>
                {time && <span>Последнее: {time}</span>}
              </>
            ) : (
              <span>Пока нет измерений</span>
            )}
          </div>
        </div>
        <div className={styles.cardRight}>
          <div className={styles.cardValue}>{lastValue}</div>
          <div className={styles.cardActions}>
            {p.show_priority && p.show_priority >= 2 && (
              <span className={styles.badgeImportant}>
                Важный показатель
              </span>
            )}
            {p.canManualEdit && (
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(p);
                }}
              >
                Добавить
              </Button>
            )}
          </div>
        </div>
      </button>
    );
  };

  const groupOrder: VisibleGroupKey[] = [
    "vital",
    "lifestyle",
    "smoke",
    "other",
  ];

  const groupTitles: Record<VisibleGroupKey, { title: string; hint: string }> = {
    vital: {
      title: "Основные показатели",
      hint: "Температура, вес, пульс и другие базовые параметры.",
    },
    lifestyle: {
      title: "Активность и образ жизни",
      hint: "Шаги, активные минуты, калории и другие показатели активности.",
    },
    smoke: {
      title: "Показатели, связанные с курением",
      hint: "Индекс пачек/лет, баллы зависимости и сопутствующие параметры.",
    },
    other: {
      title: "Прочие показатели",
      hint: "Все остальные параметры, которые пока не попали в группы выше.",
    },
  };

  return (
    <Card
      title="Показатели здоровья"
      headerRight={
        <div className={styles.tabsWrapper}>
          <button
            type="button"
            className={
              tab === "overview" ? styles.tabButtonActive : styles.tabButton
            }
            onClick={() => setTab("overview")}
          >
            Обзор
          </button>
          <button
            type="button"
            className={
              tab === "history" ? styles.tabButtonActive : styles.tabButton
            }
            onClick={() => setTab("history")}
          >
            История
          </button>
        </div>
      }
    >
      <p className={styles.lead}>
        Здесь собираются ваши показатели здоровья: от ручных измерений до данных,
        которые приходят с носимых устройств. На основе этих данных формируются
        рекомендации.
      </p>

      {loading && (
        <div className={styles.centerSoft}>
          <Spinner label="Загружаем ваши показатели…" />
        </div>
      )}

      {!loading && error && (
        <Alert type="error" className={styles.topAlert}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <div className={styles.layout}>
          {/* Левая колонка: поиск + ручные показатели + автоматические */}
          <section className={styles.leftColumn}>
            <div className={styles.searchBlock}>
              <Input
                label="Поиск по показателям"
                placeholder="Например, давление, пульс, вес…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className={styles.filtersRow}>
                <button
                  type="button"
                  className={
                    onlyWithData ? styles.toggleActive : styles.toggle
                  }
                  onClick={() => setOnlyWithData((v) => !v)}
                >
                  Только с измерениями
                </button>
                <button
                  type="button"
                  className={
                    onlyImportant ? styles.toggleActive : styles.toggle
                  }
                  onClick={() => setOnlyImportant((v) => !v)}
                >
                  Важные показатели
                </button>
              </div>
            </div>

            <div className={styles.manualHeader}>
              <div className={styles.manualTitle}>Ручные измерения</div>
              <div className={styles.manualHint}>
                Эти показатели вы можете заполнить вручную — например, давление,
                пульс, вес.
              </div>
            </div>

            {filteredManualParams.length === 0 ? (
              <div className={styles.empty}>
                По заданным условиям нет показателей. Попробуйте изменить поиск
                или фильтры.
              </div>
            ) : (
              <div className={styles.groupsStack}>
                {groupOrder.map((groupKey) => {
                  const list = groupedManualParams[groupKey];
                  if (!list.length) return null;
                  const meta = groupTitles[groupKey];

                  return (
                    <div key={groupKey} className={styles.groupBlock}>
                      <div className={styles.groupHeader}>
                        <div className={styles.groupTitle}>{meta.title}</div>
                        <div className={styles.groupHint}>{meta.hint}</div>
                      </div>
                      <div className={styles.cardsList}>
                        {list.map((p) => renderParamCard(p))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {deviceParams.length > 0 && (
              <div className={styles.deviceBlock}>
                <div className={styles.deviceTitle}>
                  Автоматические показатели
                </div>
                <div className={styles.deviceHint}>
                  Эти параметры приходят с носимых устройств и не редактируются
                  вручную.
                </div>
                <div className={styles.deviceChips}>
                  {deviceParams.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.deviceChip}
                      onClick={() => handleCardClick(p)}
                    >
                      <span>{getPrettyName(p)}</span>
                      {p.lastValue && (
                        <span className={styles.deviceChipValue}>
                          {p.lastValue}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Правая колонка: обзор + импорт / история */}
          <section className={styles.rightColumn}>
            {tab === "overview" && (
              <>
                <div className={styles.summaryBlock}>
                  <div className={styles.summaryHeader}>
                    <div className={styles.summaryTitle}>Кратко о главном</div>
                    <div className={styles.summaryHint}>
                      Небольшая выжимка по последним измерениям. Клик по строке
                      — откроет историю.
                    </div>
                  </div>
                  {hasAnyData ? (
                    <div className={styles.summaryItems}>
                      {enhancedParams
                        .filter((p) => p.measuresCount > 0)
                        .sort((a, b) => {
                          const ta = new Date(a.lastTimeIso || "").getTime();
                          const tb = new Date(b.lastTimeIso || "").getTime();
                          return tb - ta;
                        })
                        .slice(0, 5)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={styles.summaryItem}
                            onClick={() => handleCardClick(p)}
                          >
                            <div className={styles.summaryItemName}>
                              {getPrettyName(p)}
                            </div>
                            <div className={styles.summaryItemValue}>
                              {p.lastValue ?? "—"}
                            </div>
                            {p.lastTimeIso && (
                              <div className={styles.summaryItemMeta}>
                                {formatDate(p.lastTimeIso)}
                              </div>
                            )}
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className={styles.emptySummary}>
                      Пока нет ни одного измерения — начните с ручных
                      показателей слева или импортируйте данные с устройства.
                    </div>
                  )}
                </div>

                <div className={styles.importBlock}>
                  <div className={styles.importHeader}>
                    <div className={styles.importTitle}>
                      Импорт с носимых устройств
                    </div>
                    <div className={styles.importHint}>
                      Поддерживается импорт из приложений Google Fit/Apple Health
                      (файлы с измерениями пульса, шагов, активности и т.п.).
                    </div>
                  </div>

                  {importError && (
                    <Alert type="error" className={styles.importAlert}>
                      {importError}
                    </Alert>
                  )}
                  {importMessage && (
                    <Alert type="info" className={styles.importAlert}>
                      {importMessage}
                    </Alert>
                  )}

                  <div className={styles.importControls}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json"
                      multiple
                      className={styles.hiddenFileInput}
                      onChange={handleFilesChange}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleImportClick}
                      disabled={importBusy}
                    >
                      {importBusy
                        ? "Импортируем…"
                        : "Загрузить"}
                    </Button>
                    <div className={styles.importNote}>
                     Выберите файл с данными, который вы экспортировали из Apple Health/Google Fit. После загрузки данные появятся в разделе «Показатели».
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "history" && (
              <div className={styles.historyBlock}>
                <div className={styles.historyHeader}>
                  <div className={styles.historyTitle}>
                    История показателей
                  </div>
                  <div className={styles.historyHint}>
                    Выберите показатель, чтобы посмотреть все измерения за
                    последний период.
                  </div>
                </div>

                {enhancedParams.length > 0 && (
                  <div className={styles.historyControls}>
                    <Select
                      label="Показатель"
                      value={selectedHistoryParamId ?? ""}
                      onChange={handleSelectHistoryParam}
                      options={enhancedParams.map((p) => ({
                        value: p.id,
                        label: getPrettyName(p),
                      }))}
                    />
                  </div>
                )}

                {!historyParam || historyRecords.length === 0 ? (
                  <div className={styles.empty}>
                    Для выбранного показателя пока нет измерений.
                  </div>
                ) : (
                  <div className={styles.historyTableWrapper}>
                    <table className={styles.historyTable}>
                      <thead>
                        <tr>
                          <th>Дата и время</th>
                          <th>Значение</th>
                          <th>Источник</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyRecords.map((r, idx) => {
                          const timeIso = r.time || r.end_time || r.start_time;
                          const value =
                            r.value2 && r.value2 !== "null" && r.value2 !== ""
                              ? `${r.value1} / ${r.value2}`
                              : r.value1 ?? "—";
                          const source =
                            r.platform_name ||
                            (r.platform_id === 1
                              ? "Веб"
                              : r.platform_id === 2
                              ? "Android"
                              : r.platform_id === 3
                              ? "iOS"
                              : "Неизвестно");

                          return (
                            <tr key={idx}>
                              <td>{formatDate(timeIso)}</td>
                              <td>{value}</td>
                              <td>{source}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <AddMeasurementModal
        open={modal.open}
        parameter={modal.parameter}
        userId={userId}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </Card>
  );
}

type AddMeasurementModalProps = {
  open: boolean;
  parameter: EnhancedParameter | null;
  userId: number | null;
  onClose: () => void;
  onSaved: () => void;
};

function AddMeasurementModal({
  open,
  parameter,
  userId,
  onClose,
  onSaved,
}: AddMeasurementModalProps) {
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [time, setTime] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!open) {
      setValue1("");
      setValue2("");
      setError(null);
      setOk(false);
    }
  }, [open, parameter?.id]);

  if (!open || !parameter || !userId) return null;

  const handleSubmit = async () => {
    if (!value1.trim()) {
      setError("Введите значение показателя");
      setOk(false);
      return;
    }

    setSaving(true);
    setError(null);
    setOk(false);

    try {
      await saveUserParameter({
        user_id: userId,
        parameter_id: parameter.id,
        value1: value1.trim(),
        value2: value2.trim() || null,
        time: new Date(time).toISOString(),
      } as any);
      setOk(true);
      await onSaved();
    } catch (e: any) {
      setError(e?.message || "Не удалось сохранить измерение");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Новое измерение: ${getPrettyName(parameter)}`}
      footer={
        <div className={styles.modalFooter}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSubmit} loading={saving}>
            Сохранить
          </Button>
        </div>
      }
    >
      {error && <Alert type="error">{error}</Alert>}
      {ok && <Alert type="info">Измерение сохранено</Alert>}

      <div className={styles.modalBody}>
        {parameter.description && (
          <div className={styles.modalDescription}>{parameter.description}</div>
        )}

        <div className={styles.modalFieldGroup}>
          <label className={styles.modalLabel}>Значение 1</label>
          <input
            type="number"
            value={value1}
            onChange={(e) => setValue1(e.target.value)}
            className={styles.modalInput}
          />
        </div>

        <div className={styles.modalFieldGroup}>
          <label className={styles.modalLabel}>Значение 2 (опционально)</label>
          <input
            type="number"
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
            className={styles.modalInput}
          />
        </div>

        <div className={styles.modalFieldGroup}>
          <label className={styles.modalLabel}>Время измерения</label>
          <input
            type="datetime-local"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={styles.modalInput}
          />
        </div>
      </div>
    </Modal>
  );
}
