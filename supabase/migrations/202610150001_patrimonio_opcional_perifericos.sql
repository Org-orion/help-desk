begin;

-- Periféricos (mouse, teclado, cabo, adaptador) costumam chegar sem plaqueta
-- de patrimônio. A coluna passa a aceitar nulo para que esses ativos possam
-- ser cadastrados; a aplicação continua exigindo o campo para todos os
-- demais tipos.
--
-- A restrição UNIQUE permanece: o Postgres não considera dois NULL iguais,
-- então vários periféricos sem patrimônio convivem sem conflito. Por isso o
-- formulário precisa gravar NULL, e nunca string vazia — dois '' colidiriam.
alter table public.equipamentos
  alter column patrimonio drop not null;

commit;
