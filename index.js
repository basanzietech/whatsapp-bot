// IMPORT MODULES
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, isJidGroup } = require('@adiwajshing/baileys');
const express = require('express');
const qrcode = require('qrcode-terminal');

// CONFIGURATION
const OWNER_NUMBER = '+255657779003';
const PORT = process.env.PORT || 3000;
const COMMAND_PREFIX = '!';

// In-memory pairing store: { pairingCode: phoneNumber }
const pairingCodes = {};

// SETUP EXPRESS SERVER KWA PAIRING
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route ya GET: Fom ya pairing
app.get('/pair', (req, res) => {
  res.send(`
    <html>
      <head><title>Pair Your Bot</title></head>
      <body>
         <h1>Pair Your Bot (shakira-md)</h1>
         <form action="/pair" method="post">
            <label for="number">Enter your WhatsApp number (with country code):</label>
            <input type="text" name="number" required/>
            <button type="submit">Pair</button>
         </form>
      </body>
    </html>
  `);
});

// Route ya POST: Anapopokea namba, itazalisha pairing code
app.post('/pair', (req, res) => {
  const number = req.body.number;
  // Zalisha code ya pairing (6-digit)
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  pairingCodes[code] = number;
  res.send(`Your pairing code is: <b>${code}</b>. Please send this code to the bot on WhatsApp to complete pairing.`);
});

app.listen(PORT, () => {
  console.log(`Pairing server running on port ${PORT}`);
});

// START BOT USING BAILLEYS
async function startBot() {
  // Setup authentication state
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true // QR code itaonyeshwa terminal wakati wa kwanza
  });

  sock.ev.on('creds.update', saveCreds);

  // HANDLE MESSAGE EVENTS
  sock.ev.on('messages.upsert', async m => {
    try {
      const msg = m.messages[0];
      // Skip messages without content au messages za status broadcast
      if (!msg.message || (msg.key && msg.key.remoteJid === 'status@broadcast')) return;

      const sender = msg.key.remoteJid;
      const isGroupMsg = isJidGroup(sender);
      let text = '';

      // Pata text kutoka message (simple au extended)
      if (msg.message.conversation) {
        text = msg.message.conversation;
      } else if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) {
        text = msg.message.extendedTextMessage.text;
      }
      text = text.trim();

      // KAZI YA PAIRING: Ikiwa ujumbe ni pairing code
      if (pairingCodes[text]) {
        // Angalia ikiwa sender inahusiana na namba aliyotolewa
        // WhatsApp sender id ina muundo kama "2547xxxxxxx@s.whatsapp.net"
        const expectedNumber = pairingCodes[text];
        if (sender.includes(expectedNumber.replace('+', ''))) {
          await sock.sendMessage(sender, { text: "*shakira-md* is connected successful\n_for support contact us " + OWNER_NUMBER + "_\nWhatsapp Channel https://hapa_ni_link_ya_channel" });
          console.log(`Paired with ${sender}`);
          delete pairingCodes[text];
          return;
        }
      }

      // AUTO-DELETION YA LINKS KATIKA MAKUNDI
      if (isGroupMsg && /https?:\/\/\S+/i.test(text)) {
        try {
          // Futa ujumbe unaoambatana na link
          await sock.sendMessage(sender, { delete: msg.key });
          // Tuma onyo kwa sender
          await sock.sendMessage(sender, { text: `Onyo: Hutaruhusu kutuma links hapa!` });
          return;
        } catch (e) {
          console.error('Error deleting message: ', e);
        }
      }

      // COMMAND HANDLING: Amri zinazoanza na prefix (kama !)
      if (text.startsWith(COMMAND_PREFIX)) {
        const args = text.slice(COMMAND_PREFIX.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        switch (command) {
          case 'help': {
            const helpMessage = `*shakira-md Bot Commands:*\n
!help - Display this help message
!owner - Show owner contact info
!ping - Check bot responsiveness
!delete - Delete a message (reply to the message you want to delete)
!kick - Kick a user (usage: !kick @user)
!promote - Promote a user to admin (usage: !promote @user)
!demote - Demote an admin (usage: !demote @user)`;
            await sock.sendMessage(sender, { text: helpMessage });
            break;
          }
          case 'owner': {
            await sock.sendMessage(sender, { text: `Owner: ${OWNER_NUMBER}` });
            break;
          }
          case 'ping': {
            await sock.sendMessage(sender, { text: 'pong' });
            break;
          }
          case 'delete': {
            // Inategemea kama mtumiaji amefanya reply kwa ujumbe unaotaka kufutwa
            const quoted = msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.stanzaId;
            if (quoted) {
              await sock.sendMessage(sender, { delete: { id: quoted, remoteJid: sender } });
              await sock.sendMessage(sender, { text: 'Ujumbe umefutwa.' });
            } else {
              await sock.sendMessage(sender, { text: 'Reply to a message to delete it.' });
            }
            break;
          }
          case 'kick': {
            if (!isGroupMsg) {
              await sock.sendMessage(sender, { text: 'Amri hii inatumika tu kwenye makundi.' });
              break;
            }
            // Tumia mentionedJid kutoka extendedTextMessage context
            const mentioned = msg.message.extendedTextMessage &&
                              msg.message.extendedTextMessage.contextInfo &&
                              msg.message.extendedTextMessage.contextInfo.mentionedJid;
            if (mentioned && mentioned.length > 0) {
              try {
                await sock.groupParticipantsUpdate(sender, mentioned, 'remove');
                await sock.sendMessage(sender, { text: 'Umeondoa mchango kwenye kikundi.' });
              } catch (e) {
                await sock.sendMessage(sender, { text: 'Imeshindikana kuondoa mchango.' });
              }
            } else {
              await sock.sendMessage(sender, { text: 'Tafadhali taja mchango wa kikundi.' });
            }
            break;
          }
          case 'promote': {
            if (!isGroupMsg) {
              await sock.sendMessage(sender, { text: 'Amri hii inatumika tu kwenye makundi.' });
              break;
            }
            const mentioned = msg.message.extendedTextMessage &&
                              msg.message.extendedTextMessage.contextInfo &&
                              msg.message.extendedTextMessage.contextInfo.mentionedJid;
            if (mentioned && mentioned.length > 0) {
              try {
                await sock.groupParticipantsUpdate(sender, mentioned, 'promote');
                await sock.sendMessage(sender, { text: 'Mchango amepewa cheo cha admin.' });
              } catch (e) {
                await sock.sendMessage(sender, { text: 'Imeshindikana kupromote mchango.' });
              }
            } else {
              await sock.sendMessage(sender, { text: 'Tafadhali taja mchango wa kikundi.' });
            }
            break;
          }
          case 'demote': {
            if (!isGroupMsg) {
              await sock.sendMessage(sender, { text: 'Amri hii inatumika tu kwenye makundi.' });
              break;
            }
            const mentioned = msg.message.extendedTextMessage &&
                              msg.message.extendedTextMessage.contextInfo &&
                              msg.message.extendedTextMessage.contextInfo.mentionedJid;
            if (mentioned && mentioned.length > 0) {
              try {
                await sock.groupParticipantsUpdate(sender, mentioned, 'demote');
                await sock.sendMessage(sender, { text: 'Mchango ameondolewa cheo cha admin.' });
              } catch (e) {
                await sock.sendMessage(sender, { text: 'Imeshindikana demote mchango.' });
              }
            } else {
              await sock.sendMessage(sender, { text: 'Tafadhali taja mchango wa kikundi.' });
            }
            break;
          }
          default:
            await sock.sendMessage(sender, { text: 'Amri haijulikani. Tumia !help kwa orodha ya amri.' });
        }
      }
    } catch (error) {
      console.error('Error processing message: ', error);
    }
  });

  // STATUS UPDATE HANDLING (SIMULATION)
  // Kumbuka: WhatsApp haijaruhusu reactions kwenye status kama kawaida – sehemu hii ni mfano
  sock.ev.on('statuses.update', async statuses => {
    for (const status of statuses) {
      try {
        // Jaribu kutuma "reaction" (hii inaweza kuwa simulation kulingana na API)
        await sock.sendMessage(status.id, { 
          react: { 
            text: '🧡', 
            key: { id: status.id, fromMe: false, remoteJid: status.id } 
          } 
        });
      } catch (e) {
        console.error('Error reacting to status: ', e);
      }
    }
  });

  // HANDLE CONNECTION UPDATES
  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    console.log('Connection update: ', update);
    if(connection === 'close') {
      // Attempt to reconnect
      startBot();
    }
  });
}

startBot();
