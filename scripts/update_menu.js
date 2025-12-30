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
        const currentMonth = MONTHS[now.getMonth()];
        const currentYear = now.getFullYear();
        
        console.log(`Buscando cardápio de ${currentMonth}/${currentYear}...`);
        console.log(`URL: ${MENU_PAGE_URL}`);
        
        const { data: html } = await axios.get(MENU_PAGE_URL);

        // Regex flexível para encontrar o link que contém o mês atual
        // Ex: "Cardápio - dezembro/2025" ou "Cardápio de Dezembro"
        const linkRegex = new RegExp(`href="([^"]+\\.pdf)"[^>]*>[^<]*(${currentMonth}|${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)})`, 'i');
        const pdfLinkMatch = html.match(linkRegex);

        if (!pdfLinkMatch) {
            console.log(`Ainda não há link para o mês de ${currentMonth}. Verificação diária continuará.`);
            return;
        }

        let pdfUrl = pdfLinkMatch[1];
        if (!pdfUrl.startsWith('http')) {
            pdfUrl = new URL(pdfUrl, MENU_PAGE_URL).href;
        }

        console.log(`Novo cardápio detectado! Baixando de: ${pdfUrl}`);
        const response = await axios({
            url: pdfUrl,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        const dataBuffer = Buffer.from(response.data);

        // Verificar se o arquivo já existe e é igual (evitar commits inúteis)
        if (fs.existsSync(TARGET_PDF)) {
            const existingBuffer = fs.readFileSync(TARGET_PDF);
            if (existingBuffer.equals(dataBuffer)) {
                console.log('O cardápio atual já é o mais recente. Nenhuma alteração necessária.');
                return;
            }
        }

        fs.writeFileSync(TARGET_PDF, dataBuffer);
        console.log('Download concluído e salvo em cardapio.pdf');

        // Limpar cache
        const cacheFile = path.join(__dirname, '../cache/menu.json');
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
            console.log('Cache limpo para re-processamento.');
        }

    } catch (error) {
        console.error('Erro ao verificar/atualizar cardápio:', error.message);
        process.exit(1);
    }
}

updateMenu();
