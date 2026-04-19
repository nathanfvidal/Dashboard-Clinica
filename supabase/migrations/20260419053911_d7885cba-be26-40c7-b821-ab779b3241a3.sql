-- Adicionar coluna updated_at faltante em pacientes (trigger ja referencia)
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();