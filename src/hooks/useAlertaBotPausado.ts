import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { createElement } from "react";
import { supabase } from "@/integrations/supabase/client";

// Status que indicam bot pausado / aguardando humano
const STATUS_HUMANO = new Set(["humano", "atendente", "pausado"]);

// Gera um bip curto via Web Audio API — sem precisar de arquivo de áudio
function tocarBip() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => ctx.close();
  } catch {
    // Áudio não disponível: silenciosamente ignora
  }
}

// Atualiza o título da aba para chamar atenção quando o usuário está em outra
function piscarTitulo(mensagem: string, vezes = 6) {
  const original = document.title;
  let i = 0;
  const id = setInterval(() => {
    document.title = i % 2 === 0 ? mensagem : original;
    if (++i >= vezes * 2) {
      clearInterval(id);
      document.title = original;
    }
  }, 800);
  // Restaura ao voltar para a aba
  const onVisible = () => {
    if (!document.hidden) {
      clearInterval(id);
      document.title = original;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
  document.addEventListener("visibilitychange", onVisible);
}

interface Paciente {
  telefone: string;
  nome: string | null;
  status_sessao: string | null;
}

/**
 * Escuta em tempo real mudanças em `pacientes` e dispara alerta visual + sonoro
 * sempre que um paciente passar para status "humano" (bot pausado).
 *
 * Ignora o primeiro estado de cada paciente para não notificar registros já existentes.
 */
export function useAlertaBotPausado() {
  const queryClient = useQueryClient();
  // Cache do status anterior por telefone para detectar a transição
  const statusAnterior = useRef<Map<string, string>>(new Map());
  // Marca pacientes já vistos para não disparar no primeiro carregamento
  const inicializado = useRef(false);

  useEffect(() => {
    let cancelado = false;

    // 1) Carrega o estado atual para servir de baseline
    (async () => {
      const { data } = await supabase
        .from("pacientes")
        .select("telefone, status_sessao");
      if (cancelado) return;
      const mapa = new Map<string, string>();
      for (const p of data ?? []) {
        mapa.set(p.telefone, (p.status_sessao ?? "").toLowerCase());
      }
      statusAnterior.current = mapa;
      inicializado.current = true;
    })();

    // 2) Trata cada evento realtime e detecta transição → "humano"
    const handle = (registro: Paciente, anterior?: string) => {
      if (!inicializado.current) return;
      const novo = (registro.status_sessao ?? "").toLowerCase();
      const era = (anterior ?? statusAnterior.current.get(registro.telefone) ?? "")
        .toLowerCase();

      const ficouPausado = STATUS_HUMANO.has(novo) && !STATUS_HUMANO.has(era);
      statusAnterior.current.set(registro.telefone, novo);

      if (!ficouPausado) return;

      const nome = registro.nome?.trim() || registro.telefone;

      // Toast persistente com ícone — usa sonner para visual mais discreto
      toast(`Bot pausado — ${nome}`, {
        description: "Aguardando atendimento humano",
        duration: 8000,
        icon: createElement(BellRing, { className: "h-4 w-4" }),
      });

      tocarBip();

      // Pisca o título quando a aba não está visível
      if (document.hidden) {
        piscarTitulo(`(!) ${nome} aguardando`);
      }

      // Atualiza queries dependentes para refletir o novo status na UI
      queryClient.invalidateQueries({ queryKey: ["pacientes-sessao"] });
      queryClient.invalidateQueries({ queryKey: ["atendimentos"] });
    };

    // 3) Assina canal Realtime na tabela pacientes
    const channel = supabase
      .channel("alerta-bot-pausado")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pacientes" },
        (payload) => {
          const novo = payload.new as Paciente;
          const anterior = (payload.old as Partial<Paciente>)?.status_sessao ?? undefined;
          handle(novo, anterior ?? undefined);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pacientes" },
        (payload) => {
          const novo = payload.new as Paciente;
          handle(novo, "");
        },
      )
      .subscribe();

    return () => {
      cancelado = true;
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
