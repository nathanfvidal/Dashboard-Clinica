UPDATE atendimentos_humanos SET created_at = date_trunc('day', created_at) 
  + (8 + floor(random()*10))::int * interval '1 hour' 
  + floor(random()*60)::int * interval '1 minute';
UPDATE atendimentos_humanos SET finalizado_at = created_at + (interval '15 minutes' + floor(random()*90)::int * interval '1 minute') WHERE status = 'finalizado';