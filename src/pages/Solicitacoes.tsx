import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  ClipboardList,
  Loader2,
  Phone,
  PlayCircle,
  RotateCcw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Tipos locais
type Solicitacao = {
  id: string;
  paciente_telefone: string;
  paciente_nome: string | null;
  tipo: string;
  motivo: string | null;
  status: string | null;
  created_at: string | null;
};

type StatusFiltro = "pendente" | "em_andamento" | "concluido" | "todos";

// Tipos conhecidos da tool criar_solicitacao do n8n
const TIPOS_CONHECIDOS = [
  "retorno_ligacao",
  "exame",
  "receita",
  "atestado",
  "outro",
] as const;

// Formata telefone E.164 para visual
function formatTelefone(tel: string) {
  const t = tel.replace(/\D/g, "");
  if (t.length === 13) return `+${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4, 9)}-${t.slice(9)}`;
  if (t.length === 12) return `+${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4, 8)}-${t.slice(8)}`;
  return tel;
}

// Rótulo amigável dos tipos
function labelTipo(tipo: string) {
  const map: Record<string, string> = {
    retorno_ligacao: "Retorno de ligação",
    exame: "Exame",
    receita: "Receita",
    atestado: "Atestado",
    outro: "Outro",
  };
  return map[tipo] ?? tipo;
}

export default function Solicitacoes() {
  const qc = useQueryClient();
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("pendente");
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  // Realtime: invalida ao mudar a tabela
  useRealtimeTable("solicitacoes", ["solicitacoes"]);

  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ["solicitacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacoes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Solicitacao[];
    },
  });

  // Mutação genérica para mudar status
  const mudarStatus = useMutation({
    mutationFn: async ({ id, novo }: { id: string; novo: string }) => {
      const { error } = await supabase
        .from("solicitacoes")
        .update({ status: novo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = {
        em_andamento: "Marcada como em andamento",
        concluido: "Concluída",
        pendente: "Reaberta",
      };
      toast.success(labels[vars.novo] ?? "Atualizado");
      qc.invalidateQueries({ queryKey: ["solicitacoes"] });
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar", { description: err.message });
    },
  });

  // Lista única de tipos vindos do banco + os conhecidos
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>(TIPOS_CONHECIDOS);
    (solicitacoes ?? []).forEach((s) => s.tipo && set.add(s.tipo));
    return Array.from(set);
  }, [solicitacoes]);

  // Filtragem + contadores
  const { lista, contadores } = useMemo(() => {
    const all = solicitacoes ?? [];
    const c = {
      pendente: all.filter((s) => s.status === "pendente").length,
      em_andamento: all.filter((s) => s.status === "em_andamento").length,
      concluido: all.filter((s) => s.status === "concluido").length,
      todos: all.length,
    };
    let filtrados = statusFiltro === "todos" ? all : all.filter((s) => s.status === statusFiltro);
    if (tipoFiltro !== "todos") filtrados = filtrados.filter((s) => s.tipo === tipoFiltro);
    return { lista: filtrados, contadores: c };
  }, [solicitacoes, statusFiltro, tipoFiltro]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Solicitações</h2>
            <p className="text-sm text-muted-foreground">
              Fila de pedidos abertos pelos pacientes (retorno, exame, receita, atestado).
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFiltro)}>
          <TabsList className="bg-card/40 backdrop-blur">
            <TabsTrigger value="pendente" className="gap-2">
              Pendentes
              {contadores.pendente > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                  {contadores.pendente}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="em_andamento" className="gap-2">
              Em andamento
              {contadores.em_andamento > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {contadores.em_andamento}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluido">Concluídas</TabsTrigger>
            <TabsTrigger value="todos">Todas</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[200px] bg-card/40 backdrop-blur">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposDisponiveis.map((t) => (
              <SelectItem key={t} value={t}>
                {labelTipo(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EmptyState statusFiltro={statusFiltro} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((s) => (
            <CardSolicitacao
              key={s.id}
              solicitacao={s}
              onMudarStatus={(novo) => mudarStatus.mutate({ id: s.id, novo })}
              loading={mudarStatus.isPending && mudarStatus.variables?.id === s.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Card individual
// ────────────────────────────────────────────────────────────
function CardSolicitacao({
  solicitacao,
  onMudarStatus,
  loading,
}: {
  solicitacao: Solicitacao;
  onMudarStatus: (novoStatus: string) => void;
  loading: boolean;
}) {
  const s = solicitacao;
  const desde = s.created_at
    ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true, locale: ptBR })
    : "—";

  const statusInfo: Record<string, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    em_andamento: { label: "Em andamento", cls: "bg-primary/15 text-primary border-primary/30" },
    concluido: { label: "Concluída", cls: "bg-muted text-muted-foreground border-border" },
  };
  const st = statusInfo[s.status ?? ""] ?? statusInfo.pendente;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {labelTipo(s.tipo)}
            </Badge>
          </div>
          <h3 className="mt-2 flex items-center gap-1.5 truncate font-medium">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            {s.paciente_nome || "Sem nome"}
          </h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {formatTelefone(s.paciente_telefone)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            st.cls,
          )}
        >
          {st.label}
        </span>
      </header>

      {s.motivo && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{s.motivo}</p>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Aberta {desde}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {s.status === "pendente" && (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => onMudarStatus("em_andamento")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Iniciar
          </Button>
        )}
        {s.status === "em_andamento" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMudarStatus("pendente")}
            disabled={loading}
            title="Voltar para pendente"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
        {s.status !== "concluido" && (
          <Button
            size="sm"
            className="flex-1"
            onClick={() => onMudarStatus("concluido")}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Concluir
          </Button>
        )}
        {s.status === "concluido" && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onMudarStatus("pendente")}
            disabled={loading}
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reabrir
          </Button>
        )}
      </div>
    </motion.article>
  );
}

// ────────────────────────────────────────────────────────────
// Estado vazio
// ────────────────────────────────────────────────────────────
function EmptyState({ statusFiltro }: { statusFiltro: StatusFiltro }) {
  const msgs: Record<StatusFiltro, string> = {
    pendente: "Nenhuma solicitação pendente.",
    em_andamento: "Nenhuma solicitação em andamento.",
    concluido: "Nenhuma solicitação concluída ainda.",
    todos: "Nenhuma solicitação registrada.",
  };
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-16 text-center">
      <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <p className="mt-4 text-sm text-muted-foreground">{msgs[statusFiltro]}</p>
    </div>
  );
}
