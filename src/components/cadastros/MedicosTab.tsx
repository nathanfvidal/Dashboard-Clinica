import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { getIconeEspecialidade } from "@/lib/icones-especialidade";
import { supabase } from "@/integrations/supabase/client";
import { useMedicos, type Medico } from "@/hooks/useMedicos";
import { useEspecialidades } from "@/hooks/useEspecialidades";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassCard } from "@/components/ui/glass-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HorariosMedicoDialog } from "./HorariosMedicoDialog";
import { GerarAgendaButton } from "./GerarAgendaButton";

const schema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  especialidade_id: z.string().min(1, "Selecione a especialidade"),
  crm: z.string().optional(),
  telefone: z.string().optional(),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function MedicosTab() {
  const { data: medicos, isLoading } = useMedicos();
  const { data: especialidades } = useEspecialidades();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medico | null>(null);
  const [horariosMedico, setHorariosMedico] = useState<Medico | null>(null);
  const [removendo, setRemovendo] = useState<Medico | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", especialidade_id: "", crm: "", telefone: "", ativo: true },
  });

  const abrirNovo = () => {
    setEditing(null);
    form.reset({ nome: "", especialidade_id: "", crm: "", telefone: "", ativo: true });
    setOpen(true);
  };

  const abrirEditar = (m: Medico) => {
    setEditing(m);
    form.reset({
      nome: m.nome,
      especialidade_id: m.especialidade_id ?? "",
      crm: m.crm ?? "",
      telefone: m.telefone ?? "",
      ativo: m.ativo,
    });
    setOpen(true);
  };

  const salvar = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const { error } = await supabase.from("medicos").update(values).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("medicos").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Médico atualizado" : "Médico criado" });
      queryClient.invalidateQueries({ queryKey: ["medicos"] });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("medicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Médico removido" });
      queryClient.invalidateQueries({ queryKey: ["medicos"] });
      setRemovendo(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Profissionais que atendem na clínica. Cada médico pertence a uma especialidade.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo} className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Novo médico
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar médico" : "Novo médico"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((v) => salvar.mutate(v))}
              className="grid gap-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="med-nome" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome
                </Label>
                <Input id="med-nome" className="h-10 border-border/50 bg-background/40" {...form.register("nome")} />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nome.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Especialidade
                </Label>
                <Select
                  value={form.watch("especialidade_id")}
                  onValueChange={(v) => form.setValue("especialidade_id", v)}
                >
                  <SelectTrigger className="h-10 border-border/50 bg-background/40">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidades?.map((e) => {
                      const IconeEsp = getIconeEspecialidade(e.icone);
                      return (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="inline-flex items-center gap-2">
                            <IconeEsp className="h-3.5 w-3.5" />
                            {e.nome}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {form.formState.errors.especialidade_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.especialidade_id.message}
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="med-crm" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    CRM
                  </Label>
                  <Input id="med-crm" className="h-10 border-border/50 bg-background/40" {...form.register("crm")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="med-tel" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Telefone
                  </Label>
                  <Input id="med-tel" className="h-10 border-border/50 bg-background/40" {...form.register("telefone")} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-4 py-3">
                <Label htmlFor="med-ativo" className="cursor-pointer">Ativo</Label>
                <Switch
                  id="med-ativo"
                  checked={form.watch("ativo")}
                  onCheckedChange={(v) => form.setValue("ativo", v)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" className="h-10" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="h-10 px-6" disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <GlassCard spotlight className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-[260px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && medicos?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum médico cadastrado.
                </TableCell>
              </TableRow>
            )}
            {medicos?.map((m) => {
              const IconeEsp = getIconeEspecialidade(m.especialidades?.icone);
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>
                    {m.especialidades ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <IconeEsp className="h-3.5 w-3.5" />
                        </span>
                        <span>{m.especialidades.nome}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.crm ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.telefone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={m.ativo ? "default" : "secondary"}>
                      {m.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => setHorariosMedico(m)}
                      >
                        <Clock className="mr-1 h-3.5 w-3.5" /> Horários
                      </Button>
                      <Separator orientation="vertical" className="mx-1 h-5 bg-border/40" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => abrirEditar(m)}
                        aria-label="Editar médico"
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRemovendo(m)}
                        aria-label="Remover médico"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Mais ações"
                            title="Mais ações"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="border-border/40 bg-popover/85 backdrop-blur-2xl"
                        >
                          <GerarAgendaButton
                            medicoId={m.id}
                            medicoNome={m.nome}
                            asMenuItem
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <HorariosMedicoDialog
        medico={horariosMedico}
        open={!!horariosMedico}
        onOpenChange={(v) => !v && setHorariosMedico(null)}
      />

      <ConfirmDialog
        open={!!removendo}
        onOpenChange={(o) => !o && setRemovendo(null)}
        title="Remover médico"
        description={
          removendo && (
            <>
              Tem certeza que deseja remover{" "}
              <span className="font-semibold text-foreground">{removendo.nome}</span>?
              Esta ação não pode ser desfeita e pode afetar agendamentos vinculados.
            </>
          )
        }
        confirmLabel="Remover"
        pendingLabel="Removendo..."
        pending={remover.isPending}
        onConfirm={() => removendo && remover.mutate(removendo.id)}
      />
    </div>
  );
}
