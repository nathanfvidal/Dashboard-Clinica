import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEspecialidades, type Especialidade } from "@/hooks/useEspecialidades";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ICONES_ESPECIALIDADE, getIconeEspecialidade } from "@/lib/icones-especialidade";
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

const schema = z.object({
  nome: z.string().min(2, "Informe o nome"),
  descricao: z.string().optional(),
  icone: z.string().optional(),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function EspecialidadesTab() {
  const { data: especialidades, isLoading } = useEspecialidades();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Especialidade | null>(null);
  const [removingId, setRemovingId] = useState<Especialidade | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", descricao: "", icone: "stethoscope", ativo: true },
  });

  const abrirNovo = () => {
    setEditing(null);
    form.reset({ nome: "", descricao: "", icone: "stethoscope", ativo: true });
    setOpen(true);
  };

  const abrirEditar = (e: Especialidade) => {
    setEditing(e);
    form.reset({
      nome: e.nome,
      descricao: e.descricao ?? "",
      icone: e.icone ?? "stethoscope",
      ativo: e.ativo,
    });
    setOpen(true);
  };

  const salvar = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const { error } = await supabase
          .from("especialidades")
          .update(values)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("especialidades").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Especialidade atualizada" : "Especialidade criada" });
      queryClient.invalidateQueries({ queryKey: ["especialidades"] });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("especialidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Especialidade removida" });
      queryClient.invalidateQueries({ queryKey: ["especialidades"] });
      setRemovingId(null);
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Especialidades disponíveis para agendamento e usadas pelo bot da Sofia.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo} className="h-9">
              <Plus className="mr-2 h-4 w-4" /> Nova especialidade
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar especialidade" : "Nova especialidade"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={form.handleSubmit((v) => salvar.mutate(v))}
              className="grid gap-4"
            >
              <div className="grid gap-1.5">
                <Label htmlFor="esp-nome" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Nome
                </Label>
                <Input id="esp-nome" className="h-10 border-border/50 bg-background/40" {...form.register("nome")} />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nome.message}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="esp-icone" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Ícone
                </Label>
                <Select
                  value={form.watch("icone") || "stethoscope"}
                  onValueChange={(v) => form.setValue("icone", v)}
                >
                  <SelectTrigger id="esp-icone" className="h-10 border-border/50 bg-background/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONES_ESPECIALIDADE.map(({ value, label, Icon }) => (
                      <SelectItem key={value} value={value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="esp-desc" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Descrição
                </Label>
                <Input id="esp-desc" className="h-10 border-border/50 bg-background/40" {...form.register("descricao")} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-4 py-3">
                <Label htmlFor="esp-ativo" className="cursor-pointer">Ativa</Label>
                <Switch
                  id="esp-ativo"
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

      <div className="glass-card overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Ícone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && especialidades?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Nenhuma especialidade cadastrada.
                </TableCell>
              </TableRow>
            )}
            {especialidades?.map((e) => {
              const Icon = getIconeEspecialidade(e.icone);
              return (
              <TableRow key={e.id}>
                <TableCell>
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                </TableCell>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell className="text-muted-foreground">{e.descricao ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={e.ativo ? "default" : "secondary"}>
                    {e.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(e)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemovingId(e)}
                    aria-label="Remover especialidade"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
