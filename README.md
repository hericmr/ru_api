# UNIFESP RU API

API RESTful para consulta do cardápio do Restaurante Universitário da UNIFESP (Campus BS).

## Endpoints

- `GET /cardapio` - Cardápio completo do mês
- `GET /cardapio/hoje` - Refeições do dia (almoço e jantar)
- `GET /cardapio/:dia` - Cardápio de data específica

## Tecnologias

- Runtime: Node.js
- Framework: Express
- Parser: pdf-parse
- CI/CD: GitHub Actions

## Instalação

```bash
npm install
node src/index.js
```

## Atualização

O sistema verifica diariamente novos PDFs na página oficial da UNIFESP e atualiza automaticamente via GitHub Actions.

Atualização manual:

```bash
node scripts/update_menu.js
```

## Características

- Conversão automática PDF → JSON
- Cache local para performance
- Atualização automatizada
