import { useMemo } from "react";

interface LinhaHorario {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
  duracao_consulta_min?: number;
}

interface Props {
  linhas: LinhaHorario[];
}

const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

// Converte "HH:MM" em minutos
const toMin = (hhmm?: string) => {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

// Formata minutos como "HH:MM"
const fromMin = (min: number) => {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

// Gera a lista de slots (horários) para uma linha
function gerarSlots(linha: LinhaHorario): string[] {
  const ini = toMin(linha.hora_inicio);
  const fim = toMin(linha.hora_fim);
  const dur = Number(linha.duracao_consulta_min) || 30;
  if (fim <= ini || dur <= 0) return [];
  const slots: string[] = [];
  for (let t = ini; t + dur <= fim; t += dur) {
    slots.push(fromMin(t));
  }
  return slots;
}

export function PreviewSemana({ linhas }: Props) {
  // Agrupa slots por dia da semana
  const slotsPorDia = useMemo(() => {
    const mapa = new Map<number, string[]>();
    for (let i = 0; i < 7; i++) mapa.set(i, []);
    for (const linha of linhas) {
      const dia = Number(linha.dia_semana ?? -1);
      if (dia < 0 || dia > 6) continue;
      const novos = gerarSlots(linha);
      const atuais = mapa.get(dia) ?? [];
      // Mescla evitando duplicados, mantendo ordem
      const set = new Set([...atuais, ...novos]);
      mapa.set(dia, Array.from(set).sort());
    }
    return mapa;
  }, [linhas]);

  const totalSlots = useMemo(
    () => Array.from(slotsPorDia.values()).reduce((s, arr) => s + arr.length, 0),
    [slotsPorDia],
  );

  return (
    <div className="rounded-lg border border-border/60 bg-gradient-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Prévia da semana
          </p>
          <p className="text-xs text-muted-foreground/70">
            Slots gerados a cada intervalo configurado
          </p>
        </div>
        <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
          {totalSlots} {totalSlots === 1 ? "slot" : "slots"} / semana
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DIAS_CURTOS.map((nome, i) => {
          const slots = slotsPorDia.get(i) ?? [];
          const vazio = slots.length === 0;
          return (
            <div
              key={i}
              className={
                "flex flex-col rounded-md border p-2 transition-colors " +
                (vazio
                  ? "border-dashed border-border/50 bg-muted/30"
                  : "border-border/70 bg-card/50")
              }
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={
                    "text-[10px] font-semibold tracking-wider " +
                    (vazio ? "text-muted-foreground/60" : "text-primary")
                  }
                >
                  {nome}
                </span>
                {!vazio && (
                  <span className="text-[10px] text-muted-foreground">{slots.length}</span>
                )}
              </div>
              {vazio ? (
                <span className="text-center text-[10px] text-muted-foreground/50">—</span>
              ) : (
                <div className="flex max-h-40 flex-col gap-1 overflow-auto pr-0.5">
                  {slots.map((s) => (
                    <span
                      key={s}
                      className="rounded bg-primary/10 px-1.5 py-0.5 text-center text-[10px] font-medium tabular-nums text-primary ring-1 ring-inset ring-primary/15"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
