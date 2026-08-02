# Política de Privacidade do Zôada

**Última atualização:** 02/08/2026

Esta Política de Privacidade explica quais dados pessoais o Zôada coleta, por quê, como usamos, com quem compartilhamos e quais são os seus direitos, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e, no que se refere a crianças e adolescentes, com a Lei nº 15.211/2025 (ECA Digital).

> Para saber sobre as regras de uso do app (direitos autorais, conteúdo, conduta), veja nossos [Termos de Uso](/termos).

---

## 1. Quem trata seus dados

**Leonardo de Sant'Anna Almeida** é o controlador dos dados pessoais tratados pelo Zôada. Contato do encarregado (DPO) / canal de privacidade: **santannaleonardo@hotmail.com**.

---

## 2. Quais dados coletamos

| Dado | Onde é usado no app | Por quê coletamos |
|---|---|---|
| Email e senha (com hash) | Cadastro e login | Autenticar sua conta |
| Nome e biografia | Perfil público | Te identificar no app |
| Foto de perfil (avatar) | Perfil, posts, comentários | Personalização do seu perfil |
| Faixas enviadas, título, capa | Upload de músicas | Funcionamento do player e do catálogo |
| Curtidas, favoritos, reproduções | Player, ranking "Mais tocadas", "Mais ouvidas" | Personalizar sua experiência e alimentar recomendações |
| Seguidores/seguindo | Perfis de usuário e artista | Rede social do app |
| Posts, comentários, reações | Feed social | Funcionamento do feed |
| Mensagens de chat privado | Chat | Permitir comunicação entre usuários |
| Sessão/login (token) | Autenticação | Manter você logado com segurança |
| Data de nascimento *(em implementação)* | Cadastro | Verificação de idade, conforme exigido pela Lei nº 15.211/2025 (ECA Digital) — este campo ainda não está ativo no formulário de cadastro atual; até que esteja, não fazemos verificação de idade |
| Dados técnicos de acesso (ex.: endereço IP, informações do dispositivo) | Logs de acesso e segurança | Segurança, prevenção de fraude e diagnóstico técnico |

Não coletamos, intencionalmente, dados sensíveis no sentido do art. 5º, II, da LGPD (como dados de saúde, biometria ou orientação sexual).

---

## 3. Por que podemos tratar esses dados (base legal)

Tratamos seus dados com base em:

- **Execução de contrato** (art. 7º, V, da LGPD): para fornecer as funcionalidades do app que você usa ao criar uma conta (login, player, feed, chat, etc.).
- **Consentimento** (art. 7º, I): quando aplicável, como ao optar por funcionalidades específicas de personalização.
- **Cumprimento de obrigação legal ou regulatória** (art. 7º, II): por exemplo, verificação de idade exigida pela Lei nº 15.211/2025, ou resposta a notificações de infração de direitos.
- **Legítimo interesse** (art. 7º, IX), quando aplicável a melhorias e segurança do app, sempre respeitando seus direitos e expectativas.

---

## 4. Com quem compartilhamos dados

Usamos dois provedores de infraestrutura para operar o Zôada:

| Provedor | Função | Onde ficam os dados |
|---|---|---|
| **Neon** (banco de dados Postgres) | Guarda contas, mensagens, posts, curtidas, faixas cadastradas, etc. | Região **sa-east-1** (São Paulo, Brasil), conforme a instância contratada. |
| **Cloudflare R2** (armazenamento de arquivos) | Guarda os arquivos de áudio, capas e avatares | Rede global da Cloudflare — por padrão, o R2 **não fixa os dados a uma única região**; a Cloudflare pode replicar/servir esse conteúdo a partir de data centers fora do Brasil, salvo se uma restrição jurisdicional específica for configurada na conta. |

Isso significa, na prática:

- O **banco de dados** (dados de conta, mensagens, textos de posts e comentários) está hospedado no Brasil, então **não configura transferência internacional** de dados pessoais.
- Os **arquivos armazenados no Cloudflare R2** (áudio, capas, avatares) podem ser tratados fora do Brasil, o que **pode configurar transferência internacional de dados** nos termos dos arts. 33 a 36 da LGPD — sobretudo quando o arquivo em si contém dado pessoal (ex.: um avatar com foto de rosto). Continuamos avaliando se vale configurar uma restrição jurisdicional no R2 para manter esses arquivos também dentro do Brasil; enquanto isso, esse tratamento se apoia nas hipóteses do art. 33 (ex.: cláusulas contratuais padrão do fornecedor, consentimento específico ou necessidade para execução do contrato, conforme o caso), com as salvaguardas exigidas pela ANPD.
- **Não vendemos seus dados pessoais** e não compartilhamos seus dados com terceiros para fins de publicidade sem uma base legal e aviso adequados.
- **Autoridades competentes**, quando exigido por lei — por exemplo, em casos de conteúdo relacionado a abuso ou exploração de crianças e adolescentes, que notificamos imediatamente conforme exige a Lei nº 15.211/2025.

---

## 5. Por quanto tempo guardamos seus dados

Guardamos seus dados enquanto sua conta estiver ativa, ou pelo tempo necessário para cumprir obrigações legais (por exemplo, registros que a lei exija manter mesmo após o encerramento de uma conta, como em investigações de infração de direitos autorais ou de conteúdo ilícito). Após a exclusão da conta, seus dados pessoais são removidos ou anonimizados, exceto quando a lei exigir retenção por prazo determinado.

---

## 6. Seus direitos (art. 18 da LGPD)

Você tem direito a:

- **Confirmar** se tratamos seus dados e **acessar** esses dados.
- **Corrigir** dados incompletos, inexatos ou desatualizados.
- **Solicitar a portabilidade** dos seus dados a outro fornecedor de serviço.
- **Eliminar** seus dados pessoais, inclusive os tratados com base no seu consentimento.
- **Revogar o consentimento** a qualquer momento, quando o tratamento se basear nele.
- **Solicitar informações** sobre com quem compartilhamos seus dados.
- **Se opor** a um tratamento realizado com base em hipótese legal que você entenda inadequada.

A maior parte desses direitos já tem um caminho direto dentro do próprio app, em **Perfil → Configurações**, sem precisar esperar resposta por email:

| Direito | Como exercer |
|---|---|
| Acesso e portabilidade | **"Baixar meus dados"** — gera na hora um arquivo com todos os seus dados pessoais (perfil, faixas, curtidas, favoritos, seguidores, posts, comentários, mensagens, estação de rádio) |
| Correção | **"Editar perfil"** — nome e foto; para outros dados, use o canal de contato abaixo |
| Eliminação | **"Excluir conta"** — apaga a conta e os dados vinculados a ela (ver item 8) |

Para os demais pedidos (revogação de consentimento, informações sobre compartilhamento, oposição a um tratamento), ou se algo não funcionar como esperado nas opções acima, entre em contato pelo **santannaleonardo@hotmail.com**. Responderemos dentro do prazo legal aplicável.

---

## 7. Crianças e adolescentes

Sabemos que o Zôada pode ser usado por crianças e adolescentes. Por isso, estamos adequando o app à Lei nº 15.211/2025 (ECA Digital):

- **Em implementação:** pedir a data de nascimento no cadastro e verificar a idade informada — hoje o formulário de cadastro ainda não pede essa informação.
- Contas de usuários com **menos de 16 anos** devem estar vinculadas a um responsável legal, com ferramentas de controle de tempo de uso, contatos e conteúdo, conforme a Lei nº 15.211/2025.
- Damos atenção redobrada a dados de menores, com tratamento mais restritivo nos termos do art. 14 da LGPD.
- Conteúdo identificado como relacionado a abuso, aliciamento ou exploração de menores é removido e notificado imediatamente às autoridades competentes.

Se você é responsável legal de um menor e identificar uma conta sem o devido vínculo, entre em contato pelo **santannaleonardo@hotmail.com**.

---

## 8. Como excluir sua conta ou seus dados

Você pode excluir sua conta e seus dados a qualquer momento, de forma simples:

1. Acesse **Perfil → Configurações → Excluir conta** dentro do app (vai pedir sua senha atual pra confirmar); **ou**
2. Envie um pedido para **santannaleonardo@hotmail.com**.

Ao excluir sua conta, removemos ou anonimizamos seus dados pessoais (email, nome, avatar, mensagens, curtidas, favoritos, histórico de reprodução), exceto informações que a lei exija manter por prazo determinado. Faixas que você enviou podem ser removidas do catálogo junto com a exclusão da conta — se preferir apenas desativar a conta mantendo o conteúdo público, entre em contato para essa opção.

Você também pode **baixar uma cópia dos seus dados** a qualquer momento, sem excluir a conta, em **Perfil → Configurações → Baixar meus dados** — isso gera na hora um arquivo `.json` com tudo que temos sobre você (perfil, faixas enviadas, curtidas, favoritos, histórico de escuta, seguidores, posts, comentários, mensagens e sua estação de rádio, se você tiver uma).

---

## 9. Segurança

Adotamos medidas técnicas e administrativas razoáveis para proteger seus dados contra acesso não autorizado, perda ou alteração indevida — incluindo senhas armazenadas com hash e autenticação por token. Nenhum sistema é 100% livre de risco; se identificarmos um incidente de segurança que possa te afetar, você será notificado conforme exige a LGPD.

---

## 10. Cookies e tecnologias semelhantes

O Zôada **não usa cookies** hoje. Sua sessão é mantida por um token de autenticação (JWT) salvo no **armazenamento local do seu navegador** (`localStorage`), enviado a cada requisição para confirmar que é você. Esse token expira automaticamente e é apagado ao fazer logout. Não usamos cookies ou tecnologias de rastreamento de terceiros para publicidade.

---

## 11. Alterações desta Política

Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas dentro do app ou por email antes de entrarem em vigor.

---

## 12. Contato

Dúvidas, solicitações sobre seus dados, ou reclamações: **santannaleonardo@hotmail.com**.

Se não ficar satisfeito com nossa resposta, você também pode contatar a Autoridade Nacional de Proteção de Dados (ANPD) — gov.br/anpd.

---

*Este documento é um modelo de referência baseado em pesquisa jurídica e reflete o que o app efetivamente implementa até a data da última atualização acima. Ainda assim, deve ser revisado por um advogado antes de ser publicado em produção — especialmente os pontos marcados como "em implementação" e a avaliação de transferência internacional de dados do item 4.*
