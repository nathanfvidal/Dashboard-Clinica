import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Medico {
  id: string;
  nome: string;
  especialidade_id: string | null;
  crm: string | null;
  telefone: string | null;
  ativo: boolean;
  especialidades?: { id: string; nome: string; icone: string | null } | null;
}

interface Options {
  apenasAtivos?: boolean;
  especialidadeId?: string;
}

export function useMedicos({ apenasAtivos = false, especialidadeId }: Options = {}) {
  return useQuery({
    queryKey: ["medicos", { apenasAtivos, especialidadeId }],
    queryFn: async () => {
      let query = supabase
        .from("medicos")
        .select("*, especialidades:especialidade_id(id, nome, icone)")
        .order("nome");
      if (apenasAtivos) query = query.eq("ativo", true);
      if (especialidadeId) query = query.eq("especialidade_id", especialidadeId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Medico[];
    },
  });
}
