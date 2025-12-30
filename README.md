# UNIFESP RU API

API desenvolvida em Node.js para extrair e servir o cardápio do Restaurante Universitário da UNIFESP (Campus Santo Amaro - SAN7).

## Funcionalidades
- Conversão automática de PDF para JSON estruturado.
- Diferenciação entre prato principal e opção vegetariana.
- Tratamento especial para a "Segunda Vegetariana".
- Sistema de cache local para respostas rápidas.
- Atualização diária automatizada via GitHub Actions.

## Endpoints
- `GET /cardapio`: Retorna todos os dados do mês atual.
- `GET /cardapio/hoje`: Retorna as refeições (almoço e jantar) do dia vigente.
- `GET /cardapio/:dia`: Retorna o cardápio de uma data específica.

## Tecnologias
- Runner: Node.js
- Framework: Express
- Parser: pdf-parse
- Automação: GitHub Actions

## Instalação e Uso
```bash
npm install
node src/index.js
```

## Automação
O sistema monitora diariamente a página oficial de cardápios da UNIFESP. Caso um novo PDF seja detectado, o GitHub Actions realiza o download, processa os dados e atualiza o repositório.

Comando para atualização manual:
```bash
node scripts/update_menu.js
```
