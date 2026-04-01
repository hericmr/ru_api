import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMenuFromFile } from '../src/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PDF_1 = path.join(__dirname, '../cardapio.pdf');
const PDF_2 = path.join(__dirname, '../cardapio_dezembro.pdf');

async function testParser() {
    console.log("🧪 Testing Parser with existing PDFs...");

    for (const pdf of [PDF_1, PDF_2]) {
        if (!fs.existsSync(pdf)) {
            console.warn(`⚠️ PDF not found: ${pdf}`);
            continue;
        }

        console.log(`\n📄 Analyzing: ${path.basename(pdf)}`);
        try {
            const menu = await getMenuFromFile(pdf);
            
            console.log(`- Almoço: ${menu.almoco.length} days found (${menu.almoco.map(d => d.dia).join(', ')})`);
            if (menu.almoco_extras?.length) console.log(`  * Extra items: ${menu.almoco_extras.join(', ')}`);
            
            console.log(`- Jantar: ${menu.jantar.length} days found (${menu.jantar.map(d => d.dia).join(', ')})`);
            if (menu.jantar_extras?.length) console.log(`  * Extra items: ${menu.jantar_extras.join(', ')}`);

            if (menu.almoco.length > 0) {
                console.log("\nSample (Almoço Day 30):");
                const sample = menu.almoco.find(d => d.dia === 30) || menu.almoco[0];
                console.log(JSON.stringify(sample, null, 2));
            }

            // Check for missing items in a few days
            const missing = menu.almoco.filter(d => d.itens && (!d.itens.prato_principal || !d.itens.sobremesa));
            if (missing.length > 0) {
                console.log(`\n⚠️ Days with missing PP or Sobremesa in Almoço: ${missing.length}`);
                missing.slice(0, 3).forEach(d => console.log(`  - Day ${d.dia}: ${JSON.stringify(d.itens)}`));
            }

        } catch (err) {
            console.error(`❌ Error parsing ${pdf}:`, err.message);
        }
    }
}

testParser();
