import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STATUS_AGENDAMENTO } from "@/lib/status";

const schema = z.object({
  especialidade: z.string().min(2, "Informe a especialidade"),
  medico: z.string().min(2, "Informe o médico"),
  data_consulta: z.string().min(1, "Informe a data"),
  horario: z.string().min(1, "Informe o horário"),
  paciente_telefone: z.string().min(8, "Telefone inválido"),
  paciente_nome: z.string().optional(),
  status: z.string().min(1),
});

export type AgendamentoFormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<AgendamentoFormValues> & { id?: string };
  onDone: () => void;
}

export function AgendamentoForm({ initial, onDone }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AgendamentoFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      especialidade: initial?.especialidade ?? "",
      medico: initial?.medico ?? "",
      data_consulta: initial?.data_consulta ?? "",
      horario: initial?.horario?.slice(0, 5) ?? "",
      paciente_telefone: initial?.paciente_telefone ?? "",
      paciente_nome: initial?.paciente_nome ?? "",
      status: initial?.status ?? "confirmado",
    },
  });

  useEffect(() => {
    reset({
      especialidade: initial?.especialidade ?? "",
      medico: initial?.medico ?? "",
      data_consulta: initial?.data_consulta ?? "",
      horario: initial?.horario?.slice(0, 5) ?? "",
      paciente_telefone: initial?.paciente_telefone ?? "",
      paciente_nome: initial?.paciente_nome ?? "",
      status: initial?.status ?? "confirmado",
    });
  }, [initial, reset]);

  const status = watch("status");

  const mutation = useMutation({
    mutationFn: async (values: AgendamentoFormValues) => {
      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from("agendamentos")
          .update(values)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agendamentos").insert(values);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Agendamento atualizado" : "Agendamento criado" });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      onDone();
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="especialidade">Especialidade</Label>
          <Input id="especialidade" {...register("especialidade")} />
          {errors.especialidade && <p className="text-xs text-destructive">{errors.especialidade.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="medico">Médico</Label>
          <Input id="medico" {...register("medico")} />
          {errors.medico && <p className="text-xs text-destructive">{errors.medico.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="data_consulta">Data</Label>
          <Input id="data_consulta" type="date" {...register("data_consulta")} />
          {errors.data_consulta && <p className="text-xs text-destructive">{errors.data_consulta.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="horario">Horário</Label>
          <Input id="horario" type="time" {...register("horario")} />
          {errors.horario && <p className="text-xs text-destructive">{errors.horario.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paciente_telefone">Telefone do paciente</Label>
          <Input id="paciente_telefone" placeholder="55119..." {...register("paciente_telefone")} />
          {errors.paciente_telefone && (
            <p className="text-xs text-destructive">{errors.paciente_telefone.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="paciente_nome">Nome do paciente</Label>
          <Input id="paciente_nome" {...register("paciente_nome")} />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setValue("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_AGENDAMENTO.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : isEdit ? "Atualizar" : "Criar agendamento"}
        </Button>
      </div>
    </form>
  );
}
