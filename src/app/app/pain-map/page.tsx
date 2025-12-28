'use client';

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import BodyMap, { type ZoneClickPayload } from "@/components/pain-map/BodyMap";
import { POINT_NAME_BY_ID } from "@/components/pain-map/points.config";
import { useAuth } from "@/lib/AuthContext";
import {
  getUserPainRecords,
  getPainCharacteristics,
  savePainRecordByZone,
  PLATFORMS,
  type PainCharacteristics,
} from "@/lib/api";
import styles from "./new.module.css";
import hist from "./history.module.css";

// gender_code в payload такой же, как в BodyMap: "male" | "female"
function toBackendGender(g: ZoneClickPayload["gender_code"]) {
  // если на бэке будут коды 'M' / 'F' — переделаем здесь
  return g;
}

export default function PainMapPage() {
  const { session } = useAuth();
  const userId = session?.userId;

  const [platformId, setPlatformId] = useState<number>(1);

  const [dicts, setDicts] = useState<PainCharacteristics | null>(null);
  const [records, setRecords] = useState<any[] | null>(null);

  const [errRecords, setErrRecords] = useState<string | null>(null);
  const [errSave, setErrSave] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 👇 теперь используем тот же тип, что и BodyMap
  const [selectedZone, setSelectedZone] = useState<ZoneClickPayload | null>(
    null
  );

  const [form, setForm] = useState<{
    pain_intensity_id?: number;
    pain_type_id?: number;
    body_position_id?: number;
    breathing_relation_id?: number;
    physical_activity_relation_id?: number;
    stress_relation_id?: number;
    time_of_day_id?: number;
  }>({});

  /* словари: грузим один раз */
  useEffect(() => {
    (async () => {
      try {
        setDicts(await getPainCharacteristics());
      } catch {
        // просто оставим пусто — форма покажет «— не указано —»
      }
    })();
  }, []);

  /* записи пользователя */
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Number.isInteger(userId as any)) return;
      try {
        setErrRecords(null);
        setRecords(null);
        const arr = await getUserPainRecords(userId as number);
        if (!mounted) return;
        setRecords(arr);
      } catch (e: any) {
        setErrRecords(e?.message || "Не удалось загрузить записи боли");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  async function onSave() {
    if (!userId) return;
    if (!selectedZone) {
      setErrSave("Не выбрана зона боли");
      return;
    }

    setErrSave(null);
    setSaving(true);

    try {
      await savePainRecordByZone({
        user_id: userId,
        // 👇 теперь берём ровно те поля, которые реально пришли из BodyMap
        zone_code: selectedZone.zone_code,
        gender_code: toBackendGender(selectedZone.gender_code),
        pain_intensity_id: form.pain_intensity_id,
        pain_type_id: form.pain_type_id,
        body_position_id: form.body_position_id,
        breathing_relation_id: form.breathing_relation_id,
        physical_activity_relation_id: form.physical_activity_relation_id,
        stress_relation_id: form.stress_relation_id,
        time_of_day_id: form.time_of_day_id,
      });

      const arr = await getUserPainRecords(userId);
      setRecords(arr);
      setForm({});
      setSelectedZone(null);
    } catch (e: any) {
      setErrSave(e?.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  const mkOptions = (
    arr?: {
      id: number;
      name?: string;
      level?: number;
      description?: string;
      period?: string;
    }[],
    text?: (i: any) => string
  ) =>
    [{ value: "", label: "— не указано —" } as const].concat(
      (arr ?? []).map((i) => ({
        value: String(i.id),
        label: text
          ? text(i)
          : i.name ?? i.description ?? i.period ?? String(i.id),
      }))
    );

  /* =======================
   * Вспомогалки для истории
   * ======================= */
  const dict = useMemo(() => {
    const d = dicts;
    const map = <T extends { id: number }>(
      a?: (T & any)[],
      label?: (x: any) => string
    ) =>
      new Map<number, string>(
        (a ?? []).map((i) => [
          i.id,
          label ? label(i) : i.name ?? i.description ?? i.period ?? String(i.id),
        ])
      );

    return {
      intensity: map(d?.pain_intensity, (i) => `Уровень ${i.level ?? i.name}`),
      type: map(d?.pain_type),
      pos: map(d?.body_position),
      breath: map(d?.breathing_relation),
      act: map(d?.physical_activity_relation),
      stress: map(d?.stress_relation),
      day: map(d?.time_of_day, (i) => i.period ?? i.name),
    };
  }, [dicts]);

  const label = (m: Map<number, string>, id?: number) =>
    id ? m.get(id) ?? "—" : "—";

  const niceDate = (iso?: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const pointTitleFromRecord = (r: any) =>
    r.zone_name ??
    r.pain_point_name ??
    (r.pain_point_id
      ? POINT_NAME_BY_ID[r.pain_point_id] ?? `точка ${r.pain_point_id}`
      : "точка");

  return (
    <>
      <Card
        title="Карта болей — точки (интерактив)"
        headerRight={
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#6a7a90" }}>
              user_id: {userId ?? "—"}
            </div>
            <Select
              value={platformId}
              onChange={(v) => setPlatformId(Number(v))}
              options={PLATFORMS.map((p) => ({
                value: p.id,
                label: `Платформа: ${p.name}`,
              }))}
            />
          </div>
        }
      >
        {/* карта боли с полигонами.
           BodyMap внутри умеет переключать пол / сторону
           и при клике вызывает onPickZone */}
        <BodyMap
          onPickZone={(z) => {
            setSelectedZone(z);
            setForm({});
            setErrSave(null);
          }}
        />
      </Card>

      <Card title="Ваша история боли (Дмитрий)">
        {errRecords && <Alert type="error">{errRecords}</Alert>}
        {!errRecords && records === null && (
          <Spinner label="Загрузка записей…" />
        )}

        {!errRecords && records && records.length === 0 && (
          <Alert type="info">Пока нет записей боли</Alert>
        )}

        {records && records.length > 0 && (
          <div className={hist.list}>
            {records
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.record_date).getTime() -
                  new Date(a.record_date).getTime()
              )
              .map((r) => (
                <div key={r.id ?? r.pain_record_id} className={hist.item}>
                  <div className={hist.rowTop}>
                    <div className={hist.pointTitle}>
                      <span className={hist.dot} />
                      <strong>{pointTitleFromRecord(r)}</strong>
                    </div>
                    <div className={hist.date}>{niceDate(r.record_date)}</div>
                  </div>

                  <div className={hist.tags}>
                    <Tag
                      label="Интенсивность"
                      value={label(dict.intensity, r.pain_intensity_id)}
                    />
                    <Tag
                      label="Тип боли"
                      value={label(dict.type, r.pain_type_id)}
                    />
                    <Tag
                      label="Положение тела"
                      value={label(dict.pos, r.body_position_id)}
                    />
                    <Tag
                      label="Дыхание"
                      value={label(dict.breath, r.breathing_relation_id)}
                    />
                    <Tag
                      label="Физ. активность"
                      value={label(
                        dict.act,
                        r.physical_activity_relation_id
                      )}
                    />
                    <Tag
                      label="Стресс"
                      value={label(dict.stress, r.stress_relation_id)}
                    />
                    <Tag
                      label="Время суток"
                      value={label(dict.day, r.time_of_day_id)}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Modal
        open={!!selectedZone}
        title={
          selectedZone
            ? `Характеристика боли — ${selectedZone.zone_name}`
            : "Характеристика боли"
        }
        onClose={() => setSelectedZone(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedZone(null)}>
              Отмена
            </Button>
            <Button onClick={onSave} loading={saving}>
              Сохранить
            </Button>
          </>
        }
      >
        {errSave && <Alert type="error">{errSave}</Alert>}
        <div className={styles.grid}>
          <div className={styles.row}>
            <Select
              label="Интенсивность"
              value={form.pain_intensity_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  pain_intensity_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(
                dicts?.pain_intensity,
                (i) => `Уровень ${i.level ?? i.name}`
              )}
            />
            <Select
              label="Тип боли"
              value={form.pain_type_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  pain_type_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(dicts?.pain_type)}
            />
            <Select
              label="Время суток"
              value={form.time_of_day_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  time_of_day_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(
                dicts?.time_of_day,
                (i) => i.period ?? i.name
              )}
            />
          </div>

          <div className={styles.row}>
            <Select
              label="Положение тела"
              value={form.body_position_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  body_position_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(dicts?.body_position)}
            />
            <Select
              label="Дыхание"
              value={form.breathing_relation_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  breathing_relation_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(dicts?.breathing_relation)}
            />
            <Select
              label="Физ. активность"
              value={form.physical_activity_relation_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  physical_activity_relation_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(dicts?.physical_activity_relation)}
            />
            <Select
              label="Стресс"
              value={form.stress_relation_id ?? ""}
              onChange={(v) =>
                setForm((s) => ({
                  ...s,
                  stress_relation_id: v ? Number(v) : undefined,
                }))
              }
              options={mkOptions(dicts?.stress_relation)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

/* маленький компонент-пилюля */
function Tag({ label, value }: { label: string; value?: string }) {
  return (
    <div className={hist.tag}>
      <span className={hist.tagKey}>{label}</span>
      <span className={hist.tagVal}>{value || "—"}</span>
    </div>
  );
}
