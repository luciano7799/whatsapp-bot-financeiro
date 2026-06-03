// Rode este arquivo UMA VEZ para conectar o WhatsApp: node connect.js
import 'dotenv/config'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import pino from 'pino'

const { state, saveCreds } = await useMultiFileAuthState('./auth_session')

const sock = makeWASocket({
  auth: state,
  logger: pino({ level: 'silent' }),
  printQRInTerminal: false,
})

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) {
    console.clear()
    console.log('📱 Escaneie o QR code abaixo com seu WhatsApp:\n')
    qrcode.generate(qr, { small: true })
  }

  if (connection === 'open') {
    console.log('\n✅ WhatsApp conectado com sucesso!')
    console.log('Sessão salva em ./auth_session — pode fechar este terminal.')
    process.exit(0)
  }

  if (connection === 'close') {
    const code = lastDisconnect?.error?.output?.statusCode
    if (code !== DisconnectReason.loggedOut) {
      console.log('Reconectando...')
    } else {
      console.log('❌ Desconectado. Delete a pasta auth_session e rode novamente.')
      process.exit(1)
    }
  }
})

sock.ev.on('creds.update', saveCreds)
