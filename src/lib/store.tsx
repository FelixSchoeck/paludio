import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Application, Booking, Farm, Inquiry, Listing, Machine, Parcel, PlanDraft, Project, SavedPlan, Tenure,
} from './types';
import { defaultDraft } from './calc';
import { SEED_LISTINGS, SEED_MACHINES } from './market';
import { findMoorParcels } from './parcels';
import { BW_ALKIS_PARCELS } from './alkis_bw';
import { TASKS } from './monitoring';

export interface AppState {
  onboarded: boolean;
  farm: Farm;
  myParcels: Parcel[];
  draft: PlanDraft;
  plans: SavedPlan[];
  projects: Project[];
  applications: Application[];
  bookings: Booking[];
  myMachines: Machine[];
  listings: Listing[];
  inquiries: Inquiry[];
}

const emptyFarm = (): Farm => ({
  name: '', owner: '', betriebsnummer: '', email: '', phone: '', iban: '', legalForm: 'Einzelunternehmen',
  location: [52.8, 9.2], locationName: 'Niedersachsen',
});

const initialState = (): AppState => ({
  onboarded: false,
  farm: emptyFarm(),
  myParcels: [],
  draft: defaultDraft(),
  plans: [],
  projects: [],
  applications: [],
  bookings: [],
  myMachines: [],
  listings: SEED_LISTINGS,
  inquiries: [],
});

const KEY = 'paludio.prototype.v1';

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return initialState();
}

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

interface Store {
  state: AppState;
  machines: Machine[];
  toast: string | null;
  say: (msg: string) => void;
  setFarm: (patch: Partial<Farm>) => void;
  addParcels: (p: Parcel[]) => void;
  removeParcel: (id: string) => void;
  updateParcel: (id: string, patch: Partial<Parcel>) => void;
  setDraft: (patch: Partial<PlanDraft>) => void;
  savePlan: (name: string) => string;
  deletePlan: (id: string) => void;
  loadPlan: (id: string) => void;
  startProject: (planId: string) => string;
  patchProject: (id: string, patch: Partial<Project>) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  upsertApplication: (a: Application) => void;
  deleteApplication: (id: string) => void;
  addBooking: (b: Booking) => void;
  cancelBooking: (id: string) => void;
  addMachine: (m: Machine) => void;
  addListing: (l: Listing) => void;
  removeListing: (id: string) => void;
  addInquiry: (i: Inquiry) => void;
  completeOnboarding: (farmData: Partial<Farm>, parcels?: Parcel[]) => void;
  resetOnboarding: () => void;
  loadBwDemo: () => void;
  loadDemo: () => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* Speicher voll – Prototyp ignoriert */
    }
  }, [state]);

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200);
  }, []);

  const patch = (fn: (s: AppState) => Partial<AppState>) => setState((s) => ({ ...s, ...fn(s) }));

  const store = useMemo<Store>(
    () => ({
      state,
      machines: [...state.myMachines, ...SEED_MACHINES],
      toast,
      say,
      setFarm: (p) => patch((s) => ({ farm: { ...s.farm, ...p } })),
      addParcels: (ps) =>
        patch((s) => {
          const have = new Set(s.myParcels.map((p) => p.id));
          return { myParcels: [...s.myParcels, ...ps.filter((p) => !have.has(p.id)).map((p) => ({ ...p, tenure: p.tenure ?? ('eigentum' as const) }))] };
        }),
      removeParcel: (id) =>
        patch((s) => ({
          myParcels: s.myParcels.filter((p) => p.id !== id),
          draft: { ...s.draft, parcelIds: s.draft.parcelIds.filter((x) => x !== id) },
        })),
      updateParcel: (id, pt) => patch((s) => ({ myParcels: s.myParcels.map((p) => (p.id === id ? { ...p, ...pt } : p)) })),
      setDraft: (pt) => patch((s) => ({ draft: { ...s.draft, ...pt } })),
      savePlan: (name) => {
        const id = uid('plan');
        patch((s) => ({ plans: [...s.plans, { id, name, createdAt: new Date().toISOString(), draft: { ...s.draft } }] }));
        return id;
      },
      deletePlan: (id) => patch((s) => ({ plans: s.plans.filter((p) => p.id !== id), projects: s.projects.filter((p) => p.planId !== id) })),
      loadPlan: (id) => patch((s) => ({ draft: { ...(s.plans.find((p) => p.id === id)?.draft ?? s.draft) } })),
      startProject: (planId) => {
        const id = uid('proj');
        patch((s) => {
          const plan = s.plans.find((p) => p.id === planId);
          return {
            projects: [
              ...s.projects,
              { id, planId, name: plan?.name ?? 'Projekt', startDate: new Date().toISOString().slice(0, 10), simMonth: 0, tasks: { p1: true } },
            ],
          };
        });
        return id;
      },
      patchProject: (id, pt) => patch((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...pt } : p)) })),
      toggleTask: (projectId, taskId) =>
        patch((s) => ({
          projects: s.projects.map((p) => (p.id === projectId ? { ...p, tasks: { ...p.tasks, [taskId]: !p.tasks[taskId] } } : p)),
        })),
      upsertApplication: (a) =>
        patch((s) => ({
          applications: s.applications.some((x) => x.id === a.id) ? s.applications.map((x) => (x.id === a.id ? a : x)) : [...s.applications, a],
        })),
      deleteApplication: (id) => patch((s) => ({ applications: s.applications.filter((a) => a.id !== id) })),
      addBooking: (b) => patch((s) => ({ bookings: [...s.bookings, b] })),
      cancelBooking: (id) => patch((s) => ({ bookings: s.bookings.filter((b) => b.id !== id) })),
      addMachine: (m) => patch((s) => ({ myMachines: [...s.myMachines, m] })),
      addListing: (l) => patch((s) => ({ listings: [l, ...s.listings] })),
      removeListing: (id) => patch((s) => ({ listings: s.listings.filter((l) => l.id !== id) })),
      addInquiry: (i) => patch((s) => ({ inquiries: [...s.inquiries, i] })),
      completeOnboarding: (farmData: Partial<Farm>, parcels?: Parcel[]) => {
        patch((s) => {
          const added = parcels && parcels.length > 0 ? parcels : s.myParcels;
          const have = new Set(s.myParcels.map((p) => p.id));
          const combined = [...s.myParcels, ...added.filter((p) => !have.has(p.id))];
          return {
            onboarded: true,
            farm: { ...s.farm, ...farmData },
            myParcels: combined,
            draft: {
              ...s.draft,
              parcelIds: combined.map((p) => p.id),
            },
          };
        });
        say('Betriebsprofil & Kataster erfolgreich eingerichtet');
      },
      resetOnboarding: () => patch(() => ({ onboarded: false })),
      loadBwDemo: () => {
        const bwParcels = BW_ALKIS_PARCELS.slice(0, 3).map((p, i) => ({
          ...p,
          tenure: (i === 2 ? 'pacht' : 'eigentum') as Tenure,
        }));
        const planId = uid('plan');
        const projectId = uid('proj');
        const draft: PlanDraft = { ...defaultDraft(), parcelIds: bwParcels.map((p) => p.id), cropId: 'rohrkolben' };
        const doneTasks = Object.fromEntries(TASKS.filter((t) => ['planung', 'genehmigung', 'bau'].includes(t.phase)).map((t) => [t.id, true]));
        setState((s) => ({
          ...s,
          onboarded: true,
          farm: {
            name: 'Hofgut Federsee',
            owner: 'Johannes Maier',
            betriebsnummer: '08 426 001 0492',
            email: 'johannes.maier@hofgut-federsee.example',
            phone: '07582 938210',
            iban: 'DE14 6545 0000 0012 3456 78',
            legalForm: 'GbR',
            location: [48.053, 9.585],
            locationName: 'Bad Buchau (BW)',
            farmingType: 'konventionell',
            focus: 'milchvieh',
          },
          myParcels: bwParcels,
          draft,
          plans: [{ id: planId, name: 'Paludikultur Rohrkolben Federseemoor', createdAt: new Date().toISOString(), draft }],
          projects: [{ id: projectId, planId, name: 'Wiedervernässung Federsee Polder I', startDate: '2025-06-01', simMonth: 8, tasks: { ...doneTasks, e1: true } }],
          applications: [{
            id: uid('app'),
            programId: 'bw_moorbauern',
            programName: 'Baden-Württemberg: Moorbauernprogramm & Förderrichtlinie Moorschutz',
            parcelIds: bwParcels.map((p) => p.id),
            createdAt: '2025-06-10T08:30:00.000Z',
            submittedAt: '2025-06-15T09:00:00.000Z',
            status: 'eingereicht',
            amountRequested: 385000,
            data: { measure: 'Anstau Entwässerungsgräben & Typha-Etablierung', totalCost: 450000, startDate: '2025-10-01', note: 'Flst. 763, 3238, 3239', docs: {}, confirmed: true },
          }],
        }));
        say('Musterbetrieb „Hofgut Federsee“ (Baden-Württemberg) geladen');
      },
      loadDemo: () => {
        const parcels = findMoorParcels([53.24, 8.98], 4, 3).map((p, i) => ({ ...p, tenure: i === 3 ? ('pacht' as const) : ('eigentum' as const) }));
        const planId = uid('plan');
        const projectId = uid('proj');
        const draft: PlanDraft = { ...defaultDraft(), parcelIds: parcels.map((p) => p.id), cropId: 'rohrkolben' };
        const doneTasks = Object.fromEntries(TASKS.filter((t) => ['planung', 'genehmigung', 'bau'].includes(t.phase)).map((t) => [t.id, true]));
        setState((s) => ({
          ...s,
          farm: {
            name: 'Moorhof Eickhorst', owner: 'Anna Eickhorst', betriebsnummer: '276 0123 4567', email: 'anna@moorhof-eickhorst.example',
            phone: '04792 123456', iban: 'DE02 1203 0000 0000 2020 51', legalForm: 'Einzelunternehmen',
            location: [53.22, 8.95], locationName: 'Worpswede (NI)',
          },
          myParcels: parcels,
          draft,
          plans: [{ id: planId, name: 'Rohrkolben-Paludikultur Teufelsmoor', createdAt: new Date().toISOString(), draft }],
          projects: [{ id: projectId, planId, name: 'Rohrkolben-Paludikultur Teufelsmoor', startDate: '2025-09-01', simMonth: 13, tasks: { ...doneTasks, e1: true, e2: true } }],
          applications: [{
            id: uid('app'), programId: 'ni_invest', programName: 'Niedersachsen: Moorschutz & Klimaschutz – Wasserbau', parcelIds: parcels.map((p) => p.id),
            createdAt: '2025-09-02T09:00:00.000Z', submittedAt: '2025-09-05T09:00:00.000Z', status: 'eingereicht', amountRequested: 0,
            data: { measure: 'Wiedervernässung mit Stauen', totalCost: 0, startDate: '2026-03-01', note: '', docs: {}, confirmed: true },
          }],
        }));
        say('Demobetrieb „Moorhof Eickhorst“ geladen');
      },
      reset: () => {
        setState(initialState());
        say('Alle Daten zurückgesetzt');
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, toast, say],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}

/** Zeitgeber für simulierte Statusübergänge */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/** Simulierter Bearbeitungsstand eines eingereichten Antrags (im Prototyp beschleunigt) */
export function applicationStage(a: Application, now: number): { label: string; step: number; tone: 'grau' | 'blau' | 'gelb' | 'gruen' } {
  if (a.status === 'entwurf' || !a.submittedAt) return { label: 'Entwurf', step: 0, tone: 'grau' };
  const sec = (now - new Date(a.submittedAt).getTime()) / 1000;
  if (sec < 15) return { label: 'Eingegangen', step: 1, tone: 'blau' };
  if (sec < 40) return { label: 'In Prüfung', step: 2, tone: 'gelb' };
  return { label: 'Bewilligt', step: 3, tone: 'gruen' };
}

export function bookingStage(b: Booking, now: number): { label: string; tone: 'blau' | 'gruen' } {
  const sec = (now - new Date(b.createdAt).getTime()) / 1000;
  return sec < 8 ? { label: 'Angefragt', tone: 'blau' } : { label: 'Bestätigt', tone: 'gruen' };
}
