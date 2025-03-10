const { makeWASocket, useMultiFileAuthState, delay } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const fs = require('fs')
const express = require('express')
const app = express()
const PORT = 3001

// Owner information
const ownerNumber = '255657779003@s.whatsapp.net'

// Configure express for pairing page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/pairing.html')
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  
  const sock = makeWASocket({
  auth: state,
  printQRInTerminal: false,
  logger: undefined, // Hii ndio njia rahisi zaidi
  browser: ['Shakira-MD', 'Safari', '1.0.0']
})

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update
    if (qr) {
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') {
      console.log('Bot connected!')
      sendSuccessMessage(sock)
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // Auto view and react to status updates
  sock.ev.on('status-update', async (update) => {
    if (update.status) {
      await sock.readMessages([update.status.key])
      await sock.sendMessage(update.status.jid, { react: { text: '🧡', key: update.status.key } })
    }
  })

  // Message handling
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    // Handle group links
    if (msg.key.remoteJid.endsWith('@g.us')) {
      const linkRegex = /https?:\/\/[^\s]+/gi
      if (msg.message.conversation?.match(linkRegex)) {
        await handleLinks(sock, msg)
      }
    }

    // Handle commands
    const command = msg.message.conversation?.toLowerCase()
    if (command?.startsWith('!')) {
      await handleCommands(sock, msg)
    }
  })
}

// Handle link removal and warnings
async function handleLinks(sock, msg) {
  try {
    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key })
    await sock.sendMessage(
      msg.key.remoteJid, 
      { text: `@${msg.key.participant.split('@')[0]} Links are not allowed!`, 
        mentions: [msg.key.participant] 
      }
    )
  } catch (error) {
    console.error('Error handling links:', error)
  }
}

// Command handler
async function handleCommands(sock, msg) {
  const command = msg.message.conversation.toLowerCase().split(' ')[0]
  const args = msg.message.conversation.split(' ').slice(1)

  switch(command) {
    case '!help':
      await sock.sendMessage(msg.key.remoteJid, {
        text: `📜 *Available Commands* 📜
!help - Show all commands
!owner - Show owner info
!delete - Delete quoted message
!kick @user - Remove user from group
!promote @user - Make user admin
!demote @user - Remove admin status
!ping - Check bot latency`
      })
      break

    case '!owner':
      await sock.sendMessage(msg.key.remoteJid, {
        text: `👑 *Owner Information* 👑
Number: +255657779003
Support: +255657779003
Channel: https://hapa_ni_link_ya_channel`
      })
      break

    case '!delete':
      if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = msg.message.extendedTextMessage.contextInfo
        await sock.sendMessage(msg.key.remoteJid, { delete: quoted.stanzaId })
      }
      break

    case '!kick':
      if (args[0]) await handleGroupAction(sock, msg, 'remove', args[0])
      break

    case '!promote':
      if (args[0]) await handleGroupAction(sock, msg, 'promote', args[0])
      break

    case '!demote':
      if (args[0]) await handleGroupAction(sock, msg, 'demote', args[0])
      break

    case '!ping':
      const start = Date.now()
      await sock.sendMessage(msg.key.remoteJid, { text: 'Pong!' })
      const latency = Date.now() - start
      await sock.sendMessage(msg.key.remoteJid, { text: `🏓 Latency: ${latency}ms` })
      break
  }
}

// Group action handler
async function handleGroupAction(sock, msg, action, userJid) {
  try {
    userJid = userJid.replace('@', '') + '@s.whatsapp.net'
    await sock.groupParticipantsUpdate(
      msg.key.remoteJid,
      [userJid],
      action
    )
  } catch (error) {
    console.error(`Error ${action} user:`, error)
  }
}

// Send success message after connection
async function sendSuccessMessage(sock) {
  await sock.sendMessage(
    ownerNumber,
    { text: `*shakira-md* is connected successfully\n_for support contact us +255657779003_\nWhatsApp Channel: https://hapa_ni_link_ya_channel` }
  )
}

// Start server and bot
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  startBot().catch(err => console.error('Bot startup error:', err))
})
