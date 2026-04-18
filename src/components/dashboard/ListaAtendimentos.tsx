import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { statusBadgeClass } from "@/lib/status";
import { format } from "date-fns";
import { Bot, BotOff, CheckCircle2 } from "lucide-react";

interface Atendimento {
  id: string;
  paciente_nome: string | null;
  paciente_telefone: string;
  motivo: string | null;
  status: string | null;
  created_at: string | null;
}

// Estados que indicam bot pausado (atendimento humano em andamento)
const STATUS_HUMANO = new Set(["humano", "atendente", "pausado"]);

export function ListaAtendimentos({ atendimentos }: { atendimentos: Atendimento[] }) {
  const queryClient = useQueryClient();

  const [soPausados, setSoPausados] = useState(false);

  // Busca o status_sessao dos pacientes desta lista para sabermos se o bot está ativo
  const telefones = atendimentos.map((a) => a.paciente_telefone);
  const { data: pacientesSessao = [] } = useQuery({
    queryKey: ["pacientes-sessao", telefones.sort().join(",")],
    enabled: telefones.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("telefone, status_sessao")
        .in("telefone", telefones);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sessaoPorTelefone = new Map(pacientesSessao.map((p) => [p.telefone, p.status_sessao]));

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

  // Pausa (humano) ou reativa (ia) o bot para o paciente
  const alternarBot = useMutation({
    mutationFn: async ({ telefone, novoStatus }: { telefone: string; novoStatus: "ia" | "humano" }) => {
      const { error } = await supabase
        .from("pacientes")
        .update({ status_sessao: novoStatus, ultima_interacao: new Date().toISOString() })
        .eq("telefone", telefone);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast({
        title: vars.novoStatus === "ia" ? "Bot reativado" : "Bot pausado",
        description: `Paciente ${vars.telefone}`,
      });
      queryClient.invalidateQueries({ queryKey: ["pacientes-sessao"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Aplica o filtro "só pausados" — útil pra recepção achar quem está esperando humano
  const atendimentosVisiveis = useMemo(() => {
    if (!soPausados) return atendimentos;
    return atendimentos.filter((a) =>
      STATUS_HUMANO.has((sessaoPorTelefone.get(a.paciente_telefone) ?? "").toLowerCase()),
    );
  }, [atendimentos, sessaoPorTelefone, soPausados]);

  const totalPausados = useMemo(
    () =>
      atendimentos.filter((a) =>
        STATUS_HUMANO.has((sessaoPorTelefone.get(a.paciente_telefone) ?? "").toLowerCase()),
      ).length,
    [atendimentos, sessaoPorTelefone],
  );

  return (
    <GlassCard>
      <GlassCardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex items-center gap-2">
          <GlassCardTitle>Atendimentos humanos</GlassCardTitle>
          {totalPausados > 0 && (
            <Badge variant="outline" className="border-[hsl(var(--accent-amber)/0.3)] bg-[hsl(var(--accent-amber)/0.15)] text-[hsl(var(--accent-amber))]">
              {totalPausados} bot{totalPausados !== 1 ? "s" : ""} pausado{totalPausados !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filtro-pausados" className="cursor-pointer text-xs text-muted-foreground">
            Mostrar só bots pausados
          </Label>
          <Switch
            id="filtro-pausados"
            checked={soPausados}
            onCheckedChange={setSoPausados}
            disabled={atendimentos.length === 0}
          />
        </div>
      </GlassCardHeader>
      <GlassCardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Paciente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bot</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atendimentosVisiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {soPausados
                    ? "Nenhum bot pausado no momento"
                    : "Nenhum atendimento humano no momento"}
                </TableCell>
              </TableRow>
            )}
            {atendimentosVisiveis.map((a) => {
              const sessao = sessaoPorTelefone.get(a.paciente_telefone);
              const botPausado = STATUS_HUMANO.has((sessao ?? "").toLowerCase());
              const novoStatus = botPausado ? "ia" : "humano";

              return (
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
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        botPausado
                          ? "border-[hsl(var(--accent-amber)/0.3)] bg-[hsl(var(--accent-amber)/0.15)] text-[hsl(var(--accent-amber))]"
                          : "border-[hsl(var(--accent-emerald)/0.3)] bg-[hsl(var(--accent-emerald)/0.15)] text-[hsl(var(--accent-emerald))]"
                      }
                    >
                      {botPausado ? "pausado" : "ativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          alternarBot.mutate({ telefone: a.paciente_telefone, novoStatus })
                        }
                        disabled={alternarBot.isPending}
                        title={botPausado ? "Reativar bot" : "Pausar bot"}
                      >
                        {botPausado ? (
                          <>
                            <Bot className="mr-1 h-4 w-4" />
                            Reativar bot
                          </>
                        ) : (
                          <>
                            <BotOff className="mr-1 h-4 w-4" />
                            Pausar bot
                          </>
                        )}
                      </Button>
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
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </GlassCardContent>
    </GlassCard>
  );
}
