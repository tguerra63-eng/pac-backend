// src/services/whatsapp.js
// Integração com Z-API para envio de mensagens WhatsApp

const ZAPI_BASE = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`

/**
 * Envia mensagem de texto via WhatsApp
 * @param {string} phone - Número com DDD, ex: "85999990000"
 * @param {string} message - Texto da mensagem (suporta *negrito* e _itálico_)
 */
async function sendWhatsApp(phone, message) {
  // Formata número: remove tudo que não é dígito, adiciona 55 (Brasil)
  const numero = '55' + phone.replace(/\D/g, '')

  try {
    const response = await fetch(`${ZAPI_BASE}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': process.env.ZAPI_CLIENT_TOKEN
      },
      body: JSON.stringify({ phone: numero, message })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Z-API erro:', data)
      return false
    }

    console.log(`✅ WhatsApp enviado para ${numero}`)
    return true
  } catch (err) {
    console.error('Erro ao enviar WhatsApp:', err.message)
    // Não quebra o fluxo se WhatsApp falhar
    return false
  }
}

/**
 * Notificações prontas para cada evento da plataforma
 */
const notificacoes = {
  novoPedido: (nomeProdutor, nomeComprador, produto, valor) =>
    `📦 *Produtor ao Comprador*\n\nOlá ${nomeProdutor}! Você tem um *novo pedido*.\n\n🧀 Produto: ${produto}\n👤 Comprador: ${nomeComprador}\n💰 Valor: R$ ${valor}\n\nAcesse a plataforma para aceitar ou recusar.`,

  pedidoAceito: (nomeComprador, nomeProdutor, produto) =>
    `✅ *Produtor ao Comprador*\n\nOlá ${nomeComprador}! Seu pedido foi *aceito*.\n\n🧀 Produto: ${produto}\n🧑‍🌾 Produtor: ${nomeProdutor}\n\nAcesse a plataforma para confirmar o pagamento.`,

  pedidoRecusado: (nomeComprador, produto) =>
    `❌ *Produtor ao Comprador*\n\nOlá ${nomeComprador}. Infelizmente seu pedido de *${produto}* foi recusado.\n\nBusque outros produtores na plataforma.`,

  pagamentoConfirmado: (nomeProdutor, valor) =>
    `💰 *Produtor ao Comprador*\n\nOlá ${nomeProdutor}! Pagamento de *R$ ${valor}* confirmado.\n\nO repasse será feito em até 2 dias úteis.`,

  novoMatch: (nome, tipo, quantidade) =>
    `🔗 *Produtor ao Comprador*\n\nOlá ${nome}! Encontramos um *match* para você.\n\n🧀 ${tipo} — ${quantidade}kg\n\nAcesse a plataforma para ver detalhes.`,

  codigoVerificacao: (codigo) =>
    `🧀 *Produtor ao Comprador*\n\nSeu código de verificação é: *${codigo}*\n\nVálido por 15 minutos. Não compartilhe com ninguém.`,
}

module.exports = { sendWhatsApp, notificacoes }
