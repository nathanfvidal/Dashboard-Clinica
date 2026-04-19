ALTER TABLE public.solicitacoes DROP CONSTRAINT IF EXISTS solicitacoes_tipo_check;

ALTER TABLE public.solicitacoes
  ADD CONSTRAINT solicitacoes_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'cancelamento'::text,
    'remarcacao'::text,
    'exame'::text,
    'receita'::text,
    'financeiro'::text,
    'duvida'::text,
    'outro'::text
  ]));