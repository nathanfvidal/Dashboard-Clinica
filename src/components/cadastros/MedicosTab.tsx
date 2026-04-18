import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMedicos, type Medico } from "@/hooks/useMedicos";
import { useEspecialidades } from "@/hooks/useEspecialidades";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  ativo: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

export function MedicosTab() {
  const { data: medicos, isLoading } = useMedicos();
  const { data: especialidades } = useEspecialidades();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Medico | null>(null);
  const [horariosMedico, setHorariosMedico] = useState<Medico | null>(null);

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
            <Button onClick={abrirNovo} size="sm">
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
                <Label htmlFor="med-nome">Nome</Label>
                <Input id="med-nome" {...form.register("nome")} />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nome.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label>Especialidade</Label>
                <Select
                  value={form.watch("especialidade_id")}
                  onValueChange={(v) => form.setValue("especialidade_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {especialidades?.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.icone} {e.nome}
                      </SelectItem>
                    ))}
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
                  <Label htmlFor="med-crm">CRM</Label>
                  <Input id="med-crm" {...form.register("crm")} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="med-tel">Telefone</Label>
                  <Input id="med-tel" {...form.register("telefone")} />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <Label htmlFor="med-ativo">Ativo</Label>
                <Switch
                  id="med-ativo"
                  checked={form.watch("ativo")}
                  onCheckedChange={(v) => form.setValue("ativo", v)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvar.isPending}>
                  {salvar.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-72 text-right">Ações</TableHead>
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
            {medicos?.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nome}</TableCell>
                <TableCell>
                  {m.especialidades ? (
                    <span>
                      {m.especialidades.icone} {m.especialidades.nome}
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
                <TableCell className="space-x-1 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHorariosMedico(m)}
                  >
                    <Clock className="mr-2 h-4 w-4" /> Horários
                  </Button>
                  <GerarAgendaButton medicoId={m.id} medicoNome={m.nome} />
                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`Remover ${m.nome}?`)) remover.mutate(m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <HorariosMedicoDialog
        medico={horariosMedico}
        open={!!horariosMedico}
        onOpenChange={(v) => !v && setHorariosMedico(null)}
      />
    </div>
  );
}
