import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { statusBadgeClass } from "@/lib/status";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";

interface Atendimento {
  id: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  motivo: string | null;
  status: string | null;
  created_at: string | null;
}

export function ListaAtendimentos({ atendimentos }: { atendimentos: Atendimento[] }) {
  const queryClient = useQueryClient();

  const finalizar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("atendimentos_humanos")
        .update({ status: "finalizado", finalizado_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Atendimento finalizado" });
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atendimentos humanos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atendimentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum atendimento humano no momento
                </TableCell>
              </TableRow>
            )}
            {atendimentos.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.paciente_nome ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{a.paciente_telefone}</TableCell>
                <TableCell className="max-w-[260px] truncate">{a.motivo ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.created_at ? format(new Date(a.created_at), "dd/MM HH:mm") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClass(a.status)}>
                    {a.status ?? "—"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {a.status !== "finalizado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => finalizar.mutate(a.id)}
                      disabled={finalizar.isPending}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Finalizar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
