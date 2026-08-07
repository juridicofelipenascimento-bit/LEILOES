# Pasta de fontes

Coloque aqui os arquivos **.csv** ou **.json** que você já recebe: planilha de
leiloeiro, relatório, extração de portal, lista que você mesmo montou.

A cada execução, o coletor lê tudo o que estiver nesta pasta e incorpora ao
`data.json`. Não precisa programar nada — é só subir o arquivo pelo site do
GitHub (botão **Add file → Upload files**).

## Colunas reconhecidas

```
endereco, bairro, municipio, estado, matricula, processo, edital,
valorAvaliacao, valorLance, dataLeilao, status, ocupacao, arrematador,
fonte, link, notas
```

- `status`: `agendado` · `arrematado` · `finalizado` · `pendente` · `suspenso`
- `ocupacao`: `ocupado` · `desocupado` · `litigio` · `nao_informado`
- `dataLeilao`: aceita `2026-09-01` ou `01/09/2026`
- valores aceitam `350000` ou `350.000,00`

Colunas que faltarem ficam vazias. Colunas a mais são ignoradas.

## Como o arquivo é identificado

Se o arquivo não trouxer a coluna `fonte`, o coletor usa o **nome do arquivo**
como fonte. Então nomeie de forma útil: `sodre-santoro-set2026.csv` fica melhor
que `planilha1.csv`.

## Duplicados

Registro com a mesma `matricula` — ou o mesmo `processo`, ou o mesmo
`endereco` + `municipio` + `dataLeilao` — é tratado como o mesmo imóvel e
**atualizado**, não duplicado. Pode subir a mesma planilha de novo sem medo.
