import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Feedback {
  id: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  nota: number;
  comentario: string | null;
  created_at: string;
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-4 w-4",
            n <= nota ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export function ListaFeedbacks({ feedbacks }: { feedbacks: Feedback[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Últimos feedbacks</CardTitle>
      </CardHeader>
      <CardContent>
        {feedbacks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum feedback registrado ainda
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {feedbacks.map((f) => (
              <li key={f.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{f.paciente_nome ?? f.paciente_telefone}</p>
                    <Estrelas nota={f.nota} />
                  </div>
                  {f.comentario && (
                    <p className="mt-1 text-sm text-muted-foreground">{f.comentario}</p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(f.created_at), "dd/MM HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
