-- Tabela de feedbacks pós-consulta
CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid NULL,
  paciente_telefone text NOT NULL,
  paciente_nome text NULL,
  nota integer NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Policies permissivas para feedbacks (sem auth no projeto ainda)
CREATE POLICY "Leitura pública de feedbacks"
  ON public.feedbacks FOR SELECT USING (true);

CREATE POLICY "Inserção pública de feedbacks"
  ON public.feedbacks FOR INSERT WITH CHECK (true);

CREATE POLICY "Atualização pública de feedbacks"
  ON public.feedbacks FOR UPDATE USING (true);

CREATE POLICY "Exclusão pública de feedbacks"
  ON public.feedbacks FOR DELETE USING (true);

-- Policies permissivas nas tabelas existentes (estão com RLS sem policies)
CREATE POLICY "Leitura pública de agendamentos" ON public.agendamentos FOR SELECT USING (true);
CREATE POLICY "Inserção pública de agendamentos" ON public.agendamentos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de agendamentos" ON public.agendamentos FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de agendamentos" ON public.agendamentos FOR DELETE USING (true);

CREATE POLICY "Leitura pública de atendimentos" ON public.atendimentos_humanos FOR SELECT USING (true);
CREATE POLICY "Inserção pública de atendimentos" ON public.atendimentos_humanos FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de atendimentos" ON public.atendimentos_humanos FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de atendimentos" ON public.atendimentos_humanos FOR DELETE USING (true);

CREATE POLICY "Leitura pública de pacientes" ON public.pacientes FOR SELECT USING (true);
CREATE POLICY "Inserção pública de pacientes" ON public.pacientes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de pacientes" ON public.pacientes FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de pacientes" ON public.pacientes FOR DELETE USING (true);

CREATE POLICY "Leitura pública de solicitacoes" ON public.solicitacoes FOR SELECT USING (true);
CREATE POLICY "Inserção pública de solicitacoes" ON public.solicitacoes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública de solicitacoes" ON public.solicitacoes FOR UPDATE USING (true);
CREATE POLICY "Exclusão pública de solicitacoes" ON public.solicitacoes FOR DELETE USING (true);

-- Realtime para todas as tabelas relevantes
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.atendimentos_humanos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pacientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedbacks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes;

ALTER TABLE public.agendamentos REPLICA IDENTITY FULL;
ALTER TABLE public.atendimentos_humanos REPLICA IDENTITY FULL;
ALTER TABLE public.pacientes REPLICA IDENTITY FULL;
ALTER TABLE public.feedbacks REPLICA IDENTITY FULL;
ALTER TABLE public.solicitacoes REPLICA IDENTITY FULL;