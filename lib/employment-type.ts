const LABELS: Record<string, string> = {
  "full-time": "Tiempo completo",
  "part-time": "Tiempo parcial",
  "services-agreement": "Contrato de servicios",
  "one-off": "Trabajo puntual",
  consulting: "Consultoría",
};

/** Texto en español para el tipo de vacante ("one-off" → "Trabajo puntual"). */
export function employmentTypeLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return LABELS[v] ?? v;
}
