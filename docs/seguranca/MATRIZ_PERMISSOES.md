
# Matriz de Permissões — Menor Preço Saqua

## Aula 13 — Autenticação e Autorização

### 1. Objetivo

Verificar a segurança da autenticação e da autorização
dos usuários do sistema Menor Preço Saqua, utilizando
Supabase Auth, PostgreSQL e Row Level Security (RLS).

Os testes avaliam o isolamento de perfis, a proteção
contra alterações indevidas de permissões, o controle
de acesso às mensagens e o bloqueio de consultas após
o encerramento da sessão da aplicação.

### 2. Usuários utilizados

- Aluno A: usuário autenticado e participante da sala.
- Aluno B: outro usuário autenticado e participante da sala.
- Aluno C: usuário autenticado, não participante da sala.

As senhas e os tokens não são registrados neste documento.

### 3. Matriz de permissões

| Nº | Operação | Resultado esperado | Resultado observado |
|---|---|---|---|
| 01 | Aluno A consultar seu próprio perfil | Permitido | APROVADO — 1 registro |
| 02 | Aluno A consultar o perfil B | Bloqueado | APROVADO — 0 registros |
| 03 | Aluno A consultar o perfil C | Bloqueado | APROVADO — 0 registros |
| 04 | Aluno A alterar seu próprio role | Bloqueado | APROVADO — erro 42501 |
| 05 | Aluno A enviar mensagem usando o author_id de B | Bloqueado | APROVADO — erro 42501 |
| 06 | Aluno C consultar mensagens da sala A/B | Bloqueado | APROVADO — 0 registros |
| 07 | Aluno C enviar mensagem à sala A/B | Bloqueado | APROVADO — erro 42501 |
| 08 | Aluno A consultar seu perfil após end_session() | Bloqueado | APROVADO — 0 registros |

### 4. Políticas de segurança verificadas

#### 4.1. Perfis

A leitura de perfis está limitada ao próprio usuário
autenticado, desde que sua sessão da aplicação esteja
ativa.

A atualização do campo role não é permitida ao usuário
comum por meio das permissões de atualização concedidas.

#### 4.2. Mensagens

A leitura das mensagens depende da participação do
usuário na sala.

O envio de mensagens exige que o usuário seja membro
da sala e que o campo author_id corresponda ao
identificador do usuário autenticado.

#### 4.3. Sessões

O sistema utiliza uma tabela de sessões da aplicação
(session_leases).

Após o encerramento da sessão por end_session(),
a função has_active_session() retorna false.

No teste executado, o JWT permaneceu disponível
no cliente, mas a consulta ao perfil deixou de
retornar registros.

### 5. Scripts de teste

Os scripts estão armazenados em tests/seguranca:

- teste-isolamento-perfis.cjs
- teste-role.cjs
- teste-leitura-mensagens.cjs
- teste-envio-mensagens.cjs
- teste-autorizacao-mensagens.cjs
- teste-sessao-encerrada.cjs

Observação: os scripts de autorização de mensagens possuem cenários distintos. O arquivo teste-autorizacao-mensagens.cjs verifica o bloqueio da falsificação de autoria (author_id), enquanto teste-envio-mensagens.cjs verifica o bloqueio de envio por usuário não participante da sala. Ambos foram executados e aprovados.

### 6. Evidências

As evidências dos testes são os resultados observados
no terminal e as capturas de tela das operações
permitidas e bloqueadas.

Antes da publicação, devem ser ocultados e-mails,
senhas, tokens e outros dados sensíveis.

### 7. Conclusão

Os cenários executados apresentaram os resultados
esperados para as regras de autorização verificadas.

Os testes demonstraram o isolamento de perfis,
o bloqueio de alterações indevidas de permissões,
a restrição de acesso às mensagens e o bloqueio
de leitura do perfil após o encerramento da sessão
da aplicação.

Os resultados comprovam o comportamento esperado
nos cenários testados, sem representar uma auditoria
completa de segurança do sistema.
