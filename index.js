import crypto from 'crypto'
import google from 'googleapis'
import { configDotenv } from 'dotenv';
configDotenv();

let products = []

async function chamarAPI() {

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
                }
              }
            }
            `,
            operationName: "GetProducts",
            variables: {
                keyword: "Tenis",
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
                produto.ratingStar >= 4 &&
                produto.priceDiscountRate > 30 &&
                produto.sales > 100
            ) {
                products.push(produto)
            }
        });
    }

    console.log(products)
}

chamarAPI().catch(console.error);