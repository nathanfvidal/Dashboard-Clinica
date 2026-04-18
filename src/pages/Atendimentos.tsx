import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  Headphones,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Tipos locais — evita reler types.ts toda hora
type Atendimento = {
  id: string;
  paciente_telefone: string;
  paciente_nome: string | null;
  motivo: string | null;
  status: string | null;
  created_at: string | null;
  finalizado_at: string | null;
};

type Mensagem = {
  id: number;
  paciente_telefone: string;
  direcao: string;
  conteudo: string | null;
  tipo: string;
  agente: string;
  created_at: string;
};

type Filtro = "aguardando" | "em_andamento" | "finalizado" | "todos";

// Formata telefone E.164 para visual: 5583999915242 -> +55 83 99991-5242
function formatTelefone(tel: string) {
  const t = tel.replace(/\D/g, "");
  if (t.length === 13) return `+${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4, 9)}-${t.slice(9)}`;
  if (t.length === 12) return `+${t.slice(0, 2)} ${t.slice(2, 4)} ${t.slice(4, 8)}-${t.slice(8)}`;
  return tel;
}

export default function Atendimentos() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("aguardando");
  const [aberto, setAberto] = useState<Atendimento | null>(null);
  const [confirmar, setConfirmar] = useState<Atendimento | null>(null);

  // Realtime: invalida ao mudar a tabela
  useRealtimeTable("atendimentos_humanos", ["atendimentos_humanos"]);

  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["atendimentos_humanos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_humanos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Atendimento[];
    },
  });

  // Histórico de mensagens do paciente aberto no drawer
  const { data: mensagens, isLoading: loadingMsgs } = useQuery({
    queryKey: ["mensagens", aberto?.paciente_telefone],
    enabled: !!aberto?.paciente_telefone,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mensagens")
        .select("*")
        .eq("paciente_telefone", aberto!.paciente_telefone)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as Mensagem[];
    },
  });

  // Finalizar atendimento + reativar bot do paciente
  const finalizar = useMutation({
    mutationFn: async (a: Atendimento) => {
      const agora = new Date().toISOString();
      // 1) Marca atendimento como finalizado
      const { error: e1 } = await supabase
        .from("atendimentos_humanos")
        .update({ status: "finalizado", finalizado_at: agora })
        .eq("id", a.id);
      if (e1) throw e1;
      // 2) Reativa o bot para esse paciente
      const { error: e2 } = await supabase
        .from("pacientes")
        .update({ status_sessao: "ia" })
        .eq("telefone", a.paciente_telefone);
      if (e2) throw e2;
      // 3) Loga evento na tabela mensagens
      await supabase.from("mensagens").insert({
        paciente_telefone: a.paciente_telefone,
        direcao: "out",
        tipo: "evento",
        conteudo: "Atendimento humano finalizado. Bot reativado.",
        agente: "sistema",
      });
    },
    onSuccess: () => {
      toast.success("Atendimento finalizado", {
        description: "Bot reativado para esse paciente.",
      });
      qc.invalidateQueries({ queryKey: ["atendimentos_humanos"] });
      setConfirmar(null);
      setAberto(null);
    },
    onError: (err: Error) => {
      toast.error("Erro ao finalizar", { description: err.message });
    },
  });

  // Assumir (aguardando -> em_andamento) — apenas marca status, não reativa bot
  const assumir = useMutation({
    mutationFn: async (a: Atendimento) => {
      const { error } = await supabase
        .from("atendimentos_humanos")
        .update({ status: "em_andamento" })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atendimento assumido");
      qc.invalidateQueries({ queryKey: ["atendimentos_humanos"] });
    },
    onError: (err: Error) => {
      toast.error("Erro", { description: err.message });
    },
  });

  // Filtragem + contadores
  const { lista, contadores } = useMemo(() => {
    const all = atendimentos ?? [];
    const c = {
      aguardando: all.filter((a) => a.status === "aguardando").length,
      em_andamento: all.filter((a) => a.status === "em_andamento").length,
      finalizado: all.filter((a) => a.status === "finalizado").length,
      todos: all.length,
    };
    const filtrados = filtro === "todos" ? all : all.filter((a) => a.status === filtro);
    return { lista: filtrados, contadores: c };
  }, [atendimentos, filtro]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Atendimentos humanos</h2>
            <p className="text-sm text-muted-foreground">
              Pacientes em modo humano. Finalize para reativar o bot.
            </p>
          </div>
        </div>
      </header>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
        <TabsList className="bg-card/40 backdrop-blur">
          <TabsTrigger value="aguardando" className="gap-2">
            Aguardando
            {contadores.aguardando > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {contadores.aguardando}
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
          <TabsTrigger value="finalizado">Finalizados</TabsTrigger>
          <TabsTrigger value="todos">Todos</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <EmptyState filtro={filtro} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => (
            <CardAtendimento
              key={a.id}
              atendimento={a}
              onAbrir={() => setAberto(a)}
              onAssumir={() => assumir.mutate(a)}
              onFinalizar={() => setConfirmar(a)}
              loadingAssumir={assumir.isPending && assumir.variables?.id === a.id}
            />
          ))}
        </div>
      )}

      {/* Drawer com histórico de mensagens */}
      <Sheet open={!!aberto} onOpenChange={(o) => !o && setAberto(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {aberto && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {aberto.paciente_nome || "Paciente"}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {formatTelefone(aberto.paciente_telefone)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3">
                {aberto.motivo && (
                  <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">Motivo</p>
                    <p className="mt-1">{aberto.motivo}</p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Histórico (últimas 100)
                  </p>
                  {loadingMsgs && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                <ScrollArea className="h-[55vh] rounded-lg border border-border/40 bg-background/40 p-3">
                  {mensagens && mensagens.length > 0 ? (
                    <div className="space-y-2">
                      {mensagens.map((m) => (
                        <BolhaMensagem key={m.id} m={m} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Sem mensagens registradas.
                    </p>
                  )}
                </ScrollArea>

                <div className="flex gap-2 pt-2">
                  {aberto.status === "aguardando" && (
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => assumir.mutate(aberto)}
                      disabled={assumir.isPending}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Assumir
                    </Button>
                  )}
                  {aberto.status !== "finalizado" && (
                    <Button
                      className="flex-1"
                      onClick={() => setConfirmar(aberto)}
                      disabled={finalizar.isPending}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Finalizar e reativar bot
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Confirmação */}
      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O bot voltará a responder mensagens deste paciente automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmar && finalizar.mutate(confirmar)}
              disabled={finalizar.isPending}
            >
              {finalizar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Card individual
// ────────────────────────────────────────────────────────────
function CardAtendimento({
  atendimento,
  onAbrir,
  onAssumir,
  onFinalizar,
  loadingAssumir,
}: {
  atendimento: Atendimento;
  onAbrir: () => void;
  onAssumir: () => void;
  onFinalizar: () => void;
  loadingAssumir: boolean;
}) {
  const a = atendimento;
  const desde = a.created_at
    ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })
    : "—";

  const statusInfo: Record<string, { label: string; cls: string }> = {
    aguardando: { label: "Aguardando", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    em_andamento: { label: "Em andamento", cls: "bg-primary/15 text-primary border-primary/30" },
    finalizado: { label: "Finalizado", cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = statusInfo[a.status ?? ""] ?? statusInfo.aguardando;

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-border/50 bg-card/60 p-4 backdrop-blur transition-colors hover:border-primary/40"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{a.paciente_nome || "Sem nome"}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            {formatTelefone(a.paciente_telefone)}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
            s.cls,
          )}
        >
          {s.label}
        </span>
      </header>

      {a.motivo && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{a.motivo}</p>
      )}

      <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        Aberto {desde}
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onAbrir}>
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Conversa
        </Button>
        {a.status === "aguardando" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onAssumir}
            disabled={loadingAssumir}
            title="Marcar como em andamento"
          >
            {loadingAssumir ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        {a.status !== "finalizado" && (
          <Button size="sm" onClick={onFinalizar} title="Finalizar e reativar bot">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </motion.article>
  );
}

// ────────────────────────────────────────────────────────────
// Bolha de mensagem estilo WhatsApp
// ────────────────────────────────────────────────────────────
function BolhaMensagem({ m }: { m: Mensagem }) {
  const isIn = m.direcao === "in";
  const horario = new Date(m.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const agenteLabel: Record<string, string> = {
    sofia: "Sofia",
    humano: "Humano",
    sistema: "Sistema",
    paciente: "Paciente",
  };
  return (
    <div className={cn("flex", isIn ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isIn ? "bg-muted/60 text-foreground" : "bg-primary/15 text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{m.conteudo || "(vazio)"}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {agenteLabel[m.agente] ?? m.agente} · {horario}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Estado vazio
// ────────────────────────────────────────────────────────────
function EmptyState({ filtro }: { filtro: Filtro }) {
  const msgs: Record<Filtro, string> = {
    aguardando: "Nenhum paciente aguardando atendimento humano.",
    em_andamento: "Nenhum atendimento em andamento.",
    finalizado: "Nenhum atendimento finalizado ainda.",
    todos: "Nenhum atendimento registrado.",
  };
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-16 text-center">
      <Headphones className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <p className="mt-4 text-sm text-muted-foreground">{msgs[filtro]}</p>
    </div>
  );
}
