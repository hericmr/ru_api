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

// Middleware para headers de segurança e utilitários
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// Helper para obter a data atual em São Paulo
function getBrazilDate() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: 'numeric'
    });
    return parseInt(formatter.format(now));
}

async function loadMenu() {
    if (fs.existsSync(CACHE_FILE)) {
        const stats = fs.statSync(CACHE_FILE);
        const pdfStats = fs.existsSync(PDF_FILE) ? fs.statSync(PDF_FILE) : { mtime: 0 };

        // Só usa cache se for mais novo que o PDF
        if (stats.mtime > pdfStats.mtime) {
            try {
                return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            } catch (e) {
                console.error('Erro ao ler cache, reprocessando...');
            }
        }
    }

    if (!fs.existsSync(PDF_FILE)) {
        throw new Error('Arquivo cardapio.pdf não encontrado. Execute o script de atualização.');
    }

    console.log('Analisando PDF e atualizando cache...');
    const menu = await getMenuFromFile(PDF_FILE);

    // Garantir que a pasta cache existe
    const cacheDir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    fs.writeFileSync(CACHE_FILE, JSON.stringify(menu, null, 2));
    return menu;
}

// Rotas Base
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <title>API Cardápio UNIFESP</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; background: #f4f7f6; color: #333; }
                .card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
                code { background: #eee; padding: 2px 5px; border-radius: 4px; font-weight: bold; }
                ul { list-style: none; padding: 0; }
                li { margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #3498db; }
                a { color: #3498db; text-decoration: none; font-weight: bold; }
                a:hover { text-decoration: underline; }
                .footer { margin-top: 30px; font-size: 0.8em; color: #7f8c8d; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🍽️ API de Cardápio UNIFESP</h1>
                <p>Acesse os dados do Restaurante Universitário em formato JSON:</p>
                <ul>
                    <li><code>/cardapio</code> - <a href="/cardapio">Cardápio completo do mês</a></li>
                    <li><code>/cardapio/hoje</code> - <a href="/cardapio/hoje">Cardápio de hoje (Brasília)</a></li>
                    <li><code>/cardapio/:dia</code> - Cardápio de um dia específico (ex: <a href="/cardapio/1">/cardapio/1</a>)</li>
                </ul>
                <div class="footer">
                    <p>Nota: Rotas legadas (/menu) são redirecionadas automaticamente.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.get('/status', (req, res) => {
    const hasPdf = fs.existsSync(PDF_FILE);
    const hasCache = fs.existsSync(CACHE_FILE);
    res.json({
        status: 'online',
        uptime: process.uptime(),
        date_brazil: getBrazilDate(),
        files: { pdf: hasPdf, cache: hasCache }
    });
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

// Redirecionamentos para compatibilidade
app.get(/^\/menu(.*)/, (req, res) => {
    const newPath = req.url.replace('/menu', '/cardapio').replace('today', 'hoje');
    res.redirect(newPath);
});

// Rotas Principais
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
        const hoje = getBrazilDate();

        const almoco = menu.almoco.find(m => m.dia === hoje);
        const jantar = menu.jantar.find(m => m.dia === hoje);

        if (!almoco && !jantar) {
            return res.status(404).json({ mensagem: `Nenhum cardápio encontrado para o dia ${hoje}`, dia: hoje });
        }

        res.json({ dia: hoje, almoco, jantar });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao carregar o cardápio de hoje', detalhes: err.message });
    }
});

app.get('/cardapio/:dia', async (req, res) => {
    try {
        const dia = parseInt(req.params.dia);
        if (isNaN(dia)) return res.status(400).json({ erro: 'Dia inválido' });

        const menu = await loadMenu();
        const almoco = menu.almoco.find(m => m.dia === dia);
        const jantar = menu.jantar.find(m => m.dia === dia);

        if (!almoco && !jantar) {
            return res.status(404).json({ mensagem: `Nenhum cardápio encontrado para o dia ${dia}` });
        }

        res.json({ dia, almoco, jantar });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao carregar dados', detalhes: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
