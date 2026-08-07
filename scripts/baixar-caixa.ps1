# =====================================================================
#  Coleta diaria dos imoveis da Caixa e envio para o GitHub.
#
#  Roda na SUA maquina, nao no GitHub: a protecao anti-bot da Caixa
#  (Radware) responde CAPTCHA para os IPs de datacenter do GitHub Actions,
#  mas aceita normalmente requisicoes vindas do seu IP.
#
#  O que faz, em ordem:
#    1. baixa a lista de imoveis das 27 UFs para a pasta fontes/
#    2. roda o coletor, que junta tudo e grava data.json
#    3. envia o data.json para o GitHub, onde o Pages publica
#
#  Uso manual:  botao direito no arquivo -> "Executar com o PowerShell"
#  Uso diario:  ver o passo do Agendador de Tarefas no README
# =====================================================================

$ErrorActionPreference = 'Stop'

# A pasta do repositorio e a pasta-mae desta ($PSScriptRoot = .../scripts)
$repo = Split-Path -Parent $PSScriptRoot
$fontes = Join-Path $repo 'fontes'

Write-Host "Repositorio: $repo"
Write-Host ""

if (-not (Test-Path $fontes)) { New-Item -ItemType Directory -Path $fontes | Out-Null }

$ufs = @('AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA',
         'PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO')

$ok = 0
$falhas = @()

Write-Host "=== 1/3 Baixando as listas da Caixa ==="

foreach ($uf in $ufs) {
    $url = "https://venda-imoveis.caixa.gov.br/listaweb/Lista_imoveis_$uf.csv"
    $destino = Join-Path $fontes "caixa-$uf.csv"
    try {
        Invoke-WebRequest -Uri $url -OutFile $destino -TimeoutSec 90

        # O servidor pode responder 200 com pagina de CAPTCHA em vez do CSV.
        # Sem esta checagem, o arquivo de bloqueio seria salvo como se fosse dado.
        $primeira = Get-Content $destino -TotalCount 1 -ErrorAction SilentlyContinue
        if ($primeira -notmatch 'Lista de Im') {
            Remove-Item $destino -Force -ErrorAction SilentlyContinue
            $falhas += $uf
            Write-Host "  $uf : BLOQUEADO (resposta nao e o CSV)" -ForegroundColor Yellow
        } else {
            $kb = [math]::Round((Get-Item $destino).Length / 1KB)
            $ok++
            Write-Host "  $uf : ok ($kb KB)"
        }
    } catch {
        $falhas += $uf
        Write-Host "  $uf : ERRO - $($_.Exception.Message)" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds 2   # acesso respeitoso
}

Write-Host ""
Write-Host "Baixadas $ok de $($ufs.Count) UFs."
if ($falhas.Count -gt 0) { Write-Host "Falharam: $($falhas -join ', ')" -ForegroundColor Yellow }

if ($ok -eq 0) {
    Write-Host ""
    Write-Host "Nenhuma UF baixou. Nada a processar - encerrando sem alterar o data.json." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== 2/3 Processando ==="

Set-Location $repo
node "scripts/coletar.mjs"
if ($LASTEXITCODE -ne 0) { Write-Host "O coletor falhou." -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "=== 3/3 Enviando para o GitHub ==="

# Apaga os CSVs baixados: sao grandes e temporarios. So o data.json vai para
# o repositorio. (O .gitignore tambem os exclui, isto aqui e limpeza de disco.)
Remove-Item (Join-Path $fontes 'caixa-*.csv') -Force -ErrorAction SilentlyContinue

git add data.json
git diff --staged --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "Nada mudou hoje - nenhum envio necessario."
} else {
    $hoje = Get-Date -Format 'yyyy-MM-dd'
    git commit -m "dados: coleta automatica $hoje"
    git push
    Write-Host "Enviado. O site sera atualizado em ate 2 minutos." -ForegroundColor Green
}

Write-Host ""
Write-Host "Concluido."
