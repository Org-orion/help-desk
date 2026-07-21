# Ativação segura das etiquetas QR

Esta implementação está deliberadamente desativada. O banco não foi acessado e a migração não foi aplicada durante o desenvolvimento.

## Antes de ativar

1. Restaurar a conexão do banco em ambiente de homologação e criar backup verificável.
2. Revisar `supabase/migrations/prepare_equipment_qr_labels.sql`, plano de rollback, constraints e políticas RLS.
3. Aplicar a migração primeiro em homologação por processo aprovado; nunca por reset, seed ou `db push`.
4. Implementar `EquipmentQrPersistence` usando consultas parametrizadas e transações reais.
5. Implementar `EquipmentQrServerAdapters.authenticateAdmin` com sessão assinada e reutilizar a permissão administrativa de equipamentos. O estado de autenticação do navegador não é suficiente.
6. Configurar uma credencial server-only de privilégio mínimo. Não usar variáveis `NEXT_PUBLIC_` ou `VITE_` para segredos.
7. Configurar rate limit distribuído, compatível com serverless, para consulta pública e scanner autenticado.
8. Configurar a URL-base HTTPS e validar `buildPublicEquipmentUrl` no domínio de produção.
9. Conectar o endpoint público ao método `selectPublicEquipmentByTokenHash`, mantendo seleção explícita de `PublicEquipmentDTO`.
10. Executar os testes de homologação abaixo e revisar auditoria/concorrência.
11. Somente então definir no servidor `ENABLE_EQUIPMENT_QR_LABELS=true` e `ENABLE_PUBLIC_EQUIPMENT_QR=true`.

## Testes futuros com banco

- Gerar lote real e confirmar operação atômica e códigos/hash únicos.
- Imprimir e reimprimir sem gerar novo token.
- Escanear etiqueta `UNUSED` e cadastrar equipamento com zeros preservados.
- Vincular equipamento existente usando a fonte real.
- Detectar patrimônio duplicado e etiqueta ativa anterior.
- Confirmar substituição explícita de patrimônio.
- Revogar, preservar equipamento/auditoria e rejeitar o token anterior.
- Substituir etiqueta e confirmar token novo.
- Abrir consulta pública sem sessão, sidebar ou dados privados.
- Testar permissões, rate limit, transações, rollback e concorrência.
- Testar câmera traseira, encerramento do stream e leitura de imagem em celular HTTPS.
