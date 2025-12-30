import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenuFromFile } from './parser.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_FILE = path.join(__dirname, '../cache/menu.json');
const PDF_FILE = path.join(__dirname, '../cardapio.pdf');

app.use(cors());
app.use(express.json());

// Middleware para evitar erros de CSP no favicon e fornecer headers básicos
app.use((req, res, next) => {
    // Relaxando CSP para facilitar o uso local e permitir o favicon em data:
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

async function loadMenu() {
    if (fs.existsSync(CACHE_FILE)) {
        const stats = fs.statSync(CACHE_FILE);
        const pdfStats = fs.statSync(PDF_FILE);

        if (stats.mtime > pdfStats.mtime) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
        }
    }

    console.log('Analisando PDF e atualizando cache...');
    const menu = await getMenuFromFile(PDF_FILE);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(menu, null, 2));
    return menu;
}

// Rotas Base
app.get('/', (req, res) => {
    res.send(`
        <h1>API de Cardápio UNIFESP</h1>
        <p>Endpoints disponíveis:</p>
        <ul>
            <li><a href="/cardapio">/cardapio</a> - Cardápio completo do mês</li>
            <li><a href="/cardapio/hoje">/cardapio/hoje</a> - Cardápio de hoje</li>
            <li><a href="/cardapio/1">/cardapio/:dia</a> - Cardápio de um dia específico (ex: /cardapio/1)</li>
        </ul>
        <hr>
        <p><small>Nota: Rotas antigas em inglês (/menu, /menu/today) agora redirecionam automaticamente para as novas.</small></p>
    `);
});

app.get('/favicon.ico', (req, res) => {
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'public, max-age=604800'
    });
    res.end(pixel);
});

// Redirecionamentos para compatibilidade (Legacy Support)
app.get('/menu', (req, res) => res.redirect('/cardapio'));
app.get('/menu/today', (req, res) => res.redirect('/cardapio/hoje'));
app.get('/menu/:dia', (req, res) => res.redirect(`/cardapio/${req.params.dia}`));

// Rotas Principais (PT-BR)
app.get('/cardapio', async (req, res) => {
    try {
        const menu = await loadMenu();
        res.json(menu);
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao carregar o cardápio', detalhes: err.message });
    }
});

app.get('/cardapio/hoje', async (req, res) => {
    try {
        const menu = await loadMenu();
        const hoje = new Date().getDate();

        const almoco = menu.almoco.find(m => m.dia === hoje);
        const jantar = menu.jantar.find(m => m.dia === hoje);

        if (!almoco && !jantar) {
            return res.status(404).json({ mensagem: `Nenhum cardápio encontrado para o dia ${hoje}` });
        }

        res.json({ dia: hoje, almoco, jantar });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao carregar o cardápio de hoje', detalhes: err.message });
    }
});

app.get('/cardapio/:dia', async (req, res) => {
    try {
        const dia = parseInt(req.params.dia);
        if (isNaN(dia)) {
            return res.status(400).json({ erro: 'Parâmetro de dia inválido' });
        }

        const menu = await loadMenu();
        const almoco = menu.almoco.find(m => m.dia === dia);
        const jantar = menu.jantar.find(m => m.dia === dia);

        if (!almoco && !jantar) {
            return res.status(404).json({ mensagem: `Nenhum cardápio encontrado para o dia ${dia}` });
        }

        res.json({ dia, almoco, jantar });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao carregar o cardápio para o dia ' + req.params.dia, detalhes: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
