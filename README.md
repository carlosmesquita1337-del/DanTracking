# DanTracking — Painel de Remessas

Painel web (nome do sistema: **DanTracking**) que lê a planilha Google
"RemessasUnilog" (abas `Base_Remessas`,
`Cobertura_Instituto` e `Usuarios_Sistema`) e mostra os itens filtrados por:
Todos, Atendidos (parcial/total), Despachados, Recebidos (parcial/total),
Atendidos +7d sem despacho, Despachados +7d sem receber e Saldo sem remessa
(itens com Saldo 150 > 0 na aba Cobertura_Instituto que não têm nenhuma
remessa correspondente). Cada item de remessa também mostra a Cobertura
Instituto (dias) vinda da aba Cobertura_Instituto, cruzada pelo código do
produto. Não é possível editar dados pelo painel — toda edição continua sendo
feita na planilha do Google.

O painel agora exige **login por usuário e senha**. Cada usuário só vê as
abas que o administrador liberou para ele.

## Como funciona

1. Um **Google Apps Script** publicado como Web App recebe todas as chamadas
   via **POST** (nunca GET, para nunca colocar senha/token em URL), autentica o
   usuário, filtra os dados conforme a permissão dele e devolve um JSON limpo.
2. Este site (`index.html` + `style.css` + `script.js`) mostra uma tela de
   login, guarda o token da sessão em `sessionStorage` (some quando a aba
   fecha) e usa esse token em toda chamada seguinte.
3. Não há build step — são arquivos estáticos puros. Qualquer hospedagem de
   site estático serve.

O arquivo `apps-script-Code.gs` aqui no repositório é só uma **cópia de
referência**. O script que realmente roda está publicado em:
`https://script.google.com/u/0/home/projects/1bJ9qNrddP5v3TiNN_zCi6Ka5IzCEwXMgYbMj88GJKvqSfq2SZeK-vrZB/edit`

Se você editar a lógica, precisa colar o código lá também e reimplantar
(**Implantar > Gerenciar implantações > lápis de editar > Versão: Nova versão
> Implantar**), senão o site continua usando a versão antiga.

## Sistema de login e permissões

- **Usuários** ficam guardados na aba `Usuarios_Sistema` da planilha (criada
  automaticamente na primeira execução): usuário, nome, hash da senha (nunca a
  senha em texto puro), papel (`admin`/`user`), lista de abas permitidas e se
  está ativo.
- **Senhas** são guardadas como hash HMAC-SHA256 salgado (nunca em texto
  puro). O segredo usado no hash fica em `PropertiesService` do próprio
  projeto Apps Script.
- **Sessão**: ao logar, o servidor gera um token aleatório válido por 6 horas
  (`CacheService`, o máximo permitido pelo Apps Script). Todo pedido de dados
  precisa desse token.
- **Rate limit de login**: 5 tentativas erradas de senha para o mesmo usuário
  bloqueiam novas tentativas por 15 minutos.
- **Permissão por aba**: o próprio servidor decide quais dados devolver de
  acordo com a permissão do usuário — não é só esconder a aba na tela, um
  usuário sem permissão recebe erro `sem_permissao` mesmo pedindo os dados
  diretamente.
- **Administrador** (`Tr-Carlos`): tem acesso a tudo e vê um botão
  "Administração" que abre um painel para criar novos usuários, editar nome/
  senha/papel/permissões de qualquer usuário e ativar/desativar contas
  (contas desativadas não conseguem mais logar, mas continuam no histórico).

### Limite de segurança real (leia antes de confiar demais nisso)

O Apps Script não é uma plataforma de backend dedicada, então isto é um
**controle de acesso razoável para uso interno**, não segurança de nível
bancário:

- Não existe IP-based rate limit de verdade (o Apps Script não expõe o IP de
  quem chama); o rate limit é por nome de usuário.
- Quem tem acesso de **edição** ao projeto Apps Script (hoje, só o dono da
  conta Google) consegue ler/alterar o código e, em teoria, os hashes/salts
  guardados na planilha — ou seja, a segurança depende de manter o acesso de
  edição da planilha e do script restrito.
- Não há HTTPS customizado, WAF, ou proteção contra abuso em escala; para um
  painel interno de uso da equipe, isso é aceitável.

## Aviso importante sobre privacidade

Desde a implantação do sistema de login, o Apps Script só responde a
requisições **POST** autenticadas (`doGet` sempre devolve erro). Isso já
reduz bastante a exposição em relação à versão anterior (que era pública para
qualquer pessoa com o link). Mesmo assim, a URL do Web App aceita chamadas de
qualquer origem — a proteção real vem do login, não do endereço estar
"escondido".

## Publicar com GitHub Desktop + Vercel

1. **Criar o repositório no GitHub Desktop**
   - Abra o GitHub Desktop → File → Add local repository → selecione esta
     pasta (`remessas-unilog-painel`).
   - Se pedir para inicializar um repositório Git aqui, confirme.
   - Escreva uma mensagem de commit (ex: "Primeira versão do painel") e clique
     em **Commit to main**.
   - Clique em **Publish repository** (escolha público ou privado — privado
     não impede o Vercel de acessar, só esconde o código de terceiros).

2. **Conectar no Vercel**
   - Entre em vercel.com com sua conta (crie uma se não tiver — login com
     GitHub é o mais simples).
   - **Add New... → Project** → selecione o repositório que acabou de subir.
   - Framework: escolha **Other** (não é Next.js/React, é HTML estático).
   - Build Command: deixe em branco. Output Directory: deixe em branco ou
     `.` (raiz).
   - Clique em **Deploy**.

3. Em alguns segundos o Vercel te dá uma URL pública
   (`https://remessas-unilog-painel.vercel.app` ou parecido). É esse link que
   você acessa para ver o painel.

## Atualizando depois

- Mudou algo no `index.html`/`style.css`/`script.js`? Só commitar e dar
  **Push origin** no GitHub Desktop — o Vercel redeploya sozinho a cada push.
- Os *dados* (itens da planilha) não precisam de novo deploy: o site busca a
  planilha em tempo real toda vez que a página é aberta ou quando você clica
  em "Atualizar".
