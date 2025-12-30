import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MENU_PAGE_URL = 'https://unifesp.br/campus/san7/cardapio-mensal';
const TARGET_PDF = path.join(__dirname, '../cardapio.pdf');

const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

async function updateMenu() {
    try {
        const now = new Date();
        // Usar data de São Paulo para verificação
        const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
        const currentMonth = MONTHS[brazilTime.getMonth()];
        const currentYear = brazilTime.getFullYear();

        console.log(`🔍 Verificando cardápio de ${currentMonth}/${currentYear}...`);

        const response_html = await axios.get(MENU_PAGE_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = response_html.data;

        // Regex resiliente: procura .pdf que tenha o nome do mês ou número do mês próximo
        const monthPattern = `(${currentMonth}|${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)})`;
        const linkRegex = new RegExp(`href="([^"]+\\.pdf)"[^>]*>[^<]*${monthPattern}`, 'i');

        const pdfLinkMatch = html.match(linkRegex);

        if (!pdfLinkMatch) {
            console.log(`ℹ️ Link para ${currentMonth} ainda não disponível na página.`);
            return;
        }

        let pdfUrl = pdfLinkMatch[1];
        if (!pdfUrl.startsWith('http')) {
            pdfUrl = new URL(pdfUrl, MENU_PAGE_URL).href;
        }

        console.log(`✅ Novo cardápio encontrado: ${pdfUrl}`);

        const pdfRes = await axios({
            url: pdfUrl,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        const dataBuffer = Buffer.from(pdfRes.data);

        // Verificar integridade e se mudou
        if (fs.existsSync(TARGET_PDF)) {
            const existingBuffer = fs.readFileSync(TARGET_PDF);
            if (existingBuffer.equals(dataBuffer)) {
                console.log('✨ O arquivo local já está atualizado.');
                return;
            }
        }

        fs.writeFileSync(TARGET_PDF, dataBuffer);
        console.log('📥 Download concluído e salvo.');

        // Forçar limpeza do cache para que o parser rode no novo PDF
        const cacheFile = path.join(__dirname, '../cache/menu.json');
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
            console.log('🧹 Cache limpo para atualização.');
        }

    } catch (error) {
        console.error('❌ Erro na automação:', error.message);
        process.exit(1);
    }
}

updateMenu();
