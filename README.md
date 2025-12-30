# UNIFESP RU API

API para consulta do cardápio do RU (Campus Santo Amaro).

## Endpoints
- `/cardapio`: Mensal completo.
- `/cardapio/hoje`: Cardápio do dia.
- `/cardapio/:dia`: Dia específico.

## Instalação e Uso
```bash
npm install
node src/index.js
```

## Automação
O projeto utiliza GitHub Actions para baixar o PDF oficial diariamente e atualizar os dados automaticamente. Para atualizar manualmente, execute: `node scripts/update_menu.js`.
