// index.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@adiwajshing/baileys')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// CONFIGURATION
const SESSION_ID = 'levanter_94fa5862090fb47c387dbf8d7c6cb83cd' // Jaza session ID yako hapa
const OWNER_NUMBER = '255657779003@s.whatsapp.net'
const PREFIX = '!'

async function startBot() {
    // Weka hali ya authentication
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'session', SESSION_ID))

    // Tengeneza socket
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['Shakira-MD', 'Chrome', '122.0.0']
    })

    // Hifadhi mabadiliko ya credentials
    sock.ev.on('creds.update', saveCreds)

    // Usimamizi wa unganisho
    sock.ev.on('connection.update', (update) => {
        if (update.connection === 'open') {
            console.log('✅ Imeunganishwa kikamilifu!')
            sock.sendMessage(OWNER_NUMBER, { text: 'Bot imeanza kazi!' })
        }
    })

    // Kusimamia ujumbe
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return

        const jid = msg.key.remoteJid
        const userJid = msg.key.participant || jid
        const text = msg.message.conversation || ''

        try {
            if (text.startsWith(PREFIX)) {
                const [cmd, ...args] = text.slice(1).split(' ')
                await handleCommand(sock, { cmd: cmd.toLowerCase(), jid, userJid, msg })
            }
        } catch (error) {
            console.error('Kosa:', error)
        }
    })

    // Kusimamia mabadiliko ya kikundi
    sock.ev.on('group-participants.update', async (update) => {
        console.log('Mabadiliko ya kikundi:', update)
    })

    // Kuona status automatically
    sock.ev.on('status.update', (update) => {
        if (update.jid === OWNER_NUMBER) {
            console.log('Status ya mmiliki imesasishwa:', update)
        }
    })
}

// Kazi za kusimamia amri
async function handleCommand(sock, { cmd, jid, userJid, msg }) {
    const isGroup = jid.endsWith('@g.us')
    const isAdmin = await checkAdmin(sock, jid, userJid)
    const isOwner = userJid === OWNER_NUMBER

    switch(cmd) {
        case 'kick':
            if (isGroup && (isAdmin || isOwner)) {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
                if (mentioned) await sock.groupParticipantsUpdate(jid, mentioned, 'remove')
            }
            break

        case 'promote':
            if (isGroup && isOwner) {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
                if (mentioned) await sock.groupParticipantsUpdate(jid, mentioned, 'promote')
            }
            break

        case 'demote':
            if (isGroup && isOwner) {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid
                if (mentioned) await sock.groupParticipantsUpdate(jid, mentioned, 'demote')
            }
            break

        case 'delete':
            if (msg.message?.extendedTextMessage?.contextInfo?.stanzaId) {
                await sock.sendMessage(jid, {
                    delete: {
                        id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        remoteJid: jid,
                        fromMe: false
                    }
                })
            }
            break

        case 'ping':
            await sock.sendMessage(jid, { text: '🏓 Pong!' })
            break

        case 'owner':
            await sock.sendMessage(jid, { text: `👑 Mmiliki: ${OWNER_NUMBER}` })
            break

        case 'help':
            await showHelp(sock, jid)
            break
    }
}

// Kazi za kusaidia
async function checkAdmin(sock, jid, userJid) {
    try {
        const metadata = await sock.groupMetadata(jid)
        return metadata.participants.find(p => p.id === userJid)?.admin === 'admin'
    } catch {
        return false
    }
}

async function showHelp(sock, jid) {
    const helpText = `🛠 *Amri Zinazopatikana*:
    
${PREFIX}kick - Ondoa mtu (admin)
${PREFIX}promote - Mfanye admin (owner)
${PREFIX}demote - Ondoa admin (owner)
${PREFIX}delete - Futa ujumbe
${PREFIX}ping - Angalia utendaji
${PREFIX}owner - Onyesha mmiliki
${PREFIX}help - Onyesha msaada`

    await sock.sendMessage(jid, { text: helpText })
}

// Anzisha bot
startBot()
