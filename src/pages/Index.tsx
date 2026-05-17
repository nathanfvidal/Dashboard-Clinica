import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CalendarCheck, Users, MessageSquare, Star } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ChartAgendamentos } from "@/components/dashboard/ChartAgendamentos";
import { ChartEspecialidades } from "@/components/dashboard/ChartEspecialidades";
import { ListaAtendimentos } from "@/components/dashboard/ListaAtendimentos";
import { ListaFeedbacks } from "@/components/dashboard/ListaFeedbacks";
import { ListaProximosAgendamentos } from "@/components/dashboard/ListaProximosAgendamentos";
import { ListaPacientes } from "@/components/dashboard/ListaPacientes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_AGENDAMENTO } from "@/lib/status";
import { staggerContainer, staggerItem } from "@/components/motion/PageTransition";

const Index = () => {
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroEspecialidade, setFiltroEspecialidade] = useState<string>("todas");

  // Realtime
  useRealtimeTable("agendamentos", ["agendamentos"]);
  useRealtimeTable("atendimentos_humanos", ["atendimentos"]);
  useRealtimeTable("pacientes", ["pacientes"]);
  useRealtimeTable("feedbacks", ["feedbacks"]);

  const { data: agendamentos = [], isLoading: loadingAg } = useQuery({
    queryKey: ["agendamentos"],
    queryFn: async () => {
      // Excluímos slots "disponivel" da query — só agendamentos reais importam no dashboard.
      // Isso evita estourar o limite de linhas e perder os agendamentos confirmados.
      const { data, error } = await supabase
        .from("agendamentos")
        .select("*")
        .neq("status", "disponivel")
        .order("data_consulta", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atendimentos = [], isLoading: loadingAt } = useQuery({
    queryKey: ["atendimentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_humanos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacientes").select("id,created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: feedbacks = [], isLoading: loadingFb } = useQuery({
    queryKey: ["feedbacks"],
    queryFn: async () => {
      // Buscamos todos os feedbacks para que a média e a contagem do KPI
      // reflitam o total real (não apenas os últimos exibidos na lista).
      const { data, error } = await supabase
        .from("feedbacks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const especialidades = useMemo(
    () => Array.from(new Set(agendamentos.map((a) => a.especialidade).filter(Boolean))).sort(),
    [agendamentos],
  );

  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter((a) => {
      if (filtroStatus !== "todos" && a.status !== filtroStatus) return false;
      if (filtroEspecialidade !== "todas" && a.especialidade !== filtroEspecialidade) return false;
      return true;
    });
  }, [agendamentos, filtroStatus, filtroEspecialidade]);

  const hojeStr = format(new Date(), "yyyy-MM-dd");
  const ontemStr = format(subDays(new Date(), 1), "yyyy-MM-dd");
  const agendHoje = agendamentosFiltrados.filter((a) => a.data_consulta === hojeStr).length;
  const agendOntem = agendamentosFiltrados.filter((a) => a.data_consulta === ontemStr).length;
  const filaHumana = atendimentos.filter((a) => a.status !== "finalizado").length;
  const mediaFeedback =
    feedbacks.length > 0
      ? (feedbacks.reduce((s, f) => s + (f.nota ?? 0), 0) / feedbacks.length).toFixed(1)
      : "—";

  // Delta % hoje vs ontem (null quando ontem=0 pra evitar divisão por zero)
  const deltaHoje =
    agendOntem > 0 ? ((agendHoje - agendOntem) / agendOntem) * 100 : null;

  // Pacientes novos esta semana vs semana passada
  const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 0 });
  const fimSemana = endOfWeek(new Date(), { weekStartsOn: 0 });
  const inicioSemanaPassada = subDays(inicioSemana, 7);
  const fimSemanaPassada = subDays(fimSemana, 7);
  const novosEstaSemana = pacientes.filter((p: { created_at?: string | null }) => {
    if (!p.created_at) return false;
    return isWithinInterval(new Date(p.created_at), { start: inicioSemana, end: fimSemana });
  }).length;
  const novosSemanaPassada = pacientes.filter((p: { created_at?: string | null }) => {
    if (!p.created_at) return false;
    return isWithinInterval(new Date(p.created_at), {
      start: inicioSemanaPassada,
      end: fimSemanaPassada,
    });
  }).length;
  const deltaPacientes =
    novosSemanaPassada > 0
      ? ((novosEstaSemana - novosSemanaPassada) / novosSemanaPassada) * 100
      : null;

  const carregandoTudo = loadingAg && loadingAt && loadingFb && agendamentos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Acompanhe agendamentos, pacientes e feedbacks em tempo real.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_AGENDAMENTO.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Especialidade</Label>
            <Select value={filtroEspecialidade} onValueChange={setFiltroEspecialidade}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as especialidades</SelectItem>
                {especialidades.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {carregandoTudo ? (
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[112px] rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={staggerItem} className="h-full">
            <KpiCard
              label="Agendamentos hoje"
              value={agendHoje}
              icon={CalendarCheck}
              accent="primary"
              delta={deltaHoje}
              deltaLabel="vs ontem"
              hint={deltaHoje === null ? "Sem base ontem" : `vs ontem (${agendOntem})`}
            />
          </motion.div>
          <motion.div variants={staggerItem} className="h-full">
            <KpiCard
              label="Pacientes cadastrados"
              value={pacientes.length}
              icon={Users}
              accent="cyan"
              delta={deltaPacientes}
              deltaLabel="novos vs semana passada"
              hint={`${novosEstaSemana} nesta semana`}
            />
          </motion.div>
          <motion.div variants={staggerItem} className="h-full">
            <KpiCard
              label="Fila humana"
              value={filaHumana}
              icon={MessageSquare}
              accent="amber"
              hint={filaHumana === 0 ? "Tudo limpo" : "aguardando atendente"}
            />
          </motion.div>
          <motion.div variants={staggerItem} className="h-full">
            <KpiCard
              label="Feedback médio"
              value={mediaFeedback}
              icon={Star}
              accent="emerald"
              hint={`${feedbacks.length} avaliações`}
            />
          </motion.div>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loadingAg && agendamentos.length === 0 ? (
            <Skeleton className="h-[336px] w-full rounded-xl" />
          ) : (
            <ChartAgendamentos agendamentos={agendamentosFiltrados} />
          )}
        </div>
        {loadingAg && agendamentos.length === 0 ? (
          <Skeleton className="h-[336px] w-full rounded-xl" />
        ) : (
          <ChartEspecialidades agendamentos={agendamentosFiltrados} />
        )}
      </div>

      {loadingAg && agendamentos.length === 0 ? (
        <Skeleton className="h-[300px] w-full rounded-xl" />
      ) : (
        <ListaProximosAgendamentos agendamentos={agendamentosFiltrados} />
      )}

      <ListaPacientes />

      {loadingAt && atendimentos.length === 0 ? (
        <Skeleton className="h-[260px] w-full rounded-xl" />
      ) : (
        <ListaAtendimentos atendimentos={atendimentos} />
      )}
      {loadingFb && feedbacks.length === 0 ? (
        <Skeleton className="h-[200px] w-full rounded-xl" />
      ) : (
        <ListaFeedbacks feedbacks={feedbacks} />
      )}
    </div>
  );
};

export default Index;
