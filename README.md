# 🤖 bot-achadinhos

Bot automatizado que busca ofertas na Shopee, filtra os melhores achadinhos, gera uma mensagem de divulgação com IA e envia automaticamente para um grupo do Telegram — além de registrar tudo em uma planilha do Google Sheets.

## ✨ Funcionalidades

- **Busca de ofertas na Shopee** via API oficial de afiliados (GraphQL), pesquisando por palavras-chave sorteadas aleatoriamente (ex: fone bluetooth, smartwatch, air fryer, ssd, etc).
- **Filtro automático de produtos**, considerando apenas ofertas com mais de 20% de desconto e de lojas oficiais/mall.
- **Geração de mensagem promocional** usando a API da Groq (modelo `llama-3.3-70b-versatile`), seguindo um formato padronizado com emojis, preço, desconto, avaliação e link.
- **Envio automático para o Telegram** através de um bot configurado via BotFather.
- **Registro em planilha do Google Sheets** com todos os produtos filtrados a cada execução.
- **Execução automática recorrente** a cada 15 minutos via `node-cron`.

## 🧩 Como funciona (fluxo)

1. O cron dispara a função `main()` a cada 15 minutos.
2. `callAPIShoppe()` busca produtos na API da Shopee (10 páginas por execução) para uma palavra-chave sorteada, assinando cada requisição com HMAC SHA256.
3. Os produtos com desconto > 20% e de lojas elegíveis são filtrados e armazenados.
4. `inserirLista()` envia todos os produtos filtrados para uma planilha do Google Sheets.
5. O produto com **maior desconto** é escolhido para divulgação.
6. `fazerMensagem()` chama a Groq API para gerar a mensagem final de divulgação.
7. `enviarMensagem()` envia a mensagem para o grupo configurado no Telegram.
8. A lista de produtos é zerada, aguardando o próximo ciclo.

## 📦 Tecnologias

- [Node.js](https://nodejs.org/) (ESM — `type: module`)
- [Groq SDK](https://www.npmjs.com/package/groq-sdk) — geração de mensagens com IA
- [googleapis](https://www.npmjs.com/package/googleapis) — integração com Google Sheets
- [node-telegram-bot-api](https://www.npmjs.com/package/node-telegram-bot-api) — envio de mensagens no Telegram
- [node-cron](https://www.npmjs.com/package/node-cron) — agendamento das execuções
- [dotenv](https://www.npmjs.com/package/dotenv) — variáveis de ambiente
- Node `crypto` — assinatura das requisições à API da Shopee

## ⚙️ Pré-requisitos

- Node.js 18+ (uso de `fetch` nativo)
- Conta de afiliado na Shopee (App ID e Secret)
- Conta na Groq com chave de API
- Bot do Telegram criado via [@BotFather](https://t.me/BotFather) e ID do grupo/chat
- Projeto no Google Cloud com uma Service Account habilitada para a Google Sheets API
- Uma planilha do Google Sheets compartilhada com o e-mail da Service Account

## 🔑 Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com:

```env
APP_ID_SHOPPE=seu_app_id_da_shopee
SECRET_SHOPPE=seu_secret_da_shopee
GROQ_API_KEY=sua_chave_da_groq
TELEGRAM_API_KEY=token_do_seu_bot_telegram
TELEGRAM_GROUP_ID=id_do_grupo_ou_chat
SHEETS_ID=id_da_planilha_google_sheets
```

Além disso, é necessário um arquivo `credentials.json` na raiz do projeto, contendo as credenciais da Service Account do Google Cloud usada para acessar o Google Sheets.

## 🚀 Instalação e uso

```bash
# instalar dependências
npm install

# rodar o bot (inicia o agendamento a cada 15 min)
node index.js
```

Por padrão, o bot roda continuamente através do cron (`*/15 * * * *`). Para testar uma execução única sem esperar o agendamento, descomente a última linha do `index.js`:

```js
// main().catch(console.error);
```

## 📁 Estrutura principal (`index.js`)

| Função | Responsabilidade |
|---|---|
| `callAPIShoppe()` | Busca e filtra produtos na API da Shopee |
| `inserirLista()` | Insere os produtos filtrados no Google Sheets |
| `fazerMensagem()` | Gera a mensagem promocional via Groq |
| `enviarMensagem()` | Envia a mensagem para o Telegram |
| `main()` | Orquestra o fluxo completo de cada ciclo |

## ⚠️ Observações

- O rate limit da Groq (erro 429) é tratado silenciosamente — o ciclo simplesmente não envia mensagem naquele caso.
- Erros na API da Shopee (ex: `code: 10000`, campos ausentes) são logados e a página é pulada, sem interromper o restante da execução.
- A lista de produtos (`products`) é resetada ao final de cada execução do `main()` para evitar acúmulo entre ciclos.

## 📄 Licença

ISC — veja o `package.json`.
