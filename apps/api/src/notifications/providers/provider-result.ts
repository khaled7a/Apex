// Not a discriminated union: this project's tsconfig runs with
// strictNullChecks:false, under which TS does not narrow a union on a
// boolean-literal tag (`if (result.sent)` would still see the whole union in
// the else branch) — a flat optional-fields shape sidesteps that entirely.
export interface ProviderResult {
  sent: boolean;
  reason?: 'NO_CONFIG' | 'ERROR';
  error?: string;
}
