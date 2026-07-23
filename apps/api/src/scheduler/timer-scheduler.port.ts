export const TIMER_SCHEDULER = Symbol('TIMER_SCHEDULER');

/** What TransitionEngineService needs from a scheduler — kept as a narrow port so pg-boss is swappable later. */
export interface TimerSchedulerPort {
  enqueue(orderId: string, timerType: string, runAt: Date): Promise<void>;
  /** Best-effort only — the DB row's cancelled_at is the real source of truth; the worker re-checks it defensively before acting. */
  cancel(orderId: string, timerType: string): Promise<void>;
}
