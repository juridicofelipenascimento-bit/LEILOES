#!/usr/bin/env node
/**
 * Coletor de dados de leilão.
 *
 * Roda diariamente pela GitHub Action e grava o data.json na raiz.
 * A plataforma lê esse arquivo quando é aberta pelo GitHub Pages.
 *
 * COMO FUNCIONA
 *   1. Lê tudo que estiver na pasta `fontes/` (arquivos .csv e .json).
 *   2. Roda os coletores HTTP registrados em `COLETORES_HTTP` (nenhum por padrão).
 *   3. Junta tudo, remove duplicados e grava `data.json`.
 *
 * COMO ALIMENTAR SEM PROGRAMAR NADA
 *   Faça upload dos CSV/JSON que você já recebe (planilha de leiloeiro,
 *   relatório, extração) para a pasta `fontes/`. A cada execução o coletor
 *   incorpora o conteúdo. É o caminho mais simples e não depende de raspagem.
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARQ_SAIDA = path.join(RAIZ, 'data.json');
const DIR_FONTES = path.join(RAIZ, 'fontes');

const STATUS_VALIDOS = ['agendado', 'arrematado', 'finalizado', 'pendente', 'suspenso'];
const OCUPACAO_VALIDAS = ['nao_informado', 'ocupado', 'desocupado', 'litigio'];

/* ------------------------------------------------------------------ *
 * COLETORES HTTP
 *
 * Vazio de propósito. Cada portal tem estrutura e termos de uso próprios,
 * e um coletor não validado contra o site real quebra na primeira mudança
 * de layout — pior, quebra silenciosamente e você confia em dado velho.
 *
 * Para adicionar um, verifique antes:
 *   - o robots.txt e os termos de uso do site permitem acesso automatizado;
 *   - existe endpoint estruturado (JSON) em vez de HTML para raspar;
 *   - o volume de requisições é respeitoso.
 *
 * Formato esperado: função async que devolve array de registros.
 *
 *   const COLETORES_HTTP = [
 *     {
 *       nome: 'Exemplo',
 *       async coletar() {
 *         const r = await fetch('https://exemplo.gov.br/api/leiloes');
 *         if (!r.ok) throw new Error('HTTP ' + r.status);
 *         const json = await r.json();
 *         return json.items.map((i) => ({
 *           endereco: i.logradouro,
 *           municipio: i.cidade,
 *           estado: i.uf,
 *           dataLeilao: i.data,          // AAAA-MM-DD
 *           valorAvaliacao: i.avaliacao,
 *           status: 'agendado',
 *           fonte: 'Exemplo',
 *         }));
 *       },
 *     },
 *   ];
 * ------------------------------------------------------------------ */
const UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
             'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];

const PAUSA = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Caixa Econômica Federal — maior detentora de imóvel retomado do país.
 * Publica uma lista por UF em CSV, atualizada diariamente, sem login.
 *
 * Detalhes que quebram se ignorados:
 *  - o arquivo é Latin-1 (windows-1252), não UTF-8;
 *  - a linha 1 é título; o cabeçalho está na linha 2;
 *  - separador é ";" e os campos vêm com espaços sobrando;
 *  - o site usa proteção anti-bot, então mandamos User-Agent identificável
 *    e uma pausa entre as UFs, para acessar de forma respeitosa.
 */
const coletorCaixa = {
  nome: 'Caixa Econômica Federal',
  async coletar() {
    const out = [];
    for (const uf of UFS) {
      const url = `https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_${uf}.csv`;
      try {
        const resp = await fetch(url, {
          headers: {
            'User-Agent': 'monitor-leiloes/1.0 (uso juridico; contato via repositorio GitHub)',
            'Accept': 'text/csv,*/*',
          },
        });
        if (!resp.ok) { console.error(`    ${uf}: HTTP ${resp.status}`); continue; }

        // Latin-1: decodificar como UTF-8 corromperia todo acento.
        const texto = new TextDecoder('windows-1252').decode(await resp.arrayBuffer());

        // Descarta a linha de título para o cabeçalho real virar a primeira.
        const linhas = texto.split('\n');
        const semTitulo = linhas.slice(1).join('\n');
        const itens = parseCSV(semTitulo);

        itens.forEach((i) => {
          const endereco = txt(i['Endereço']);
          if (!endereco) return;
          const avaliacao = num(i['Valor de avaliação']);
          const preco = num(i['Preço']);
          out.push({
            codigoFonte:    txt(i['N° do imóvel']),
            endereco,
            bairro:         txt(i['Bairro']),
            municipio:      txt(i['Cidade']),
            estado:         txt(i['UF']),
            valorAvaliacao: avaliacao,
            valorMinimo:    preco,
            status:         'agendado',
            ocupacao:       'nao_informado',   // a lista não informa; consta do edital
            fonte:          'Caixa — ' + (txt(i['Modalidade de venda']) || 'venda'),
            link:           txt(i['Link de acesso']),
            notas:          txt(i['Descrição']),
          });
        });
        console.log(`    ${uf}: ${itens.length}`);
      } catch (e) {
        // Uma UF com problema não pode derrubar as outras 26.
        console.error(`    ${uf}: ERRO — ${e.message}`);
      }
      await PAUSA(1500);   // acesso respeitoso
    }
    return out;
  },
};

const COLETORES_HTTP = [coletorCaixa];

/* ---------------------------- utilidades ---------------------------- */

const RE_ACENTOS = new RegExp('[\\u0300-\\u036f]', 'g');
const semAcento = (s) =>
  String(s ?? '').normalize('NFD').replace(RE_ACENTOS, '').toLowerCase();

/**
 * Aceita número puro (feed JSON), formato brasileiro ("150.000,00", ponto é
 * milhar) e formato simples ("57227.73", ponto é decimal). Tratar tudo como
 * brasileiro apagaria o ponto decimal e multiplicaria o valor por 100.
 */
function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === undefined || v === null) return null;
  let s = String(v).trim().replace(/[^\d.,-]/g, '');
  if (!s) return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

const txt = (v) => String(v ?? '').trim();

/** Aceita AAAA-MM-DD e DD/MM/AAAA; devolve sempre AAAA-MM-DD. */
function data(v) {
  const s = txt(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : s;
}

/** CSV com vírgula ou ponto e vírgula, com aspas escapadas. */
function parseCSV(texto) {
  const linhas = [];
  let linha = [], campo = '', aspas = false;
  const cab = texto.split('\n')[0];
  const sep = (cab.match(/;/g) || []).length > (cab.match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  if (!linhas.length) return [];
  const cabecalho = linhas[0].map((h) => h.trim().replace(/^﻿/, ''));
  return linhas.slice(1)
    .filter((l) => l.some((v) => v.trim()))
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] ?? '').trim()])));
}

function normalizar(r) {
  return {
    codigoFonte:    txt(r.codigoFonte),
    endereco:       txt(r.endereco),
    bairro:         txt(r.bairro),
    municipio:      txt(r.municipio),
    estado:         txt(r.estado).toUpperCase().slice(0, 2),
    matricula:      txt(r.matricula),
    processo:       txt(r.processo),
    edital:         txt(r.edital),
    valorAvaliacao: num(r.valorAvaliacao),
    valorMinimo:    num(r.valorMinimo),
    valorLance:     num(r.valorLance),
    dataLeilao:     data(r.dataLeilao),
    status:         STATUS_VALIDOS.includes(r.status) ? r.status : 'agendado',
    ocupacao:       OCUPACAO_VALIDAS.includes(r.ocupacao) ? r.ocupacao : 'nao_informado',
    arrematador:    txt(r.arrematador),
    fonte:          txt(r.fonte),
    link:           txt(r.link),
    notas:          txt(r.notas),
  };
}

/**
 * Mesma regra da plataforma, com o código da fonte na frente: quando a origem
 * já dá um identificador estável (o nº do imóvel da Caixa, por exemplo), ele é
 * mais confiável que qualquer heurística de endereço.
 */
function chave(r) {
  if (r.codigoFonte) return 'c:' + semAcento(r.codigoFonte).replace(/[^a-z0-9]/g, '');
  if (r.matricula) return 'm:' + semAcento(r.matricula).replace(/[^a-z0-9]/g, '');
  if (r.processo)  return 'p:' + semAcento(r.processo).replace(/[^a-z0-9]/g, '');
  const base = semAcento(r.endereco).replace(/[^a-z0-9]/g, '') + '|' +
               semAcento(r.municipio).replace(/[^a-z0-9]/g, '');
  return base.length > 2 ? 'e:' + base + '|' + r.dataLeilao : '';
}

/* ------------------------------ execução ------------------------------ */

async function lerPastaFontes() {
  if (!existsSync(DIR_FONTES)) return [];
  const arquivos = (await readdir(DIR_FONTES))
    .filter((f) => /\.(csv|json)$/i.test(f));
  const out = [];
  for (const nome of arquivos) {
    const bruto = await readFile(path.join(DIR_FONTES, nome), 'utf-8');
    try {
      const itens = nome.toLowerCase().endsWith('.json')
        ? (Array.isArray(JSON.parse(bruto)) ? JSON.parse(bruto) : [JSON.parse(bruto)])
        : parseCSV(bruto);
      // Se o arquivo não trouxer a coluna "fonte", usa o nome do arquivo.
      const rotulo = nome.replace(/\.(csv|json)$/i, '');
      itens.forEach((i) => out.push({ fonte: rotulo, ...i }));
      console.log(`  fontes/${nome}: ${itens.length} registro(s)`);
    } catch (e) {
      console.error(`  fontes/${nome}: ERRO ao interpretar — ${e.message}`);
    }
  }
  return out;
}

async function main() {
  console.log('Coletando...');
  let brutos = [];

  console.log('- pasta fontes/');
  brutos = brutos.concat(await lerPastaFontes());

  for (const c of COLETORES_HTTP) {
    console.log(`- ${c.nome}`);
    try {
      const itens = await c.coletar();
      console.log(`  ${itens.length} registro(s)`);
      brutos = brutos.concat(itens);
    } catch (e) {
      // Um coletor com problema não pode derrubar os outros nem zerar o arquivo.
      console.error(`  ERRO em ${c.nome}: ${e.message}`);
    }
  }

  // Preserva o que já existe: o arquivo é acumulativo, não é substituído.
  let atuais = [];
  if (existsSync(ARQ_SAIDA)) {
    try { atuais = JSON.parse(await readFile(ARQ_SAIDA, 'utf-8')); } catch { atuais = []; }
  }
  if (!Array.isArray(atuais)) atuais = [];

  const porChave = new Map();
  let ignorados = 0;
  [...atuais, ...brutos.map(normalizar)].forEach((r) => {
    if (!r.endereco && !r.matricula) { ignorados++; return; }
    const k = chave(r);
    if (!k) { ignorados++; return; }
    // Registro mais novo sobrescreve o anterior de mesma chave.
    porChave.set(k, { ...(porChave.get(k) || {}), ...r });
  });

  const final = [...porChave.values()]
    .sort((a, b) => String(a.dataLeilao).localeCompare(String(b.dataLeilao)));

  await writeFile(ARQ_SAIDA, JSON.stringify(final, null, 2) + '\n', 'utf-8');
  console.log(`\nGravado data.json — ${final.length} registro(s), ${ignorados} ignorado(s).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
