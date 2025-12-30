# UNIFESP RU API

API para extração e disponibilização dos dados do cardápio do Restaurante Universitário da UNIFESP (Campus Santo Amaro - SAN7).

## Funcionalidades

- Extração de dados de arquivos PDF oficiais.
- Tratamento automático de regras específicas (ex: Segunda Vegetariana).
- Sistema de cache local em JSON para otimização de performance.
- Automação diária para verificação e download de novos cardápios.

## Endpoints

### GET /cardapio
Retorna o cardápio completo do mês atual em formato JSON.

### GET /cardapio/hoje
Retorna as opções de almoço e jantar para o dia atual.

### GET /cardapio/:dia
Retorna o cardápio de um dia específico do mês.

## Estrutura do Projeto

- `src/index.js`: Ponto de entrada da API Express.
- `src/parser.js`: Lógica de extração e processamento do PDF.
- `scripts/update_menu.js`: Script de scraping para atualização de dados.
- `.github/workflows/update_menu.yml`: Configuração do GitHub Actions para execução diária.

## Requisitos e Instalação

### Pré-requisitos
- Node.js 20 ou superior
- npm

### Instalação
```bash
npm install
```

### Execução Local
```bash
node src/index.js
```

## Automação

O projeto utiliza GitHub Actions para manter os dados atualizados. O workflow executa diariamente:
1. Verifica a página oficial de cardápios da UNIFESP SAN7.
2. Identifica o link do PDF referente ao mês vigente.
3. Se houver um novo arquivo ou alterações, realiza o download e atualiza o repositório automaticamente.

Para disparar a atualização manualmente:
```bash
node scripts/update_menu.js
```

## Licença
ISC
