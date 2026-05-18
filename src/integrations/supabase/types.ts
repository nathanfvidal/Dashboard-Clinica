export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          created_at: string | null
          data_consulta: string
          especialidade: string
          especialidade_id: string | null
          feedback_solicitado_at: string | null
          horario: string
          id: string
          lembrete_2h_enviado_at: string | null
          lembrete_d1_enviado_at: string | null
          medico: string
          medico_id: string | null
          paciente_nome: string | null
          paciente_telefone: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          data_consulta: string
          especialidade: string
          especialidade_id?: string | null
          feedback_solicitado_at?: string | null
          horario: string
          id?: string
          lembrete_2h_enviado_at?: string | null
          lembrete_d1_enviado_at?: string | null
          medico: string
          medico_id?: string | null
          paciente_nome?: string | null
          paciente_telefone: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          data_consulta?: string
          especialidade?: string
          especialidade_id?: string | null
          feedback_solicitado_at?: string | null
          horario?: string
          id?: string
          lembrete_2h_enviado_at?: string | null
          lembrete_d1_enviado_at?: string | null
          medico?: string
          medico_id?: string | null
          paciente_nome?: string | null
          paciente_telefone?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_humanos: {
        Row: {
          created_at: string | null
          finalizado_at: string | null
          id: string
          motivo: string | null
          paciente_nome: string | null
          paciente_telefone: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          finalizado_at?: string | null
          id?: string
          motivo?: string | null
          paciente_nome?: string | null
          paciente_telefone: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          finalizado_at?: string | null
          id?: string
          motivo?: string | null
          paciente_nome?: string | null
          paciente_telefone?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_humanos_paciente_telefone_fkey"
            columns: ["paciente_telefone"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["telefone"]
          },
        ]
      }
      especialidades: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          icone: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          icone?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          agendamento_id: string | null
          comentario: string | null
          created_at: string
          id: string
          nota: number
          paciente_nome: string | null
          paciente_telefone: string
        }
        Insert: {
          agendamento_id?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          paciente_nome?: string | null
          paciente_telefone: string
        }
        Update: {
          agendamento_id?: string | null
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          paciente_nome?: string | null
          paciente_telefone?: string
        }
        Relationships: []
      }
      horarios_medico: {
        Row: {
          ativo: boolean
          created_at: string
          dia_semana: number
          duracao_consulta_min: number
          hora_fim: string
          hora_inicio: string
          id: string
          medico_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          dia_semana: number
          duracao_consulta_min?: number
          hora_fim: string
          hora_inicio: string
          id?: string
          medico_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          dia_semana?: number
          duracao_consulta_min?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          medico_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_medico_medico_id_fkey"
            columns: ["medico_id"]
            isOneToOne: false
            referencedRelation: "medicos"
            referencedColumns: ["id"]
          },
        ]
      }
      medicos: {
        Row: {
          ativo: boolean
          created_at: string
          crm: string | null
          especialidade_id: string | null
          id: string
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          crm?: string | null
          especialidade_id?: string | null
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          crm?: string | null
          especialidade_id?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicos_especialidade_id_fkey"
            columns: ["especialidade_id"]
            isOneToOne: false
            referencedRelation: "especialidades"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          agente: string
          conteudo: string | null
          created_at: string
          direcao: string
          id: number
          metadata: Json | null
          paciente_telefone: string
          tipo: string
        }
        Insert: {
          agente?: string
          conteudo?: string | null
          created_at?: string
          direcao: string
          id?: number
          metadata?: Json | null
          paciente_telefone: string
          tipo?: string
        }
        Update: {
          agente?: string
          conteudo?: string | null
          created_at?: string
          direcao?: string
          id?: number
          metadata?: Json | null
          paciente_telefone?: string
          tipo?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          created_at: string | null
          id: string
          nome: string | null
          status_sessao: string | null
          telefone: string
          ultima_atividade_bot: string | null
          ultima_interacao: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nome?: string | null
          status_sessao?: string | null
          telefone: string
          ultima_atividade_bot?: string | null
          ultima_interacao?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nome?: string | null
          status_sessao?: string | null
          telefone?: string
          ultima_atividade_bot?: string | null
          ultima_interacao?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      solicitacoes: {
        Row: {
          created_at: string | null
          id: string
          motivo: string | null
          paciente_nome: string | null
          paciente_telefone: string
          status: string | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          motivo?: string | null
          paciente_nome?: string | null
          paciente_telefone: string
          status?: string | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          id?: string
          motivo?: string | null
          paciente_nome?: string | null
          paciente_telefone?: string
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_paciente_telefone_fkey"
            columns: ["paciente_telefone"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["telefone"]
          },
        ]
      }
    }
    Views: {
      v_metricas_diarias: {
        Row: {
          agendamentos_criados: number | null
          conversas_unicas: number | null
          dia: string | null
          msgs_in: number | null
          msgs_out: number | null
          tempo_medio_resposta_seg: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      gerar_agenda_mes: {
        Args: { p_data_fim: string; p_data_inicio: string; p_medico_id: string }
        Returns: number
      }
      gerar_slots_disponiveis: {
        Args: { p_data_fim: string; p_data_inicio: string; p_medico_id: string }
        Returns: {
          data_consulta: string
          horario: string
        }[]
      }
      remarcar_agendamento: {
        Args: { p_antigo: string; p_novo: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
