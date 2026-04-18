import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useEspecialidades } from "@/hooks/useEspecialidades";
import { useMedicos } from "@/hooks/useMedicos";
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
import { getIconeEspecialidade } from "@/lib/icones-especialidade";

const schema = z.object({
  especialidade_id: z.string().min(1, "Selecione a especialidade"),
  medico_id: z.string().min(1, "Selecione o médico"),
  data_consulta: z.string().min(1, "Informe a data"),
  horario: z.string().min(1, "Informe o horário"),
  paciente_telefone: z.string().min(8, "Telefone inválido"),
  paciente_nome: z.string().optional(),
  status: z.string().min(1),
});

export type AgendamentoFormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<AgendamentoFormValues> & {
    id?: string;
    especialidade?: string;
    medico?: string;
  };
  onDone: () => void;
}

export function AgendamentoForm({ initial, onDone }: Props) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(initial?.id);
  const { data: especialidades } = useEspecialidades(true);

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
      especialidade_id: initial?.especialidade_id ?? "",
      medico_id: initial?.medico_id ?? "",
      data_consulta: initial?.data_consulta ?? "",
      horario: initial?.horario?.slice(0, 5) ?? "",
      paciente_telefone: initial?.paciente_telefone ?? "",
      paciente_nome: initial?.paciente_nome ?? "",
      status: initial?.status ?? "confirmado",
    },
  });

  const especialidadeId = watch("especialidade_id");
  const medicoId = watch("medico_id");
  const status = watch("status");

  const { data: medicos } = useMedicos({
    apenasAtivos: true,
    especialidadeId: especialidadeId || undefined,
  });

  useEffect(() => {
    reset({
      especialidade_id: initial?.especialidade_id ?? "",
      medico_id: initial?.medico_id ?? "",
      data_consulta: initial?.data_consulta ?? "",
      horario: initial?.horario?.slice(0, 5) ?? "",
      paciente_telefone: initial?.paciente_telefone ?? "",
      paciente_nome: initial?.paciente_nome ?? "",
      status: initial?.status ?? "confirmado",
    });
  }, [initial, reset]);

  const mutation = useMutation({
    mutationFn: async (values: AgendamentoFormValues) => {
      const especialidade = especialidades?.find((e) => e.id === values.especialidade_id);
      const medico = medicos?.find((m) => m.id === values.medico_id);

      const payload = {
        especialidade_id: values.especialidade_id,
        medico_id: values.medico_id,
        especialidade: especialidade?.nome ?? "",
        medico: medico?.nome ?? "",
        data_consulta: values.data_consulta,
        horario: values.horario,
        paciente_telefone: values.paciente_telefone,
        paciente_nome: values.paciente_nome,
        status: values.status,
      };

      if (isEdit && initial?.id) {
        const { error } = await supabase
          .from("agendamentos")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("agendamentos").insert(payload);
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
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Especialidade
          </Label>
          <Select
            value={especialidadeId}
            onValueChange={(v) => {
              setValue("especialidade_id", v);
              setValue("medico_id", "");
            }}
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
          {errors.especialidade_id && (
            <p className="text-xs text-destructive">{errors.especialidade_id.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Médico
          </Label>
          <Select
            value={medicoId}
            onValueChange={(v) => setValue("medico_id", v)}
            disabled={!especialidadeId}
          >
            <SelectTrigger className="h-10 border-border/50 bg-background/40">
              <SelectValue
                placeholder={especialidadeId ? "Selecione..." : "Escolha a especialidade"}
              />
            </SelectTrigger>
            <SelectContent>
              {medicos?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.medico_id && (
            <p className="text-xs text-destructive">{errors.medico_id.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label
            htmlFor="data_consulta"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Data
          </Label>
          <Input
            id="data_consulta"
            type="date"
            className="h-10 border-border/50 bg-background/40 tabular-nums"
            {...register("data_consulta")}
          />
          {errors.data_consulta && (
            <p className="text-xs text-destructive">{errors.data_consulta.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label
            htmlFor="horario"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Horário
          </Label>
          <Input
            id="horario"
            type="time"
            className="h-10 border-border/50 bg-background/40 tabular-nums"
            {...register("horario")}
          />
          {errors.horario && <p className="text-xs text-destructive">{errors.horario.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label
            htmlFor="paciente_telefone"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Telefone do paciente
          </Label>
          <Input
            id="paciente_telefone"
            placeholder="55119..."
            className="h-10 border-border/50 bg-background/40 tabular-nums"
            {...register("paciente_telefone")}
          />
          {errors.paciente_telefone && (
            <p className="text-xs text-destructive">{errors.paciente_telefone.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label
            htmlFor="paciente_nome"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Nome do paciente
          </Label>
          <Input
            id="paciente_nome"
            className="h-10 border-border/50 bg-background/40"
            {...register("paciente_nome")}
          />
        </div>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Status
          </Label>
          <Select value={status} onValueChange={(v) => setValue("status", v)}>
            <SelectTrigger className="h-10 border-border/50 bg-background/40">
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
      <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
        <Button type="button" variant="ghost" className="h-10" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="h-10 px-6" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : isEdit ? "Atualizar" : "Criar agendamento"}
        </Button>
      </div>
    </form>
  );
}
