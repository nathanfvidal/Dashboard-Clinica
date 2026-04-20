import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GlassCard } from "@/components/ui/glass-card";
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

interface Paciente {
  id: string;
  nome: string | null;
  telefone: string;
  created_at: string | null;
}

const schema = z.object({
  nome: z.string().min(2, "Você precisa informar pelo menos o primeiro nome."),
  telefone: z.string()
    .regex(/^\d{12,13}$/, "Formato inválido. Use exatamente: DDI (2) + DDD (2) + Número (8 ou 9). Ex: 5511999999999"),
});

type FormValues = z.infer<typeof schema>;

export function ClientesTab() {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Paciente | null>(null);
  const [removingId, setRemovingId] = useState<Paciente | null>(null);
  const queryClient = useQueryClient();

  const { data: pacientes, isLoading } = useQuery({
    queryKey: ["pacientes_crud"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pacientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Paciente[];
    },
  });

  const pacientesFiltrados = useMemo(() => {
    if (!pacientes) return [];
    if (!busca.trim()) return pacientes;
    
    const termo = busca.toLowerCase();
    return pacientes.filter((p) => {
      const nomeMatch = p.nome?.toLowerCase().includes(termo);
      const telMatch = p.telefone.includes(termo);
      return nomeMatch || telMatch;
    });
  }, [pacientes, busca]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: "", telefone: "" },
  });

  const abrirNovo = () => {
    setEditing(null);
    form.reset({ nome: "", telefone: "" });
    setOpen(true);
  };

  const abrirEditar = (p: Paciente) => {
    setEditing(p);
    form.reset({
      nome: p.nome ?? "",
      telefone: p.telefone,
    });
    setOpen(true);
  };

  const salvar = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const { error } = await supabase
          .from("pacientes")
          .update(values)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pacientes").insert([values]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Cliente atualizado" : "Cliente criado" });
      queryClient.invalidateQueries({ queryKey: ["pacientes_crud"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pacientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente removido" });
      queryClient.invalidateQueries({ queryKey: ["pacientes_crud"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      setRemovingId(null);
    },
    onError: (e: Error) => {
      toast({ 
        title: "Erro ao remover", 
        description: "Não foi possível remover. O cliente deve ter registros atrelados.", 
        variant: "destructive" 
      });
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground w-full sm:w-1/2">
          Gerencie os pacientes (clientes) da clínica. Eles interagem com o bot via telefone.
        </p>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar paciente..."
              className="pl-8 h-9 w-full sm:w-[250px]"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={abrirNovo} className="h-9 w-full sm:w-auto shrink-0">
                <Plus className="mr-2 h-4 w-4" /> Novo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editing ? "Editar cliente" : "Novo cliente"}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((v) => salvar.mutate(v))}
                className="grid gap-4"
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="cli-nome" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Nome
                  </Label>
                  <Input id="cli-nome" className="h-10 border-border/50 bg-background/40" {...form.register("nome")} />
                  {form.formState.errors.nome && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.nome.message}
                    </p>
                  )}
                </div>
                
                <div className="grid gap-1.5">
                  <Label htmlFor="cli-tel" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Telefone (DDI+DDD+Numero)
                  </Label>
                  <Input 
                    id="cli-tel" 
                    placeholder="Ex: 5511999999999" 
                    className="h-10 border-border/50 bg-background/40" 
                    {...form.register("telefone")} 
                  />
                  {form.formState.errors.telefone && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.telefone.message}
                    </p>
                  )}
                </div>
                
                <DialogFooter className="mt-2">
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
      </div>

      <GlassCard spotlight className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Data de Cadastro</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pacientesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  {busca ? "Nenhum cliente encontrado na busca." : "Nenhum cliente cadastrado."}
                </TableCell>
              </TableRow>
            )}
            {pacientesFiltrados.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {p.nome || <span className="text-muted-foreground italic">Não informado</span>}
                </TableCell>
                <TableCell className="font-mono text-sm">{p.telefone}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => abrirEditar(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setRemovingId(p)}
                    aria-label="Remover cliente"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      <ConfirmDialog
        open={!!removingId}
        onOpenChange={(o) => !o && setRemovingId(null)}
        title="Remover cliente"
        description={
          removingId && (
            <>
              Tem certeza que deseja remover o cliente{" "}
              <span className="font-semibold text-foreground">{removingId.nome || removingId.telefone}</span>?
              <br/><br/>
              Aviso: se este cliente possuir agendamentos ou interações associadas, a deleção poderá falhar ou remover dados em cascata dependendo da configuração do banco de dados.
            </>
          )
        }
        confirmLabel="Remover"
        pendingLabel="Removendo..."
        pending={remover.isPending}
        onConfirm={() => removingId && remover.mutate(removingId.id)}
      />
    </div>
  );
}
