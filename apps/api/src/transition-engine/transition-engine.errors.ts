export class StaleStateError extends Error {
  constructor(
    public readonly actualState: string,
    public readonly actualVersion: number,
  ) {
    super(`optimistic lock mismatch: order is actually at ${actualState} (version ${actualVersion})`);
  }
}

export class TransitionRejectedError extends Error {
  constructor(
    public readonly reason: string,
    public readonly detail?: string,
  ) {
    super(`transition rejected (${reason}): ${detail ?? ''}`);
  }
}
