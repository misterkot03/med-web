"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { useAuth } from "@/lib/AuthContext";
import {
  AdminRecommendation,
  ComparisonType,
  RecommendationCondition,
  RecommendationConditionGroup,
  getAllRecommendations,
  getComparisonTypes,
  getParametersDescription,
  getRecommendationConditionGroups,
  getRecommendationConditions,
  saveConditionGroup,
  saveConditionToGroup,
  saveRecommendation,
  saveRecommendationCondition,
  // --- новое из API ---
  updateRecommendation,
  deleteRecommendation,
  updateRecommendationCondition,
  deleteRecommendationCondition,
  updateConditionGroup,
  deleteConditionGroup,
  deleteConditionFromGroup,
  getParameterReferences,
  saveParameter,
  updateParameter,
  deleteParameter,
  getRecommendationsForTest,
  type ParameterDescription,
} from "@/lib/api";

import styles from "./expert.module.css";

/** Вкладки админки эксперта */
type TabId = "recs" | "conds" | "groups" | "params" | "test";

/** Ссылочные данные для параметров */
type ParameterRefs = {
  parameter_types: { id: number; name: string }[];
  received_types: { id: number; name: string }[];
  measurement_units: { id: number; name: string }[];
  frequency_rates: { id: number; name: string }[];
};

/** Результат теста рекомендаций */
type TestRecommendation = {
  recommendation_id: number;
  recommendation_name: string;
  recommendation_description: string;
  condition_group_id: number | null;
};

export default function ExpertPage() {
  const { session, logout } = useAuth();
  const [tab, setTab] = useState<TabId>("recs");

  if (!session) {
    return (
      <div className="page-gap">
        <Card
          title="Админка эксперта"
          headerRight={<Link href="/auth">Войти</Link>}
        >
          <p>
            Для доступа к админке эксперта необходимо{" "}
            <Link href="/auth">войти в систему</Link>.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-gap">
      <Card
        title="Админка эксперта"
        headerRight={
          <div className={styles.headerRight}>
            <span className={styles.userBadge}>
              {session.username || session.email || `ID ${session.userId}`}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Выйти
            </Button>
          </div>
        }
      >
        <p className={styles.subTitle}>
          Здесь настраиваются правила формирования медицинских рекомендаций:
          список рекомендаций, условия для параметров, группы условий и
          справочник параметров. Также можно протестировать работу правил.
        </p>

        <div className={styles.tabs}>
          <button
            type="button"
            className={
              tab === "recs"
                ? `${styles.tabBtn} ${styles.tabBtnActive}`
                : styles.tabBtn
            }
            onClick={() => setTab("recs")}
          >
            Рекомендации
          </button>
          <button
            type="button"
            className={
              tab === "conds"
                ? `${styles.tabBtn} ${styles.tabBtnActive}`
                : styles.tabBtn
            }
            onClick={() => setTab("conds")}
          >
            Условия
          </button>
          <button
            type="button"
            className={
              tab === "groups"
                ? `${styles.tabBtn} ${styles.tabBtnActive}`
                : styles.tabBtn
            }
            onClick={() => setTab("groups")}
          >
            Группы условий
          </button>
          <button
            type="button"
            className={
              tab === "params"
                ? `${styles.tabBtn} ${styles.tabBtnActive}`
                : styles.tabBtn
            }
            onClick={() => setTab("params")}
          >
            Параметры
          </button>
          <button
            type="button"
            className={
              tab === "test"
                ? `${styles.tabBtn} ${styles.tabBtnActive}`
                : styles.tabBtn
            }
            onClick={() => setTab("test")}
          >
            Тестирование
          </button>
        </div>
      </Card>

      {tab === "recs" && <RecommendationsAdmin />}
      {tab === "conds" && <ConditionsAdmin />}
      {tab === "groups" && <GroupsAdmin />}
      {tab === "params" && <ParametersAdmin />}
      {tab === "test" && <TestAdmin />}
    </div>
  );
}

/* ---------- Вкладка "Рекомендации" ---------- */

function RecommendationsAdmin() {
  const [list, setList] = useState<AdminRecommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const hasData = list && list.length > 0;

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await getAllRecommendations();
      setList(data);
    } catch (e: any) {
      setErr(e?.message || "Не удалось загрузить список рекомендаций");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim()) return;

    setLoading(true);
    setErr(null);

    try {
      if (editingId != null) {
        // обновление
        await updateRecommendation(editingId, {
          name: name.trim(),
          description: description.trim(),
        });
        setList((prev) =>
          (prev || []).map((r) =>
            r.id === editingId
              ? { ...r, name: name.trim(), description: description.trim() }
              : r
          )
        );
        resetForm();
      } else {
        // создание
        const res = await saveRecommendation({
          name: name.trim(),
          description: description.trim(),
        });
        setList((prev) => [
          ...(prev || []),
          {
            id: res.recommendation_id,
            name: name.trim(),
            description: description.trim(),
          },
        ]);
        resetForm();
      }
    } catch (e: any) {
      setErr(e?.message || "Ошибка при сохранении рекомендации");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (r: AdminRecommendation) => {
    setEditingId(r.id);
    setName(r.name || "");
    setDescription(r.description || "");
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Удалить эту рекомендацию?")) return;

    setLoading(true);
    setErr(null);
    try {
      await deleteRecommendation(id);
      setList((prev) => (prev || []).filter((r) => r.id !== id));
      if (editingId === id) {
        resetForm();
      }
    } catch (e: any) {
      setErr(e?.message || "Не удалось удалить рекомендацию");
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = editingId != null;

  return (
    <div className={styles.gridTwo}>
      <Card
        title={isEditMode ? "Редактировать рекомендацию" : "Добавить рекомендацию"}
      >
        {err && <Alert type="error">{err}</Alert>}

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            label="Название"
            placeholder="Например: Рекомендации при повышенном давлении"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className={styles.textareaLabel}>
            <span className={styles.textareaTitle}>Описание</span>
            <textarea
              className={styles.textarea}
              placeholder="Кратко опишите смысл рекомендации и её назначение..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </label>

          <div className={styles.formActions}>
            <Button type="submit" loading={loading}>
              {isEditMode ? "Сохранить изменения" : "Сохранить"}
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Отменить
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card title="Список рекомендаций">
        {!hasData && !loading && (
          <p className={styles.muted}>
            Рекомендаций пока нет. Добавьте первую в форме слева.
          </p>
        )}

        {loading && <p className={styles.muted}>Загружаем данные…</p>}

        {hasData && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Описание</th>
                  <th className={styles.tableActionsCol}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {list!.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.description}</td>
                    <td className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.tableActionBtn}
                        onClick={() => startEdit(r)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className={`${styles.tableActionBtn} ${styles.tableActionDanger}`}
                        onClick={() => onDelete(r.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Вкладка "Условия" ---------- */

function ConditionsAdmin() {
  const [params, setParams] = useState<ParameterDescription[] | null>(null);
  const [types, setTypes] = useState<ComparisonType[] | null>(null);
  const [conditions, setConditions] = useState<RecommendationCondition[] | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [parameterId, setParameterId] = useState<string>("");
  const [comparisonTypeId, setComparisonTypeId] = useState<string>("");
  const [value1, setValue1] = useState("");
  const [value2, setValue2] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const hasConditions = conditions && conditions.length > 0;

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, t, c] = await Promise.all([
        getParametersDescription(),
        getComparisonTypes(),
        getRecommendationConditions(),
      ]);
      setParams(p);
      setTypes(t);
      setConditions(c);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки данных для условий");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const paramOptions = useMemo(
    () =>
      [{ value: "", label: "— выберите параметр —" }].concat(
        (params || []).map((p) => ({
          value: String(p.id),
          label: p.name,
        }))
      ),
    [params]
  );

  const typeOptions = useMemo(
    () =>
      [{ value: "", label: "— тип сравнения —" }].concat(
        (types || []).map((t) => ({
          value: String(t.id),
          label: `${t.type} — ${t.description}`,
        }))
      ),
    [types]
  );

  const resetForm = () => {
    setEditingId(null);
    setParameterId("");
    setComparisonTypeId("");
    setValue1("");
    setValue2("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parameterId || !comparisonTypeId || !value1.trim()) return;

    setLoading(true);
    setErr(null);
    try {
      const payload = {
        parameter_id: Number(parameterId),
        comparison_type_id: Number(comparisonTypeId),
        value1: value1.trim(),
        value2: value2.trim() || null,
      };

      if (editingId != null) {
        await updateRecommendationCondition(editingId, payload);
      } else {
        await saveRecommendationCondition(payload);
      }

      resetForm();
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось сохранить условие");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (c: RecommendationCondition) => {
    setEditingId(c.id);

    // Пытаемся восстановить id параметра по имени
    const param = (params || []).find((p) => p.name === c.parameter_name);
    setParameterId(param ? String(param.id) : "");

    // Пытаемся восстановить id типа сравнения по описанию
    const t = (types || []).find(
      (t) => t.description === c.comparison_type
    );
    setComparisonTypeId(t ? String(t.id) : "");

    setValue1(c.value1 || "");
    setValue2(c.value2 || "");
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Удалить это условие?")) return;

    setLoading(true);
    setErr(null);
    try {
      await deleteRecommendationCondition(id);
      setConditions((prev) => (prev || []).filter((c) => c.id !== id));
      if (editingId === id) {
        resetForm();
      }
    } catch (e: any) {
      setErr(e?.message || "Не удалось удалить условие");
    } finally {
      setLoading(false);
    }
  };

  const isEditMode = editingId != null;

  return (
    <div className={styles.gridTwo}>
      <Card
        title={
          isEditMode
            ? "Редактировать условие рекомендации"
            : "Добавить условие рекомендации"
        }
      >
        {err && <Alert type="error">{err}</Alert>}

        <form className={styles.form} onSubmit={onSubmit}>
          <Select
            label="Параметр"
            name="parameter_id"
            value={parameterId}
            onChange={(v) => setParameterId(v)}
            options={paramOptions}
          />

          <Select
            label="Тип сравнения"
            name="comparison_type_id"
            value={comparisonTypeId}
            onChange={(v) => setComparisonTypeId(v)}
            options={typeOptions}
          />

          <Input
            label="Значение 1"
            placeholder="Например: 120"
            value={value1}
            onChange={(e) => setValue1(e.target.value)}
            required
          />

          <Input
            label="Значение 2 (опционально)"
            placeholder="Например: 140"
            value={value2}
            onChange={(e) => setValue2(e.target.value)}
          />

          <div className={styles.formActions}>
            <Button type="submit" loading={loading}>
              {isEditMode ? "Сохранить изменения" : "Сохранить условие"}
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Отменить
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card title="Список условий">
        {!hasConditions && !loading && (
          <p className={styles.muted}>
            Условий пока нет. Добавьте первое условие в форме слева.
          </p>
        )}

        {loading && <p className={styles.muted}>Загружаем данные…</p>}

        {hasConditions && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Параметр</th>
                  <th>Тип сравнения</th>
                  <th>Значение 1</th>
                  <th>Значение 2</th>
                  <th className={styles.tableActionsCol}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {conditions!.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.parameter_name}</td>
                    <td>{c.comparison_type}</td>
                    <td>{c.value1}</td>
                    <td>{c.value2}</td>
                    <td className={styles.tableActions}>
                      <button
                        type="button"
                        className={styles.tableActionBtn}
                        onClick={() => startEdit(c)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className={`${styles.tableActionBtn} ${styles.tableActionDanger}`}
                        onClick={() => onDelete(c.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Вкладка "Группы условий" ---------- */

function GroupsAdmin() {
  const [recs, setRecs] = useState<AdminRecommendation[] | null>(null);
  const [conditions, setConditions] = useState<RecommendationCondition[] | null>(
    null
  );
  const [groups, setGroups] = useState<RecommendationConditionGroup[] | null>(
    null
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // форма: новая группа
  const [groupRecId, setGroupRecId] = useState<string>("");
  const [groupDesc, setGroupDesc] = useState("");

  // форма: редактирование группы
  const [editGroupId, setEditGroupId] = useState<string>("");
  const [editGroupRecId, setEditGroupRecId] = useState<string>("");
  const [editGroupDesc, setEditGroupDesc] = useState("");

  // форма: привязка условия к группе
  const [linkCondId, setLinkCondId] = useState<string>("");
  const [linkGroupId, setLinkGroupId] = useState<string>("");

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [r, c, g] = await Promise.all([
        getAllRecommendations(),
        getRecommendationConditions(),
        getRecommendationConditionGroups(),
      ]);
      setRecs(r);
      setConditions(c);
      setGroups(g);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки данных по группам условий");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const recOptions = useMemo(
    () =>
      [{ value: "", label: "— рекомендация —" }].concat(
        (recs || []).map((r) => ({
          value: String(r.id),
          label: `${r.id}. ${r.name}`,
        }))
      ),
    [recs]
  );

  const condOptions = useMemo(
    () =>
      [{ value: "", label: "— условие —" }].concat(
        (conditions || []).map((c) => ({
          value: String(c.id),
          label: `${c.id}. ${c.parameter_name} ${c.comparison_type} ${c.value1}${
            c.value2 ? " и " + c.value2 : ""
          }`,
        }))
      ),
    [conditions]
  );

  const groupOptions = useMemo(
    () =>
      [{ value: "", label: "— группа условий —" }].concat(
        (groups || []).map((g) => ({
          value: String(g.group_id),
          label:
            `Группа #${g.group_id}` +
            (g.group_description ? ` — ${g.group_description}` : ""),
        }))
      ),
    [groups]
  );

  const onCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupRecId) return;

    setLoading(true);
    setErr(null);
    try {
      await saveConditionGroup({
        recommendation_id: Number(groupRecId),
        description: groupDesc.trim() || null,
      });
      setGroupDesc("");
      setGroupRecId("");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось создать группу условий");
    } finally {
      setLoading(false);
    }
  };

  const onLinkCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCondId || !linkGroupId) return;

    setLoading(true);
    setErr(null);
    try {
      await saveConditionToGroup({
        recommendation_condition_id: Number(linkCondId),
        recommendation_condition_group_id: Number(linkGroupId),
      });
      setLinkCondId("");
      setLinkGroupId("");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось привязать условие к группе");
    } finally {
      setLoading(false);
    }
  };

  const onEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroupId || !editGroupRecId) return;

    setLoading(true);
    setErr(null);
    try {
      await updateConditionGroup(Number(editGroupId), {
        recommendation_id: Number(editGroupRecId),
        description: editGroupDesc.trim() || null,
      });
      setEditGroupId("");
      setEditGroupRecId("");
      setEditGroupDesc("");
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось обновить группу условий");
    } finally {
      setLoading(false);
    }
  };

  const onDeleteGroup = async (groupId: number) => {
    if (!window.confirm("Удалить эту группу условий?")) return;

    setLoading(true);
    setErr(null);
    try {
      await deleteConditionGroup(groupId);
      setGroups((prev) => (prev || []).filter((g) => g.group_id !== groupId));
    } catch (e: any) {
      setErr(e?.message || "Не удалось удалить группу");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEditGroup = (groupIdStr: string) => {
    setEditGroupId(groupIdStr);
    if (!groupIdStr) {
      setEditGroupRecId("");
      setEditGroupDesc("");
      return;
    }
    const groupId = Number(groupIdStr);
    const g = (groups || []).find((x) => x.group_id === groupId);
    if (!g) return;

    // предполагаем, что у группы всегда хотя бы одна рекомендация
    const rec = g.recommendations[0];
    setEditGroupRecId(String(rec.recommendation_id));
    setEditGroupDesc(g.group_description || "");
  };

  const findConditionIdForGroupItem = (item: {
    parameter_name: string;
    comparison_type: string;
    value1: string;
    value2?: string | null;
  }): number | undefined => {
    const list = conditions || [];
    const match = list.find(
      (c) =>
        c.parameter_name === item.parameter_name &&
        c.comparison_type === item.comparison_type &&
        c.value1 === item.value1 &&
        (c.value2 || null) === (item.value2 || null)
    );
    return match?.id;
  };

  const onUnlinkCondition = async (
    groupId: number,
    cond: {
      parameter_name: string;
      comparison_type: string;
      value1: string;
      value2?: string | null;
    }
  ) => {
    const condId = findConditionIdForGroupItem(cond);
    if (!condId) {
      setErr(
        "Не удалось определить ID условия для отвязки. Проверьте список условий."
      );
      return;
    }

    if (
      !window.confirm(
        `Удалить условие #${condId} из группы #${groupId}?`
      )
    ) {
      return;
    }

    setLoading(true);
    setErr(null);
    try {
      await deleteConditionFromGroup(condId, groupId);
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось отвязать условие от группы");
    } finally {
      setLoading(false);
    }
  };

  const hasGroups = groups && groups.length > 0;

  return (
    <div className={styles.gridTwo}>
      <Card title="Создание и настройка групп условий">
        {err && <Alert type="error">{err}</Alert>}

        <div className={styles.stack}>
          {/* Создание новой группы */}
          <form className={styles.form} onSubmit={onCreateGroup}>
            <h3 className={styles.formTitle}>Новая группа условий</h3>

            <Select
              label="Рекомендация"
              name="recommendation_id"
              value={groupRecId}
              onChange={(v) => setGroupRecId(v)}
              options={recOptions}
            />

            <label className={styles.textareaLabel}>
              <span className={styles.textareaTitle}>Описание группы</span>
              <textarea
                className={styles.textarea}
                placeholder="Например: Условия по давлению и пульсу для базовой рекомендации"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
              />
            </label>

            <div className={styles.formActions}>
              <Button type="submit" loading={loading}>
                Создать группу
              </Button>
            </div>
          </form>

          {/* Редактирование группы */}
          <form className={styles.form} onSubmit={onEditGroup}>
            <h3 className={styles.formTitle}>Редактировать группу условий</h3>

            <Select
              label="Группа условий"
              name="group_id"
              value={editGroupId}
              onChange={handleSelectEditGroup}
              options={groupOptions}
            />

            <Select
              label="Рекомендация"
              name="edit_recommendation_id"
              value={editGroupRecId}
              onChange={(v) => setEditGroupRecId(v)}
              options={recOptions}
            />

            <label className={styles.textareaLabel}>
              <span className={styles.textareaTitle}>Описание группы</span>
              <textarea
                className={styles.textarea}
                placeholder="Описание группы условий"
                value={editGroupDesc}
                onChange={(e) => setEditGroupDesc(e.target.value)}
              />
            </label>

            <div className={styles.formActions}>
              <Button type="submit" loading={loading} disabled={!editGroupId}>
                Сохранить изменения
              </Button>
            </div>
          </form>

          {/* Привязка условия к группе */}
          <form className={styles.form} onSubmit={onLinkCondition}>
            <h3 className={styles.formTitle}>Привязать условие к группе</h3>

            <Select
              label="Условие"
              name="recommendation_condition_id"
              value={linkCondId}
              onChange={(v) => setLinkCondId(v)}
              options={condOptions}
            />

            <Select
              label="Группа условий"
              name="recommendation_condition_group_id"
              value={linkGroupId}
              onChange={(v) => setLinkGroupId(v)}
              options={groupOptions}
            />

            <div className={styles.formActions}>
              <Button type="submit" loading={loading}>
                Добавить условие в группу
              </Button>
            </div>
          </form>
        </div>
      </Card>

      <Card title="Группы и их условия">
        {!hasGroups && !loading && (
          <p className={styles.muted}>
            Групп условий пока нет. Создайте их в форме слева.
          </p>
        )}

        {loading && <p className={styles.muted}>Загружаем данные…</p>}

        {hasGroups && (
          <div className={styles.groupsList}>
            {groups!.map((g) => (
              <div key={g.group_id} className={styles.groupCard}>
                <div className={styles.groupHeader}>
                  <div className={styles.groupTitleRow}>
                    <span className={styles.groupBadge}>
                      Группа #{g.group_id}
                    </span>
                    {g.group_description && (
                      <span className={styles.groupDesc}>
                        {g.group_description}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`${styles.tableActionBtn} ${styles.tableActionDanger}`}
                      onClick={() => onDeleteGroup(g.group_id)}
                    >
                      Удалить группу
                    </button>
                  </div>
                </div>

                {g.recommendations.map((r) => (
                  <div key={r.recommendation_id} className={styles.groupBlock}>
                    <div className={styles.groupRecTitle}>
                      {r.recommendation_name}
                    </div>
                    {(!r.conditions || r.conditions.length === 0) && (
                      <p className={styles.mutedSmall}>
                        Для этой группы ещё нет привязанных условий.
                      </p>
                    )}
                    {r.conditions && r.conditions.length > 0 && (
                      <ul className={styles.conditionsList}>
                        {r.conditions.map((c, idx) => (
                          <li key={idx} className={styles.conditionItem}>
                            <span className={styles.conditionParam}>
                              {c.parameter_name}
                              {c.measurement_unit &&
                                `, ${c.measurement_unit}`}
                            </span>
                            <span className={styles.conditionExpr}>
                              {c.comparison_type} {c.value1}
                              {c.value2 ? ` и ${c.value2}` : ""}
                            </span>
                            <button
                              type="button"
                              className={`${styles.tableActionBtn} ${styles.tableActionDanger}`}
                              onClick={() =>
                                onUnlinkCondition(g.group_id, c)
                              }
                            >
                              Удалить из группы
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Вкладка "Параметры" ---------- */

function ParametersAdmin() {
  const [params, setParams] = useState<ParameterDescription[] | null>(null);
  const [refs, setRefs] = useState<ParameterRefs | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [typeId, setTypeId] = useState("");
  const [receivedTypeId, setReceivedTypeId] = useState("");
  const [measurementUnitId, setMeasurementUnitId] = useState("");
  const [frequencyRateId, setFrequencyRateId] = useState("");
  const [count, setCount] = useState("1");

  const loadAll = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [p, r] = await Promise.all([
        getParametersDescription(),
        getParameterReferences(),
      ]);
      setParams(p);
      setRefs(r as ParameterRefs);
    } catch (e: any) {
      setErr(e?.message || "Ошибка загрузки параметров");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const typeOptions = useMemo(
    () =>
      [{ value: "", label: "— тип параметра —" }].concat(
        (refs?.parameter_types || []).map((t) => ({
          value: String(t.id),
          label: t.name,
        }))
      ),
    [refs]
  );

  const receivedTypeOptions = useMemo(
    () =>
      [{ value: "", label: "— способ получения —" }].concat(
        (refs?.received_types || []).map((t) => ({
          value: String(t.id),
          label: t.name,
        }))
      ),
    [refs]
  );

  const measurementUnitOptions = useMemo(
    () =>
      [{ value: "", label: "— единица измерения —" }].concat(
        (refs?.measurement_units || []).map((t) => ({
          value: String(t.id),
          label: t.name,
        }))
      ),
    [refs]
  );

  const frequencyRateOptions = useMemo(
    () =>
      [{ value: "", label: "— частота измерения —" }].concat(
        (refs?.frequency_rates || []).map((t) => ({
          value: String(t.id),
          label: t.name,
        }))
      ),
    [refs]
  );

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setTypeId("");
    setReceivedTypeId("");
    setMeasurementUnitId("");
    setFrequencyRateId("");
    setCount("1");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !typeId || !receivedTypeId) return;

    setLoading(true);
    setErr(null);

    const payload = {
      name: name.trim(),
      type_id: Number(typeId),
      received_type_id: Number(receivedTypeId),
      count: count ? Number(count) : 1,
      frequency_rate_id: frequencyRateId ? Number(frequencyRateId) : null,
      measurement_unit_id: measurementUnitId
        ? Number(measurementUnitId)
        : null,
      description: description.trim() || null,
    };

    try {
      if (editingId != null) {
        await updateParameter(editingId, payload);
      } else {
        await saveParameter(payload);
      }
      resetForm();
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Не удалось сохранить параметр");
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (p: ParameterDescription) => {
    setEditingId(p.id);
    setName((p as any).name || "");
    setDescription((p as any).description || "");
    setTypeId((p as any).type_id ? String((p as any).type_id) : "");
    setReceivedTypeId(
      (p as any).received_type_id ? String((p as any).received_type_id) : ""
    );
    setMeasurementUnitId(
      (p as any).measurement_unit_id
        ? String((p as any).measurement_unit_id)
        : ""
    );
    setFrequencyRateId(
      (p as any).frequency_rate_id ? String((p as any).frequency_rate_id) : ""
    );
    setCount((p as any).count ? String((p as any).count) : "1");
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Удалить этот параметр?")) return;

    setLoading(true);
    setErr(null);
    try {
      await deleteParameter(id);
      setParams((prev) => (prev || []).filter((p) => p.id !== id));
      if (editingId === id) resetForm();
    } catch (e: any) {
      setErr(e?.message || "Не удалось удалить параметр");
    } finally {
      setLoading(false);
    }
  };

  const labelById = (
    arr: { id: number; name: string }[] | undefined,
    id?: number | null
  ): string => {
    if (!arr || id == null) return "";
    return arr.find((x) => x.id === id)?.name || "";
  };
   const mapTypeLabel = (label: string): string => {
    switch (label) {
      case "float":
        return "Число (вещественное)";
      case "integer":
        return "Число (целое)";
      case "string":
        return "Строка";
      case "bool":
      case "boolean":
        return "Логический";
      default:
        return label || "";
    }
  };

  const mapReceivedTypeLabel = (label: string): string => {
    switch (label) {
      case "user_input":
        return "Ручной ввод";
      case "device_import":
        return "Импорт с устройства";
      case "computed":
        return "Рассчитано системой";
      case "option":
        return "Выбор из вариантов";
      default:
        return label || "";
    }
  };

  const hasParams = params && params.length > 0;
  const isEditMode = editingId != null;

  return (
    <div className={styles.gridTwo}>
      <Card
        title={
          isEditMode
            ? "Редактировать параметр"
            : "Добавить параметр"
        }
      >
        {err && <Alert type="error">{err}</Alert>}

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            label="Название"
            placeholder="Например: Артериальное давление"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className={styles.textareaLabel}>
            <span className={styles.textareaTitle}>Описание</span>
            <textarea
              className={styles.textarea}
              placeholder="Краткое описание параметра"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <Select
            label="Тип параметра"
            name="type_id"
            value={typeId}
            onChange={(v) => setTypeId(v)}
            options={typeOptions}
          />

          <Select
            label="Способ получения"
            name="received_type_id"
            value={receivedTypeId}
            onChange={(v) => setReceivedTypeId(v)}
            options={receivedTypeOptions}
          />

          <Select
            label="Единица измерения"
            name="measurement_unit_id"
            value={measurementUnitId}
            onChange={(v) => setMeasurementUnitId(v)}
            options={measurementUnitOptions}
          />

          <Select
            label="Частота измерения"
            name="frequency_rate_id"
            value={frequencyRateId}
            onChange={(v) => setFrequencyRateId(v)}
            options={frequencyRateOptions}
          />

          <Input
            label="Количество значений"
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />

          <div className={styles.formActions}>
            <Button type="submit" loading={loading}>
              {isEditMode ? "Сохранить изменения" : "Сохранить параметр"}
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetForm}
              >
                Отменить
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card title="Справочник параметров">
        {!hasParams && !loading && (
          <p className={styles.muted}>
            Параметров пока нет. Добавьте первый параметр в форме слева.
          </p>
        )}

        {loading && <p className={styles.muted}>Загружаем данные…</p>}

        {hasParams && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Название</th>
                  <th>Ед. изм.</th>
                  <th>Тип</th>
                  <th>Получение</th>
                  <th>Частота</th>
                  <th>Кол-во знач.</th>
                  <th className={styles.tableActionsCol}>Действия</th>
                </tr>
              </thead>
              <tbody>
  {params!.map((p) => (
    <tr key={p.id}>
      <td>{p.id}</td>

<td>
  <div className={styles.paramNameMain}>
    {(p as any).description || (p as any).name}
  </div>
</td>


      <td>
        {labelById(
          refs?.measurement_units,
          (p as any).measurement_unit_id
        )}
      </td>
      <td>
  {mapTypeLabel(
    labelById(
      refs?.parameter_types,
      (p as any).type_id
    )
  )}
</td>
<td>
  {mapReceivedTypeLabel(
    labelById(
      refs?.received_types,
      (p as any).received_type_id
    )
  )}
</td>

      <td>
        {labelById(
          refs?.frequency_rates,
          (p as any).frequency_rate_id
        )}
      </td>
      <td>{(p as any).count}</td>
      <td className={styles.tableActions}>
        <button
          type="button"
          className={styles.tableActionBtn}
          onClick={() => onEdit(p)}
        >
          Редактировать
        </button>
        <button
          type="button"
          className={`${styles.tableActionBtn} ${styles.tableActionDanger}`}
          onClick={() => onDelete(p.id)}
        >
          Удалить
        </button>
      </td>
    </tr>
  ))}
</tbody>

            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Вкладка "Тестирование рекомендаций" ---------- */

type TestParamItem = {
  parameter_id: number;
  parameter_name: string;
  value1: string;
  value2: string;
};

function TestAdmin() {
  const [params, setParams] = useState<ParameterDescription[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [selectedParamId, setSelectedParamId] = useState<string>("");
  const [testValue1, setTestValue1] = useState("");
  const [testValue2, setTestValue2] = useState("");

  const [testParams, setTestParams] = useState<TestParamItem[]>([]);
  const [results, setResults] = useState<TestRecommendation[] | null>(null);

  const loadParams = async () => {
    setLoading(true);
    setErr(null);
    try {
      const p = await getParametersDescription();
      setParams(p);
    } catch (e: any) {
      setErr(e?.message || "Не удалось загрузить параметры");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParams();
  }, []);

  const paramOptions = useMemo(
    () =>
      [{ value: "", label: "— параметр —" }].concat(
        (params || []).map((p) => ({
          value: String(p.id),
          label: (p as any).name,
        }))
      ),
    [params]
  );

  const addTestParam = () => {
    if (!selectedParamId || !testValue1.trim()) return;

    const p = (params || []).find((x) => String(x.id) === selectedParamId);
    if (!p) return;

    const item: TestParamItem = {
      parameter_id: p.id,
      parameter_name: (p as any).name,
      value1: testValue1.trim(),
      value2: testValue2.trim(),
    };

    setTestParams((prev) => {
      // не дублируем один и тот же параметр
      const filtered = prev.filter(
        (x) => x.parameter_id !== item.parameter_id
      );
      return [...filtered, item];
    });

    setSelectedParamId("");
    setTestValue1("");
    setTestValue2("");
  };

  const removeTestParam = (id: number) => {
    setTestParams((prev) => prev.filter((x) => x.parameter_id !== id));
  };

  const runTest = async () => {
    if (!testParams.length) {
      setErr("Добавьте хотя бы один параметр для теста");
      return;
    }

    setLoading(true);
    setErr(null);
    setResults(null);

    const payload = testParams.map((p) => ({
      parameter_id: p.parameter_id,
      value1: p.value1,
      value2: p.value2 || null,
    }));

    try {
      const res = (await getRecommendationsForTest(
        payload
      )) as TestRecommendation[];
      setResults(res || []);
    } catch (e: any) {
      setErr(e?.message || "Не удалось выполнить тестирование");
    } finally {
      setLoading(false);
    }
  };

  const hasResults = results && results.length > 0;

  return (
    <div className={styles.testLayout}>
      <Card title="Настройка тестового набора параметров">
        {err && <Alert type="error">{err}</Alert>}

        <div className={styles.form}>
          <Select
            label="Параметр"
            name="test_parameter_id"
            value={selectedParamId}
            onChange={(v) => setSelectedParamId(v)}
            options={paramOptions}
          />

          <Input
            label="Значение 1"
            placeholder="Например: 120"
            value={testValue1}
            onChange={(e) => setTestValue1(e.target.value)}
          />

          <Input
            label="Значение 2 (опционально)"
            placeholder="Например: 80"
            value={testValue2}
            onChange={(e) => setTestValue2(e.target.value)}
          />

          <div className={styles.formActions}>
            <Button type="button" onClick={addTestParam}>
              Добавить параметр в тест
            </Button>
          </div>
        </div>

        {testParams.length > 0 && (
          <div className={styles.testParamList}>
            <h3 className={styles.formTitle}>Текущий набор параметров</h3>
            {testParams.map((p) => (
              <div key={p.parameter_id} className={styles.testParamItem}>
                <div>
                  <div className={styles.testParamName}>{p.parameter_name}</div>
                  <div className={styles.testParamValues}>
                    {p.value1}
                    {p.value2 && ` / ${p.value2}`}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.testParamRemove}
                  onClick={() => removeTestParam(p.parameter_id)}
                >
                  Удалить
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.formActions}>
          <Button type="button" onClick={runTest} loading={loading}>
            Протестировать рекомендации
          </Button>
        </div>
      </Card>

      <Card title="Результат тестирования">
        {!hasResults && !loading && (
          <p className={styles.muted}>
            Заполните тестовый набор параметров и запустите тестирование, чтобы
            увидеть рекомендации.
          </p>
        )}

        {loading && <p className={styles.muted}>Выполняем расчёт…</p>}

        {hasResults && (
          <div className={styles.testResultList}>
            {results!.map((r) => (
              <div key={r.recommendation_id} className={styles.testResultItem}>
                <div className={styles.testResultTitle}>
                  {r.recommendation_name}
                </div>
                <div className={styles.testResultDesc}>
                  {r.recommendation_description}
                </div>
                {r.condition_group_id != null && (
                  <div className={styles.testResultMeta}>
                    Группа условий #{r.condition_group_id}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
