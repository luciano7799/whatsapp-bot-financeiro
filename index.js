import 'dotenv/config'
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys'
import { createClient } from '@supabase/supabase-js'
import { useSupabaseAuthState } from './supabase-auth.js'
import { gerarResumo } from './resumo.js'
import cron from 'node-cron'
import pino from 'pino'
import express from 'express'
import qrcode from 'qrcode-terminal'

// Debug: mostra quais variáveis estão disponíveis
console.log('ENV CHECK:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? '✅ definida' : '❌ UNDEFINED',
  SUPABASE_KEY: process.env.SUPABASE_KEY ? '✅ definida' : '❌ UNDEFINED',
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || '❌ UNDEFINED',
  RAILWAY_ENV: process.env.RAILWAY_ENVIRONMENT || '❌ UNDEFINED',
  RAILWAY_SERVICE: process.env.RAILWAY_SERVICE_NAME || '❌ UNDEFINED',
  TOTAL_ENV_KEYS: Object.keys(process.env).length,
})

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// Servidor web — mostra status e QR code
const app = express()
let qrAtual = null
let conectado = false

app.get('/', (_, res) => {
  res.send(`
    <html><body style="font-family:sans-serif;padding:40px;background:#111;color:#eee">
      <h2>🤖 Bot Financeiro WhatsApp</h2>
      <p>Status: <strong style="color:${conectado ? '#4ade80' : '#facc15'}">${conectado ? '✅ Conectado' : '⏳ Aguardando conexão'}</strong></p>
      ${!conectado ? '<p><a href="/qr" style="color:#60a5fa">👉 Clique aqui para escanear o QR code</a></p>' : ''}
    </body></html>
  `)
})

app.get('/qr', (_, res) => {
  if (conectado) return res.send('<p style="font-family:sans-serif;padding:40px">✅ Já conectado!</p>')
  if (!qrAtual)  return res.send('<p style="font-family:sans-serif;padding:40px">⏳ Aguardando QR code... atualize em 5 segundos.</p>')
  // Gera QR como texto ASCII
  let ascii = ''
  qrcode.generate(qrAtual, { small: true }, txt => { ascii = txt })
  res.send(`
    <html><body style="background:#111;color:#eee;font-family:monospace;padding:40px">
      <h2>📱 Escaneie com o WhatsApp</h2>
      <pre style="font-size:10px;line-height:1.1">${ascii}</pre>
      <p style="color:#aaa">Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo</p>
      <script>setTimeout(()=>location.reload(),15000)</script>
    </body></html>
  `)
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🌐 Servidor rodando na porta ${PORT}`))

// Bot WhatsApp
let sock

async function conectar() {
  const { state, saveCreds } = await useSupabaseAuthState(getSupabase())

  sock = makeWASocket.default({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrAtual = qr
      conectado = false
      console.log('📱 QR code disponível em /qr')
    }

    if (connection === 'open') {
      qrAtual = null
      conectado = true
      console.log(`✅ [${new Date().toLocaleString('pt-BR')}] WhatsApp conectado`)
    }

    if (connection === 'close') {
      conectado = false
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconectando em 5s...')
        setTimeout(conectar, 5000)
      } else {
        console.error('❌ Sessão expirada. Acesse /qr para reconectar.')
        setTimeout(conectar, 5000)
      }
    }
  })
}

async function enviarResumo() {
  if (!conectado) { console.log('⚠️ WhatsApp não conectado, pulando envio.'); return }
  try {
    console.log(`📤 [${new Date().toLocaleString('pt-BR')}] Gerando resumo...`)
    const msg = await gerarResumo()
    const numero = `${process.env.WHATSAPP_NUMBER}@s.whatsapp.net`
    await sock.sendMessage(numero, { text: msg })
    console.log('✅ Resumo enviado!')
  } catch (err) {
    console.error('❌ Erro ao enviar:', err.message)
  }
}

await conectar()

const schedule = process.env.CRON_SCHEDULE || '0 8 * * *'
cron.schedule(schedule, enviarResumo, { timezone: 'America/Sao_Paulo' })
console.log(`⏰ Agendado: ${schedule} (horário de Brasília)`)
