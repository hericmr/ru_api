import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function debugPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    try {
        const pdfParser = new PDFParse({ data: dataBuffer });
        const data = await pdfParser.getText({ itemJoiner: '||' });
        console.log("--- RAW TEXT ---");
        console.log(data.text);
        console.log("--- END RAW TEXT ---");
    } catch (err) {
        console.error("Error parsing PDF:", err);
    }
}

const file = process.argv[2] || 'cardapio.pdf';
debugPdf(file);
