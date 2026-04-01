import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function debug() {
    const dataBuffer = fs.readFileSync('cardapio.pdf');
    const pdfParser = new PDFParse({ data: dataBuffer });
    const data = await pdfParser.getText({ itemJoiner: '||' });
    console.log(data.text);
}

debug();
