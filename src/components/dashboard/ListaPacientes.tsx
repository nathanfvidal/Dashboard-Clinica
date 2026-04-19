import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Search, Trash2, UserRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassCard } from "@/components/ui/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Tipo do paciente conforme schema da tabela `pacientes`
type Paciente = {
  id: string;
  telefone: string;
  nome: string | null;
  status_sessao: string | null;
  created_at: string | null;
  ultima_interacao: string | null;
};

// Validação: nome opcional, telefone obrigatório (apenas dígitos, 8-15)
const schema = z.object({
  nome: z.string().trim().max(120).optional().or(z.literal("")),
  telefone: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, "Telefone deve ter apenas dígitos (8 a 15)"),
});

type FormValues = z.infer<typeof schema>;

// Formata telefone BR (E.164 sem +) para exibição: 55 11 99999-9999
function formatarTelefone(tel: string): string {
  const t = tel.replace(/\D/g, "");
  if (t.length === 13 && t.startsWith("55")) {
    return `+55 (${t.slice(2, 4)}) ${t.slice(4, 9)}-${t.slice(9)}`;
  }
  if (t.length === 12 && t.startsWith("55")) {
    return `+55 (${t.slice(2, 4)}) ${t.slice(4, 8)}-${t.slice(8)}`;
  }
  return tel;
}

export function ListaPacientes() {
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Paciente | null>(null);
  const [removendo, setRemovendo] = useState<Paciente | null>(null);
  const queryClient = useQueryClient();

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ["pacientes-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("id, telefone, nome, status_sessao, created_at, ultima_interacao")
        .order("ultima_interacao", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Paciente[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", telefone: "" },
  });

  const abrirEditar = (p: Paciente) => {
    setEditando(p);
    form.reset({ nome: p.nome ?? "", telefone: p.telefone });
  };

  const fecharEditar = () => {
    setEditando(null);
    form.reset({ nome: "", telefone: "" });
  };

  const salvar = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!editando) return;
      const { error } = await supabase
        .from("pacientes")
        .update({
          nome: values.nome?.trim() ? values.nome.trim() : null,
          telefone: values.telefone,
        })
        .eq("id", editando.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Paciente atualizado" });
      queryClient.invalidateQueries({ queryKey: ["pacientes-lista"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      fecharEditar();
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pacientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Paciente removido" });
      queryClient.invalidateQueries({ queryKey: ["pacientes-lista"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setRemovendo(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  // Filtragem em memória (dataset pequeno, evita roundtrip ao banco)
  const filtrados = useMemo(() => {
    if (!pacientes) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return pacientes;
    return pacientes.filter(
      (p) =>
        (p.nome ?? "").toLowerCase().includes(q) ||
        p.telefone.toLowerCase().includes(q),
    );
  }, [pacientes, busca]);

  return (
    <GlassCard spotlight className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-border/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight">Pacientes cadastrados</h3>
            <p className="text-xs text-muted-foreground">
              {pacientes?.length ?? 0} no total · edite ou remova diretamente
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
      </div>

      <div className="max-h-[480px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/80 backdrop-blur">
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-32">Sessão</TableHead>
              <TableHead className="w-40">Última interação</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
            {!isLoading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {busca ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado ainda."}
                </TableCell>
              </TableRow>
            )}
            {filtrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.nome ?? <span className="text-muted-foreground">Sem nome</span>}
                </TableCell>
                <TableCell className="font-mono text-xs">{formatarTelefone(p.telefone)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {p.status_sessao ?? "menu"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {p.ultima_interacao
                    ? formatDistanceToNow(new Date(p.ultima_interacao), {
                        locale: ptBR,
                        addSuffix: true,
                      })
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => abrirEditar(p)}
                    aria-label="Editar paciente"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemovendo(p)}
                    aria-label="Remover paciente"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de edição */}
      <Dialog open={!!editando} onOpenChange={(o) => !o && fecharEditar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar paciente</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((v) => salvar.mutate(v))}
            className="grid gap-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="pac-nome" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nome
              </Label>
              <Input
                id="pac-nome"
                placeholder="Nome do paciente"
                className="h-10 border-border/50 bg-background/40"
                {...form.register("nome")}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pac-tel" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Telefone (somente dígitos, com DDI+DDD)
              </Label>
              <Input
                id="pac-tel"
                placeholder="5511999999999"
                inputMode="numeric"
                className="h-10 border-border/50 bg-background/40 font-mono"
                {...form.register("telefone")}
              />
              {form.formState.errors.telefone && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.telefone.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Atenção: alterar o telefone pode desvincular conversas e agendamentos antigos.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" className="h-10" onClick={fecharEditar}>
                Cancelar
              </Button>
              <Button type="submit" className="h-10 px-6" disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(o) => !o && setRemovendo(null)}
        title="Remover paciente"
        description={
          removendo && (
            <>
              Tem certeza que deseja remover{" "}
              <span className="font-semibold text-foreground">
                {removendo.nome ?? formatarTelefone(removendo.telefone)}
              </span>
              ? Esta ação é permanente e não pode ser desfeita.
            </>
          )
        }
        confirmLabel="Remover"
        pendingLabel="Removendo..."
        pending={remover.isPending}
        onConfirm={() => removendo && remover.mutate(removendo.id)}
      />
    </GlassCard>
  );
}
