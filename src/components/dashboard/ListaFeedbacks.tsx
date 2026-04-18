import { Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";

interface Feedback {
  id: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  nota: number;
  comentario: string | null;
  created_at: string;
}

// Cor do avatar derivada da nota — verde alto, âmbar médio, rosa baixo
function corPorNota(nota: number) {
  if (nota >= 4) return "bg-[hsl(var(--accent-emerald)/0.18)] text-[hsl(var(--accent-emerald))] ring-[hsl(var(--accent-emerald)/0.3)]";
  if (nota >= 3) return "bg-[hsl(var(--accent-amber)/0.18)] text-[hsl(var(--accent-amber))] ring-[hsl(var(--accent-amber)/0.3)]";
  return "bg-[hsl(var(--accent-rose)/0.18)] text-[hsl(var(--accent-rose))] ring-[hsl(var(--accent-rose)/0.3)]";
}

function inicial(nome: string | null, telefone: string) {
  const fonte = (nome ?? telefone).trim();
  return fonte.charAt(0).toUpperCase() || "?";
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-4 w-4",
            n <= nota
              ? "fill-[hsl(var(--accent-amber))] text-[hsl(var(--accent-amber))]"
              : "text-muted-foreground/25",
          )}
        />
      ))}
    </div>
  );
}

export function ListaFeedbacks({ feedbacks }: { feedbacks: Feedback[] }) {
  return (
    <GlassCard spotlight>
      <GlassCardHeader>
        <GlassCardTitle>Últimos feedbacks</GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        {feedbacks.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum feedback registrado ainda
          </p>
        ) : (
          <div className="space-y-2">
            {feedbacks.map((f) => (
              <div
                key={f.id}
                className="glass-subtle glass-hover flex items-start gap-3 p-4"
              >
                {/* Avatar circular com inicial */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1",
                    corPorNota(f.nota),
                  )}
                >
                  {inicial(f.paciente_nome, f.paciente_telefone)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold tracking-tight">
                        {f.paciente_nome ?? f.paciente_telefone}
                      </p>
                      <div className="mt-1">
                        <Estrelas nota={f.nota} />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {format(new Date(f.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>

                  {f.comentario && (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      &ldquo;{f.comentario}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
