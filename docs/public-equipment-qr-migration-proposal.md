# Proposta de persistência do QR público (não aplicada)

Esta proposta depende da reconexão e validação do banco. Nenhum schema ou dado foi alterado nesta etapa.

Criar futuramente uma relação opcional e não destrutiva de acesso público contendo:

- `id`: identificador interno do registro de acesso;
- `equipment_id`: referência única ao equipamento existente;
- `token_hash`: hash único do token público (o token original não deve ser persistido);
- `active`: estado de validade;
- `created_at`: data de criação;
- `revoked_at`: data opcional de revogação.

O token deve ser gerado exclusivamente no servidor com pelo menos 32 bytes de aleatoriedade criptográfica, codificado em Base64 URL-safe. A rotação deve criar um novo token e revogar o anterior em uma transação. Equipamentos existentes continuam válidos sem registro de acesso público.

Antes de habilitar `ENABLE_PUBLIC_EQUIPMENT_QR=true`, ainda são obrigatórios: migração revisada, acesso de leitura com privilégio mínimo, emissão autenticada reutilizando a permissão atual de edição, consulta parametrizada por hash e rate limit distribuído compatível com serverless.
