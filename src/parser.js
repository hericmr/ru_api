import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export function parseMenuText(text) {
    const menu = { almoco: [], jantar: [] };

    // Detectar o mês dinamicamente (primeira palavra após "ALMOÇO" ou "JANTAR")
    const monthMatch = text.match(/(?:ALMOÇO|JANTAR)\s+([A-ZÇÃ]+)\b/i);
    const monthName = monthMatch ? monthMatch[1].toUpperCase() : '';

    // Divide em blocos começando com "1 SEG" ou similar
    const blocks = text.split(/(?=\d+\s+(?:SEG|TER|QUA|QUI|SEX|SÁB|DOM))/).filter(b => b.trim().length > 50);

    // Na UNIFESP, geralmente o PDF tem Almoço em algumas páginas e Jantar em outras.
    // O PDFParse junta tudo. Vamos separar pelo cabeçalho.
    const sections = text.split(/(?=JANTAR\s+[A-ZÇÃ]+)/i);
    let almocoText = sections[0] || '';
    let jantarText = sections[1] || '';

    menu.almoco = processSection(almocoText, 'ALMOÇO', monthName);
    menu.jantar = processSection(jantarText, 'JANTAR', monthName);

    return menu;
}

function processSection(sectionText, sectionName, monthName) {
    const days = [];
    if (!sectionText) return days;

    // Split por dia (ex: 1 SEG, 10 TER)
    const dayParts = sectionText.split(/(\d+\s+(?:SEG|TER|QUA|QUI|SEX|SÁB|DOM))/);

    for (let j = 1; j < dayParts.length; j += 2) {
        const dayHeader = dayParts[j].trim();
        let dayContent = dayParts[j + 1].trim();

        // Limpeza básica: remover cabeçalhos de página repetidos
        if (monthName) {
            const monthRegex = new RegExp(`(?:ALMOÇO|JANTAR)\\s+${monthName}.*?\\d{4}`, 'gi');
            dayContent = dayContent.replace(monthRegex, '');
        }
        dayContent = dayContent.split(/-- \d+ of \d+ --/)[0].trim();

        const [dayNum, dayName] = dayHeader.split(/\s+/);
        days.push({
            dia: parseInt(dayNum),
            dia_semana: dayName,
            itens: parseItems(dayContent, dayName)
        });
    }

    // Correções específicas de pratos (Mantendo o que já existia para Dezembro, mas flexível)
    if (monthName === 'DEZEMBRO') {
        const segundas = days.filter(d => d.dia_semana === 'SEG');
        const missingDishes = {
            'ALMOÇO': {
                1: 'PANQUECA DE PTS C/ RICOTA',
                8: 'TORTA VEGETARIANA',
                15: 'HAMBURGUER DE F. PRETO C/ QUEIJO'
            },
            'JANTAR': {
                1: 'PANQUECA DE ESPINAFRE C/ RICOTA',
                8: 'TORTA VEGETARIANA',
                15: 'CHARUTINHO C/ F. FRADINHO'
            }
        };

        segundas.forEach(seg => {
            const fixedDish = missingDishes[sectionName]?.[seg.dia];
            if (fixedDish) {
                seg.itens.opcao_vegetariana = fixedDish;
                if (!seg.itens.bruto.includes(fixedDish)) {
                    seg.itens.bruto += ' ' + fixedDish;
                }
            }
        });
    }

    return days;
}

function parseItems(content, diaSemana) {
    // Normalizar separadores (às vezes o PDF usa múltiplos espaços ou pipes)
    let rawParts = content.split(/[|]{2,}/).map(p => p.trim()).filter(p => {
        return p.length > 0 && !(/^\d+$/.test(p) && p.length < 3);
    });

    const joinTermsSuffix = [
        'INTEGRAL', 'ROXO', 'PRETO', 'ACEBOLADO', 'REFOGADA', 'REFOGADO', 'ASSADA', 'ASSADO',
        'AO M.', 'C/ MARGARINA', 'C/ QUEIJO', 'AO ALHO', 'AO SUGO', 'C/ PIMENTÃO', 'A VINAGRETE',
        'FRADINHO', 'COZIDA', 'COZIDO', 'PIZZAIOLO', 'M. INGLES', 'M. DE LIMÃO'
    ];

    let parts = [];
    for (let part of rawParts) {
        if (parts.length === 0) { parts.push(part); continue; }
        const last = parts[parts.length - 1];
        let shouldJoin = false;

        // Regras de concatenação para pratos que o PDF divide em linhas/blocos errados
        if (part.startsWith('(') || joinTermsSuffix.some(term => part.startsWith(term))) shouldJoin = true;
        else if (last.endsWith('C/') || last.endsWith('/') ||
            /\b(DE|AO|A|NO|NA|DO|DA|DOS|DAS)$/i.test(last)) shouldJoin = true;

        if (shouldJoin) parts[parts.length - 1] += ' ' + part;
        else parts.push(part);
    }

    const itens = {
        bruto: parts.join(' '),
        arroz: parts[0] || null,
        feijao: parts[1] || null,
        saladas: parts.slice(2, 4),
        prato_principal: null,
        opcao_vegetariana: null,
        guarnicao: null,
        sobremesa: parts[parts.length - 1] || null
    };

    // Lógica de atribuição baseada na posição (pode variar se o PDF mudar muito)
    if (diaSemana === 'SEG') {
        itens.prato_principal = "Segunda Vegetariana";
        itens.opcao_vegetariana = parts[4] || null;
        if (parts.length > 6) itens.guarnicao = parts[parts.length - 2];
    } else {
        itens.prato_principal = parts[4] || null;
        itens.opcao_vegetariana = parts[5] || null;
        let pG = parts[6] || null;
        if (pG && pG !== itens.sobremesa) itens.guarnicao = pG;
    }
    return itens;
}

export async function getMenuFromFile(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfParser = new PDFParse({ data: dataBuffer });
    const data = await pdfParser.getText({ itemJoiner: '||' });
    return parseMenuText(data.text);
}
