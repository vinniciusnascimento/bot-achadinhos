import crypto from 'crypto'
import { google } from 'googleapis';
import { configDotenv } from 'dotenv';
import Groq from "groq-sdk"
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';

configDotenv();

let products = []

// API Shoppe
async function callAPIShoppe() {

    for (let pagina = 1; pagina <= 10; pagina++) {

        const payload = JSON.stringify({
            query: `
            query GetProducts($keyword: String, $page: Int, $limit: Int) {
              productOfferV2(
                keyword: $keyword,
                page: $page,
                limit: $limit
              ) {
                nodes {
                  productName
                  offerLink
                  priceMin
                  priceMax
                  ratingStar
                  shopName
                  sales
                  priceDiscountRate
                  commissionRate
                  commission
                  shopType
                }
              }
            }
            `,
            operationName: "GetProducts",
            variables: {
                keyword: "gabinete",
                page: pagina,
                limit: 50
            }
        });

        const timestamp = Math.floor(Date.now() / 1000);

        const signature = crypto
            .createHash("sha256")
            .update(process.env.APP_ID_SHOPPE + timestamp + payload + process.env.SECRET_SHOPPE)
            .digest("hex");

        const headers = {
            "Content-Type": "application/json",
            Authorization: `SHA256 Credential=${process.env.APP_ID_SHOPPE},Timestamp=${timestamp},Signature=${signature}`,
        };

        const response = await fetch(
            "https://open-api.affiliate.shopee.com.br/graphql",
            {
                method: "POST",
                headers,
                body: payload,
            }
        );

        const data = await response.json();

        const nodes = data.data.productOfferV2.nodes;

        console.log(`Página ${pagina}: ${nodes.length} produtos encontrados`);

        nodes.forEach(produto => {

            if (
                produto.priceDiscountRate > 20 &&
                produto.sales > 100 &&
                produto.shopType.includes(1)
            ) {
                products.push(produto)
            }
        });
    }

    console.log(products)
}

// Google Sheets
const auth = new google.auth.GoogleAuth({
    keyFile: "credentials.json",
    scopes: [
        "https://www.googleapis.com/auth/spreadsheets"
    ]
});

const sheets = google.sheets({
    version: "v4",
    auth
});


async function inserirLista() {

    const linhas = products.map(produto => [
        produto.productName,
        `R$${produto.priceMin}`,
        `R$${produto.priceMax}`,
        produto.offerLink,
        produto.shopName,
        produto.sales,
        produto.priceDiscountRate + "%",
        (produto.commissionRate * 100) + "%",
        `R$${Number(produto.commission).toFixed(2).replace(".", ",")}`
    ]);


    await sheets.spreadsheets.values.update({

        spreadsheetId: process.env.SHEETS_ID,

        range: "A2:I",

        valueInputOption: "RAW",

        requestBody: {
            values: linhas
        }
    });


    console.log("Produtos enviados para a planilha!");
}

// GROQ API
const systemPrompt = `
Você é um redator especialista em criar mensagens de promoção para grupos de ofertas (WhatsApp/Telegram).

Você vai receber um objeto JSON com os seguintes campos:
- productName: nome do produto
- offerLink: link da oferta
- priceMin: menor preço disponível (variação de cor/modelo) (coloque a virgula no lugar do ponto quando for centavos)
- priceMax: maior preço disponível (variação de cor/modelo)
- ratingStar: avaliação do produto (0 a 5)
- shopName: nome da loja
- sales: quantidade de vendas
- priceDiscountRate: percentual de desconto (ex: 45 = 45% OFF)
- commissionRate: percentual de comissão que você recebe
- commission: valor da comissão em R$
- shopType: tipo da loja (ex: "Mall", "Loja Oficial", "Comum")

Com esses dados você deve analisar qual o melhor para divulgar e retornar uma mensagem igual a essa com os dados do produto:

FORMATO DA MENSAGEM (siga exatamente esta estrutura):

🚨 OFERTA DO DIA 🚨

✨ {productName}

💰 Apenas: R$ {priceMin}
💥 Economize {priceDiscountRate}%

⭐ {ratingStar}/5 de avaliação
🏪 {shopName} {shopType === 1 ? "✅ Loja Oficial" : ""}
📦 +{sales} vendas

🔗 Garanta o seu agora:
{offerLink}

REGRAS:
- Se priceMin e priceMax forem iguais, mostre só um preço, sem o "de/por"
- Nunca mostre commission ou commissionRate na mensagem — esses dados são só pra uso interno seu, não aparecem pro grupo
- Se ratingStar não vier ou for 0, omita essa linha
- Se sales for baixo (abaixo de 50) ou não vier, omita a linha de vendas (evita passar impressão de produto sem saída)
- Use no máximo os emojis já indicados no formato, não adicione mais
- Nunca invente nenhum dado que não veio no JSON
- Retorne APENAS a mensagem final, sem explicações, sem markdown, sem aspas ao redor
`;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fazerMensagem(message) {
    const chatCompletion = await groq.chat.completions.create({
        messages: [{
            role: "system",
            content: systemPrompt
        },
        {
            role: "user", content: JSON.stringify(message)
        }],
        model: "llama-3.3-70b-versatile",
    });

    return chatCompletion.choices[0].message.content;
}

// API TELEGRAM
const bot = new TelegramBot(process.env.TELEGRAM_API_KEY, { polling: false });

const groupChatId = -1001234567890;

function enviarMensagem(mensagem) {
    bot.sendMessage(process.env.TELEGRAM_GROUP_ID, mensagem)
        .then(() => console.log('Enviado!'))
        .catch((err) => console.error('Erro ao enviar:', err));
}

async function main() {

    await callAPIShoppe();
    console.log(products.length, "produtos filtrados");
    await inserirLista();
    let mensagem = await fazerMensagem(products);
    console.log(mensagem);
    enviarMensagem(mensagem)
    products = []
}

cron.schedule('*/2 * * * *', () => {
    console.log(`Executando em: ${new Date().toLocaleString()}`);
    main().catch(console.error);
});