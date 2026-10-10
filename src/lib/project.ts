import { useMemo } from 'react';
import { useStore } from './store';
import { analyze } from './calc';
import {
  BUILD_END_MONTH, PHASES, TASKS, dateAtMonth, phaseAt, recommend, simParams, simulate, type Reco, type RecoLevel,
} from './monitoring';
import type { Project } from './types';

/** Empfehlungen, die inhaltlich einer Projektaufgabe entsprechen (werden mit ihr zusammengeführt). */
const RECO_TASK: Record<string, string> = {
  'r-foerder': 'p4',
  'r-berat': 'p3',
  'r-wasser': 'g1',
  'r-bau': 'b1',
  'r-pegel': 'b3',
  'r-etab': 'e2',
  'r-vwn': 'e3',
  'r-sell': 'e4',
  'r-harvest': 'o1',
  'r-cert': 'o3',
};

const LEVEL_WEIGHT: Record<RecoLevel, number> = { kritisch: 0, wichtig: 1, hinweis: 2, positiv: 3 };

export interface Todo {
  id: string;
  title: string;
  text?: string;
  level?: RecoLevel;
  cta?: Reco['cta'];
  /** gesetzt, wenn es eine abhakbare Projektaufgabe ist */
  taskId?: string;
  done?: boolean;
  /** Aufgabe einer späteren Phase (aktuelle Phase ist erledigt) */
  upcoming?: string;
}

/**
 * Eine gemeinsame Liste aus Aufgaben der aktuellen Phase und Empfehlungen.
 * Empfehlungen, die einer Aufgabe entsprechen, werden in die Aufgabe übernommen,
 * statt doppelt zu erscheinen.
 */
export function buildTodos(project: Project, phaseId: string, recos: Reco[]): Todo[] {
  const taskToReco = new Map(Object.entries(RECO_TASK).map(([r, t]) => [t, r]));
  const recoById = new Map(recos.map((r) => [r.id, r]));
  const used = new Set<string>();

  const tasks: Todo[] = TASKS.filter((t) => t.phase === phaseId).map((t) => {
    const r = recoById.get(taskToReco.get(t.id) ?? '');
    if (r) used.add(r.id);
    return { id: t.id, taskId: t.id, title: t.label, text: r?.text, level: r?.level, cta: r?.cta, done: !!project.tasks[t.id] };
  });

  // Hinweise ohne passende offene Aufgabe (z. B. Wasserstand, Trockenheit)
  const hints: Todo[] = recos
    .filter((r) => !used.has(r.id) && !(RECO_TASK[r.id] && project.tasks[RECO_TASK[r.id]]))
    .map((r) => ({ id: r.id, title: r.title, text: r.text, level: r.level, cta: r.cta }));

  // Aktuelle Phase erledigt: offene Aufgaben der nächsten Phase vorziehen
  const upcoming: Todo[] = [];
  if (tasks.every((t) => t.done)) {
    const from = PHASES.findIndex((p) => p.id === phaseId) + 1;
    for (const ph of PHASES.slice(from)) {
      const open = TASKS.filter((t) => t.phase === ph.id && !project.tasks[t.id]);
      if (open.length) {
        upcoming.push(...open.map((t) => ({ id: t.id, taskId: t.id, title: t.label, upcoming: ph.label })));
        break;
      }
    }
  }

  const weight = (t: Todo) => (t.done ? 9 : t.upcoming ? 5 : LEVEL_WEIGHT[t.level ?? 'hinweis'] + (t.taskId ? 0.5 : 0));
  return [...hints, ...tasks, ...upcoming].sort((a, b) => weight(a) - weight(b));
}

/** Status eines Projekts: Plan, Berechnung, simulierte Pegel und die zusammengeführte Aufgabenliste. */
export function useProjectStatus(projectId?: string | null) {
  const { state, machines } = useStore();
  const project = state.projects.find((p) => p.id === projectId) ?? state.projects[0];
  const plan = project ? state.plans.find((p) => p.id === project.planId) : undefined;
  const parcels = useMemo(
    () => (plan ? state.myParcels.filter((p) => plan.draft.parcelIds.includes(p.id)) : []),
    [plan, state.myParcels],
  );
  const res = useMemo(() => (plan ? analyze(parcels, plan.draft) : null), [plan, parcels]);
  const month = project?.simMonth ?? 0;

  const sim = useMemo(() => {
    if (!res || !project) return null;
    const sp = simParams(project, res);
    const day = Math.round(month * 30.4);
    const from = Math.max(0, day - 364);
    const days = simulate(sp, from, day);
    const last7 = days.slice(-7);
    const last30 = days.slice(-30);
    const wlNow = last7.reduce((a, d) => a + d.wl, 0) / Math.max(1, last7.length);
    const afterBuild = month > BUILD_END_MONTH + 3;
    const inBand = afterBuild ? last30.filter((d) => Math.abs(d.wl - res.targetWl) <= 10).length / Math.max(1, last30.length) : 0;
    return { days, wlNow, inBand, afterBuild };
  }, [res, project, month]);

  if (!project || !plan || !res || !sim) return { project, plan, res, sim: null, ready: false as const };

  const date = dateAtMonth(project.startDate, month);
  const phase = phaseAt(month);
  const recos = recommend({
    project, plan: res, month, date, wlNow: sim.wlNow, inBandShare: sim.inBand, applications: state.applications,
    machines, listings: state.listings, farmLocation: state.farm.location,
  });
  const todos = buildTodos(project, phase.id, recos);

  return { project, plan, parcels, res, sim, month, date, phase, todos, ready: true as const };
}
