import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Especialidade {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  ativo: boolean;
}

export function useEspecialidades(apenasAtivas = false) {
  return useQuery({
    queryKey: ["especialidades", { apenasAtivas }],
    queryFn: async () => {
      let query = supabase.from("especialidades").select("*").order("nome");
      if (apenasAtivas) query = query.eq("ativo", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Especialidade[];
    },
  });
}
