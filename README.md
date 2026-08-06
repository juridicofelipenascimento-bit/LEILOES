# Monitor de Leilões Imobiliários

Plataforma para acompanhar imóveis em leilão em escala nacional, com ficha de
arrematador, ficha de ocupante e atualização diária automática.

---

# Parte 1 — Usar agora, sem instalar nada

Dê duplo clique em **`plataforma.html`**. Só isso. Funciona offline.

Para testar: aba **Backup e dados → Carregar exemplos**.

Os dados ficam no navegador deste computador. **Limpar o histórico apaga tudo** —
exporte backup pela aba Backup e dados com frequência.

---

# Parte 2 — Passo a passo do GitHub (atualização automática)

## Por que precisa disso

Um arquivo aberto por `file://` **não consegue fazer requisição de rede**. O
navegador bloqueia por segurança. A página que você abre com duplo clique nunca
vai buscar dados sozinha — não é limitação desta implementação, é o navegador.

Publicando no GitHub Pages, a página passa a rodar em HTTPS e **pode** ler um
arquivo de dados que uma rotina diária mantém atualizado.

## Passo 1 — Criar a conta e o repositório

1. Crie uma conta em <https://github.com> (gratuita), se ainda não tiver.
2. Clique em **New repository** (botão verde, canto superior direito → New).
3. Nome sugerido: `leiloes`.
4. Marque **Public**.
   *Se marcar Private, o GitHub Pages exige plano pago.*
5. Clique em **Create repository**.

> ⚠️ Repositório público significa que **qualquer pessoa vê o conteúdo**.
> Não suba nada com dado pessoal. O `data.json` é o feed de imóveis; suas fichas
> de ocupante e anotações ficam **só no seu navegador** e nunca sobem — o
> `.gitignore` já bloqueia os backups exportados.

## Passo 2 — Subir os arquivos

> ⚠️ **O navegador esconde pastas que começam com ponto.** As pastas `.github`,
> e os arquivos `.nojekyll` e `.gitignore` **não sobem** por arrastar-e-soltar.
> Foi por isso que a implantação falhou. Use um dos dois caminhos abaixo.

### Caminho A — GitHub Desktop (recomendado, resolve tudo)

1. Instale o [GitHub Desktop](https://desktop.github.com) e entre com sua conta.
2. **File → Clone repository** → escolha o repositório que você criou → **Clone**.
3. Abra a pasta clonada e **copie para dentro dela todo o conteúdo** de
   `leiloes-imoveis` (no Windows, ative *Exibir → Itens ocultos* no Explorador
   para enxergar `.github`, `.nojekyll` e `.gitignore`).
4. Volte ao GitHub Desktop: escreva "primeira versão" e clique em
   **Commit to main** → **Push origin**.

### Caminho B — Só pelo site (se não quiser instalar nada)

1. **Add file → Upload files** e arraste apenas os arquivos e pastas *sem*
   ponto no nome: `plataforma.html`, `index.html`, `data.json`, `README.md`,
   `scripts/`, `fontes/`. **Commit changes**.
2. Agora crie os que faltam, um por um, digitando o **caminho completo** —
   ao digitar `/` o GitHub cria a pasta sozinho:

   **Add file → Create new file**, nome exato:
   ```
   .nojekyll
   ```
   Deixe o conteúdo vazio. **Commit changes**.

3. **Add file → Create new file**, nome exato:
   ```
   .github/workflows/atualizar-dados.yml
   ```
   Cole dentro o conteúdo do arquivo `.github/workflows/atualizar-dados.yml`
   desta pasta (abra com o Bloco de Notas). **Commit changes**.

4. Confira: na página inicial do repositório devem aparecer as pastas
   `.github`, `fontes`, `scripts` e os arquivos `.nojekyll`, `data.json`,
   `index.html`, `plataforma.html`.

> **Por que `.nojekyll` é obrigatório:** o GitHub Pages processa o site com
> Jekyll por padrão, e o Jekyll descarta pastas iniciadas por `_` e pode falhar
> o build. Esse arquivo vazio desliga o Jekyll e publica os arquivos como estão.

## Passo 3 — Ligar o GitHub Pages

1. No repositório: **Settings** (engrenagem no topo) → **Pages** (menu esquerdo).
2. Em **Source**, escolha **Deploy from a branch**.

   > ⚠️ **Não escolha "GitHub Actions" aqui.** É o padrão que o GitHub sugere e
   > é a segunda causa mais comum de falha na implantação: essa opção espera um
   > workflow de publicação que este projeto não usa, e o deploy quebra. Se você
   > já selecionou, troque para **Deploy from a branch** agora.

3. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique em **Save**.
4. Espere 1 a 2 minutos e recarregue a página. Vai aparecer o endereço:

   `https://SEU-USUARIO.github.io/leiloes/`

**Esse é o link que você vai usar daqui em diante.** Salve nos favoritos, no
computador e no celular.

## Passo 4 — Autorizar a rotina a gravar

1. **Settings** → **Actions** → **General**.
2. Role até **Workflow permissions**.
3. Marque **Read and write permissions** e clique em **Save**.

Sem isso a rotina roda mas não consegue gravar o resultado.

## Passo 5 — Testar a rotina

1. Vá na aba **Actions** do repositório.
2. Se aparecer um aviso pedindo para habilitar, clique em
   **I understand my workflows, go ahead and enable them**.
3. No menu esquerdo, clique em **Atualizar dados de leilão**.
4. Clique em **Run workflow → Run workflow** (botão cinza à direita).
5. Em ~30 segundos aparece um ✅. Clique nele para ver o log.

Daí em diante roda sozinha **todo dia às 6h da manhã** (horário de Brasília).
Para mudar o horário, edite a linha `cron` em
`.github/workflows/atualizar-dados.yml` — o valor está em UTC, que é 3 horas à
frente de Brasília.

## Passo 6 — Alimentar com dados

Este é o passo que você repete no dia a dia.

1. No repositório, entre na pasta **`fontes`**.
2. **Add file → Upload files**.
3. Suba o CSV ou JSON que você já recebe (planilha de leiloeiro, relatório,
   extração, lista que você montou).
4. **Commit changes**.

Na próxima execução — ou rodando na mão pelo Passo 5 — o coletor incorpora o
arquivo ao `data.json`. Abra o link do Passo 3 e os imóveis novos aparecem
marcados como **NÃO LIDOS**.

Detalhes de colunas e formatos: [`fontes/LEIA-ME.md`](fontes/LEIA-ME.md).

## Passo 7 (opcional) — Coletores automáticos de portais

O arquivo [`scripts/coletar.mjs`](scripts/coletar.mjs) tem um espaço marcado
`COLETORES_HTTP`, hoje vazio de propósito, com um exemplo comentado do formato.

Está vazio porque um coletor não validado contra o site real quebra na primeira
mudança de layout — e quebra em silêncio, deixando você confiando em dado velho.
Antes de adicionar qualquer portal, confira o `robots.txt` e os termos de uso, e
prefira endpoint estruturado (JSON) a raspar HTML.

---

# O que a plataforma faz

## Painel
- Busca em endereço, bairro, município, matrícula, processo, edital,
  arrematador, fonte e anotações — **ignora acentos e maiúsculas** (atalho: `/`).
- Filtros combináveis: leitura, status, etapa, ocupação, período, UF, fonte,
  faixa de valor.
- Ordenação por qualquer coluna.
- Indicadores: total, não lidos, leilões em menos de 7 dias, arrematados,
  deságio médio, avaliação somada do filtro.
- Destaque vermelho automático para leilão em menos de 7 dias.
- Deságio calculado por imóvel.

## Lido / não lido
Todo registro que chega pelo feed ou por importação entra como **NÃO LIDO**
(bolinha + negrito). Abrir marca como lido. Dá para reverter ou marcar em lote.

## Etapas
Novo · Qualificação · Em contato · Reunião marcada · Reunião realizada ·
Follow up · Encerrado. Mudanças ficam no histórico de cada imóvel.

## Ocupação
`Ocupado` · `Desocupado` · `Em disputa possessória` · `Não informado`.

A fonte é o **próprio edital** — a declaração de ocupação é conteúdo obrigatório
do edital de leilão judicial, porque afeta o lance. Você não precisa descobrir
quem mora lá para saber se há morador.

## Ficha do ocupante
Quando o imóvel está **Ocupado** ou **Em disputa**, o selo vira clicável e abre
a ficha: nome, vínculo (executado, locatário, comodatário, terceiro, antigo
proprietário), documento, telefone, e-mail, **origem da informação** e anotações.

**Preenchimento é manual.** A ficha traz dois blocos de apoio:
- *Onde encontrar cada informação* — a fonte documental de cada dado.
- *Consultar a partir deste registro* — links de busca gerados com o número do
  processo e o município do próprio registro.

O campo **origem** existe para você responder, meses depois, de onde veio aquele
dado. É o que separa ficha de caso de base irregular.

## Ficha do arrematador
Criada **sozinha** para todo nome que aparecer como arrematador. O nome vira
link na tabela. Cada ficha mostra imóveis arrematados, total investido, deságio
médio e UFs — o que revela quem compra com recorrência.

Detecção automática de pessoa jurídica pelo nome (Ltda, S/A, Construtora,
Incorporadora, Fundo…). Quando não dá para saber, fica "não definido" — não chuta.

## Outros
Timeline dos próximos leilões · importação CSV/JSON com deduplicação ·
backup e restauração · modo escuro · responsivo · exportar CSV · exportar PDF
(`Ctrl+P`).

---

# Deduplicação

Reimportar a mesma planilha **atualiza** em vez de duplicar. A correspondência é:

1. mesma `matricula`, ou
2. mesmo `processo`, ou
3. sem nenhum dos dois: mesmo `endereco` + `municipio` + `dataLeilao`,
   ignorando acentos, maiúsculas e pontuação.

1ª e 2ª praça do mesmo imóvel têm datas diferentes, então continuam sendo
registros distintos — que é o correto.

**Importar não apaga seu trabalho.** Campo que chega vazio significa "a planilha
não informa isso", e o valor existente é mantido. Suas anotações, etapa e fichas
sobrevivem. Só o que vier preenchido sobrescreve. (Na edição manual é o
contrário: apagar um campo limpa mesmo.)

---

# Estrutura de arquivos

```
leiloes-imoveis/
├── plataforma.html                       a plataforma inteira
├── index.html                            encaminha para ela (GitHub Pages)
├── data.json                             feed, mantido pela rotina diária
├── .nojekyll                             OBRIGATÓRIO no GitHub (desliga o Jekyll)
├── .gitignore
├── fontes/                               ← suba aqui seus CSV/JSON
│   └── LEIA-ME.md
├── scripts/coletar.mjs                   o coletor
├── .github/workflows/atualizar-dados.yml a rotina diária
└── arquivo-versao-antiga/                protótipo antigo; pode apagar
```

> A pasta antiga chamava-se `_versao-servidor-legada`. Renomeei porque o
> Jekyll, do GitHub Pages, trata pastas iniciadas por `_` como diretórios
> internos dele — o que atrapalha a publicação.

---

# Se der erro na implantação

Vá em **Actions** no repositório e clique na execução com ❌ para ver o log.
Os três erros comuns, em ordem de frequência:

### "Page build failed" / o site não abre

Quase sempre é o **`.nojekyll` faltando**. Confirme que ele existe na raiz do
repositório — é um arquivo **vazio**, e o navegador **não** o envia por
arrastar-e-soltar. Crie pelo site: **Add file → Create new file**, nome
`.nojekyll`, conteúdo vazio, **Commit changes**.

Segunda causa: **Source** configurado como *GitHub Actions* em vez de
*Deploy from a branch*. Corrija em **Settings → Pages** (Passo 3).

### A aba Actions está vazia, ou o workflow não aparece

A pasta `.github` não subiu — o navegador esconde pastas com ponto. Refaça o
**Caminho B do Passo 2**, item 3, criando o arquivo pelo caminho completo.

### O workflow roda mas falha em "Gravar alterações"

Faltou o **Passo 4**: **Settings → Actions → General → Workflow permissions →
Read and write permissions → Save**. A mensagem no log costuma ser
`Permission to ... denied` ou `403`.

### O site abre mas não carrega dados

Normal se o `data.json` estiver vazio (`[]`) — é como ele nasce. Suba um
arquivo em `fontes/` e rode o workflow (Passos 5 e 6). A aba **Backup e dados**
mostra o status da leitura do feed.

> **Sobre a execução diária:** o GitHub só roda agendamento no branch padrão, e
> **desativa agendamentos após 60 dias sem atividade** no repositório. Se o feed
> parar de atualizar sozinho depois de um tempo, entre em Actions e clique em
> **Enable workflow**.

---

# Responsabilidade sobre os dados

A plataforma trabalha com dados **do imóvel e do leilão** — endereço, matrícula,
processo, edital, datas, avaliação, lance, ocupação e o nome do arrematador
conforme o auto público.

Ela **não busca, cruza nem preenche automaticamente** dados pessoais de
terceiros. As fichas de ocupante e de arrematador PF são de digitação manual,
por três razões independentes:

1. **Não há fonte que confirme o vínculo.** Não existe base pública ligando nome
   a telefone. Número achado em rede social ou anúncio não prova ser da mesma
   pessoa do processo, e homonímia no Brasil é massiva. O resultado seria
   palpite com aparência de dado confirmado.
2. **A coleta é o ato regulado, não o uso.** Guardar já é tratamento (LGPD) e
   exige base legal no momento em que o dado entra na base. O art. 6º, III ainda
   impõe necessidade: só o mínimo para a finalidade. E dado público não é livre —
   a agregação de dados públicos em perfil tem tratamento próprio (art. 12, §3º).
3. **Captação.** Abordar quem está envolvido em processo para oferecer serviço é
   vedado pelo art. 7º do Código de Ética da OAB.

Para **negociar recompra**, o canal correto é o processo: o arrematador é parte,
alcançável por petição ou pelo leiloeiro oficial — contato formal, registrado,
que a outra parte é obrigada a receber.

Para **amparar morador em risco**, o caminho lícito é ser encontrável por ele:
convênio com a Defensoria Pública, núcleo de prática, parceria com associações
de moradores. A pessoa chega com consentimento e você atende sem risco
disciplinar.

O que você digita nas fichas é decisão e responsabilidade profissional sua.

---

# Ideias para evoluir

1. **Campos de 1ª e 2ª praça** separados, com datas e lances mínimos — é como o
   edital costuma vir.
2. **Anexos** (edital em PDF, matrícula) vinculados ao registro.
3. **Responsável por imóvel**, com filtro "meus imóveis", quando houver equipe.
4. **Alerta por e-mail** quando um leilão entra na janela de 7 dias — dá para
   fazer na própria GitHub Action.
5. **Autor no histórico** — hoje registra a ação, não quem fez; passa a fazer
   falta com várias pessoas.
6. **Base compartilhada** (SQLite/Postgres) se virar ferramenta de equipe.
