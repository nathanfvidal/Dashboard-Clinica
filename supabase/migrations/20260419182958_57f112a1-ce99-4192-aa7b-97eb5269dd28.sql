-- Permitir exclusão de pacientes em cascata: ao remover um paciente,
-- atendimentos_humanos e solicitacoes vinculados são removidos junto.

ALTER TABLE public.atendimentos_humanos
  DROP CONSTRAINT IF EXISTS atendimentos_humanos_paciente_telefone_fkey;

ALTER TABLE public.atendimentos_humanos
  ADD CONSTRAINT atendimentos_humanos_paciente_telefone_fkey
  FOREIGN KEY (paciente_telefone)
  REFERENCES public.pacientes(telefone)
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE public.solicitacoes
  DROP CONSTRAINT IF EXISTS solicitacoes_paciente_telefone_fkey;

ALTER TABLE public.solicitacoes
  ADD CONSTRAINT solicitacoes_paciente_telefone_fkey
  FOREIGN KEY (paciente_telefone)
  REFERENCES public.pacientes(telefone)
  ON DELETE CASCADE
  ON UPDATE CASCADE;