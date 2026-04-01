import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export function parseMenuText(text) {
    const menu = { almoco: [], jantar: [] };

    // Detectar blocos de Almoço e Jantar de forma mais resiliente
    // Procuramos pelas palavras ALMOÇO e JANTAR seguidas do mês/ano
    const almocoMatch = text.match(/ALMOÇO\s+([A-ZÇÃ]+)\s*[–-]?\s*(\d{4})/i);
    const jantarMatch = text.match(/JANTAR\s+([A-ZÇÃ]+)\s*[–-]?\s*(\d{4})/i);

    const almocoMonth = almocoMatch ? almocoMatch[1].toUpperCase() : '';
    const jantarMonth = jantarMatch ? jantarMatch[1].toUpperCase() : '';

    // 1. Tentar dividir por "DATA||" (comum no cardápio de Santos)
    const sections = text.split(/DATA\s*\|\|/i).filter(s => s.toLowerCase().includes('arroz'));
    
    let almocoContent = '';
    let jantarContent = '';

    if (sections.length >= 2) {
        // Se temos duas ou mais seções com header, a primeira é Almoço e as subsequentes Jantar
        // ou se for um PDF de 2 páginas, pode ser 1 página Almoço e 1 Jantar
        almocoContent = sections[0];
        // Junta o resto como Jantar (caso Jantar tenha mais páginas)
        jantarContent = sections.slice(1).join(' ');
    } else {
        // 2. Fallback: Tentar dividir por marcadores de página ou palavras-chave
        const pageSplit = text.split(/-- \d+ of \d+ --/);
        if (pageSplit.length >= 2) {
            almocoContent = pageSplit[0];
            jantarContent = pageSplit.slice(1).join(' ');
        } else {
            // 3. Fallback final: Procurar por JANTAR
            const jantarIdx = text.search(/JANTAR/i);
            if (jantarIdx !== -1) {
                almocoContent = text.substring(0, jantarIdx);
                jantarContent = text.substring(jantarIdx);
            } else {
                almocoContent = text;
            }
        }
    }

    menu.almoco = processSection(almocoContent, 'ALMOÇO', almocoMonth);
    menu.jantar = processSection(jantarContent, 'JANTAR', jantarMonth);

    // Mover itens flutuantes para uma propriedade global se encontrados
    if (menu.almoco.floating) {
        menu.almoco_extras = menu.almoco.floating;
        delete menu.almoco.floating;
    }
    if (menu.jantar.floating) {
        menu.jantar_extras = menu.jantar.floating;
        delete menu.jantar.floating;
    }

    // Achatar para arrays simples (compatibilidade com frontend)
    const result = {
        almoco: menu.almoco.days || [],
        jantar: menu.jantar.days || [],
        almoco_extras: menu.almoco_extras || [],
        jantar_extras: menu.jantar_extras || []
    };

    return result;
}

function processSection(sectionText, sectionName, monthName) {
    const result = { days: [], floating: [] };
    if (!sectionText || sectionText.length < 50) return result;

    // Limpeza de ruídos
    let cleanText = sectionText
        .replace(/-- \d+ of \d+ --/g, '')
        .replace(/DATA\|\|/gi, '');

    // Split por dia (ex: 1 SEG, 10 TER, 01 QUA)
    const dayParts = cleanText.split(/(\d{1,2})\s+(SEG|TER|QUA|QUI|SEX|SÁB|DOM)\b/i);

    // Itens flutuantes (muitas vezes PVs ou Substitutos no final do PDF)
    const tailText = dayParts[dayParts.length - 1] || '';
    result.floating = tailText.split(/[|]+/)
        .map(p => p.trim())
        .filter(p => p.length > 5 && 
                    !/ALMOÇO|JANTAR|DATA|ARROZ|FEIJÃO|SALADA|PRATO|GUARNIÇÃO|SOBREMESA/i.test(p) &&
                    !/BRANCO|INTEGRAL|CARIOCA|PRETO/i.test(p) &&
                    !/^\d+$/.test(p) &&
                    !/FERIADO|NÃO LETIVO|RECESSO/i.test(p));

    for (let j = 1; j < dayParts.length; j += 3) {
        const dayNum = parseInt(dayParts[j]);
        const dayName = dayParts[j + 1].toUpperCase();
        let dayContent = dayParts[j + 2].trim();

        const parsedItens = parseItems(dayContent, dayName);

        // Se o bruto for muito curto (provável feriado ou dia vazio)
        if (parsedItens.bruto.length < 10) {
            const holidayRegex = /FERIADO|NÃO\s*LETIVO|RECESSO|PONTE/i;
            const isNoisy = dayContent.length < 15 || /^[|\s]*$/.test(dayContent);
            
            if (holidayRegex.test(dayContent) || (isNoisy && holidayRegex.test(tailText))) {
                 result.days.push({ 
                     dia: dayNum, 
                     dia_semana: dayName, 
                     status: "FERIADO/NÃO LETIVO", 
                     itens: null 
                 });
            }
            continue;
        }

        result.days.push({
            dia: dayNum,
            dia_semana: dayName,
            itens: parsedItens
        });
    }

    // Pós-processamento para segundas-feiras (mapear itens flutuantes se faltarem)
    const mondays = result.days.filter(d => d.dia_semana === 'SEG' && d.itens);
    // Filtrar itens flutuantes que pareçam PVs (geralmente contêm PTS, VEGETARIANO, BOLINHO, KIBE, OVO, PANQUECA)
    const possiblePVs = result.floating.filter(item => 
        /PTS|VEGET|BOLINHO|KIBE|OVO|PANQUECA|TORTA|GRÃO|LENTILHA/i.test(item)
    );

    if (mondays.length > 0 && possiblePVs.length > 0) {
        mondays.forEach((monday, idx) => {
            // Se na nossa análise o PV ficou nulo ou parece ser a guarnição, tentamos usar o floating
            const itens = monday.itens;
            if (possiblePVs[idx]) {
                // Se temos um item flutuante para esta segunda, ele assume o lugar do PV
                // Se já tínhamos algo no lugar do PV que parece guarnição, movemos para guarnição
                if (itens.opcao_vegetariana && !itens.guarnicao) {
                    itens.guarnicao = itens.opcao_vegetariana;
                }
                itens.opcao_vegetariana = possiblePVs[idx];
            }
        });
    }

    return result;
}

function parseItems(content, diaSemana) {
    // Limpar o conteúdo de restos de headers e pipes extras
    let rawParts = content.split(/[|]+/)
        .map(p => p.trim())
        .filter(p => {
            return p.length > 0 && 
                   !/^(ARROZ|FEIJÃO|SALADA|PRATO|GUARNIÇÃO|SOBREMESA|DATA|DATA\s*\|\|)$/i.test(p) &&
                   !/^\d+$/.test(p) &&
                   !/ALMOÇO|JANTAR/i.test(p);
        });

    const joinTermsSuffix = [
        'INTEGRAL', 'ROXO', 'PRETO', 'ACEBOLADO', 'REFOGADA', 'REFOGADO', 'ASSADA', 'ASSADO',
        'AO M.', 'C/ MARGARINA', 'C/ QUEIJO', 'AO ALHO', 'AO SUGO', 'C/ PIMENTÃO', 'A VINAGRETE',
        'FRADINHO', 'COZIDA', 'COZIDO', 'PIZZAIOLO', 'M. INGLES', 'M. INGLÊS', 'M. DE LIMÃO', 'M. BARBECUE', 'SHOYO',
        'NA MANTEIGA', 'AO BARBECUE', 'A PORTUGUESA', 'COM SALSÃO', 'C/ SALSÃO', 'AO SUGO', 'C/ HORTELÃ', 'SAUTE'
    ];

    let parts = [];
    for (let part of rawParts) {
        if (parts.length === 0) { parts.push(part); continue; }
        const last = parts[parts.length - 1];
        let shouldJoin = false;

        if (part.startsWith('(') || joinTermsSuffix.some(term => part.toUpperCase().startsWith(term))) shouldJoin = true;
        else if (last.endsWith('/') || last.endsWith('C/') || last.endsWith('M.') ||
            /\b(DE|AO|A|NO|NA|DO|DA|DOS|DAS|COM|C\/|E|AO M\.)$/i.test(last)) shouldJoin = true;
        
        if (last === 'BRANCO /' && part.toUpperCase() === 'INTEGRAL') shouldJoin = true;

        if (shouldJoin) parts[parts.length - 1] += ' ' + part;
        else parts.push(part);
    }

    const itens = {
        bruto: parts.join(' '),
        arroz: null,
        feijao: null,
        saladas: [],
        prato_principal: null,
        opcao_vegetariana: null,
        guarnicao: null,
        sobremesa: null
    };

    // Atribuição resiliente: tentamos mapear os itens baseado no número de colunas
    // Padrão completo: Rice, Bean, Salad1, Salad2, PP, PV, Guarnicao, Sobremesa (8 items)
    
    if (diaSemana === 'SEG') {
        itens.prato_principal = "Segunda Vegetariana";
        itens.arroz = parts[0] || null;
        itens.feijao = parts[1] || null;
        itens.saladas = parts.slice(2, 4);
        
        if (parts.length === 4) { // Arroz, Feijao, Salad1, Sobremesa?
            itens.saladas = [parts[2]];
            itens.sobremesa = parts[3];
        } else if (parts.length === 5) { // Arroz, Feijao, Salad1, PV, Sobremesa
            itens.saladas = [parts[2]];
            itens.opcao_vegetariana = parts[3];
            itens.sobremesa = parts[4];
        } else if (parts.length === 6) { // Arroz, Feijao, Salad1, Salad2, PV, Sobremesa
            itens.opcao_vegetariana = parts[4];
            itens.sobremesa = parts[5];
        } else if (parts.length >= 7) {
            itens.opcao_vegetariana = parts[4];
            itens.guarnicao = parts[5];
            itens.sobremesa = parts[parts.length - 1];
        }
    } else {
        itens.arroz = parts[0] || null;
        itens.feijao = parts[1] || null;
        itens.saladas = parts.slice(2, 4);
        
        if (parts.length === 5) { // Arroz, Feijao, Salad1, PP+PV?, Sobremesa
            itens.prato_principal = parts[2];
            itens.opcao_vegetariana = parts[3];
            itens.sobremesa = parts[4];
            itens.saladas = [];
        } else if (parts.length === 6) {
            itens.prato_principal = parts[3];
            itens.opcao_vegetariana = parts[4];
            itens.sobremesa = parts[5];
            itens.saladas = [parts[2]];
        } else if (parts.length === 7) {
            itens.prato_principal = parts[4];
            itens.opcao_vegetariana = parts[5];
            itens.sobremesa = parts[6];
        } else if (parts.length >= 8) {
            itens.prato_principal = parts[4];
            itens.opcao_vegetariana = parts[5];
            itens.guarnicao = parts[6];
            itens.sobremesa = parts[parts.length - 1];
        }
    }
    return itens;
}

export async function getMenuFromFile(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfParser = new PDFParse({ data: dataBuffer });
    const data = await pdfParser.getText({ itemJoiner: '||' });
    return parseMenuText(data.text);
}
