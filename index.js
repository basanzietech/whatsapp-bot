const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Tumia LocalAuth kuhifadhi session yako ili usifanye scan QR kila wakati
const client = new Client({
    authStrategy: new LocalAuth()
});

// Wakati QR code inapotolewa
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('Tafadhali scan QR code ili uingie kwenye WhatsApp.');
});

// Bot iko tayari
client.on('ready', () => {
    console.log('Client iko tayari!');
});

// Kusikiliza ujumbe
client.on('message', async (msg) => {
    // Hakikisha ni ujumbe kutoka group (kama id ina '@g.us')
    if (msg.from.endsWith('@g.us')) {
        // Tambua URLs kwa kutumia regex
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        if (urlRegex.test(msg.body)) {
            let chat = await msg.getChat();
            // Katika groups, msg.author inahifadhi id ya mtumaji, ikiwa sio ujumbe wa private
            let senderId = msg.author ? msg.author : msg.from;

            // Pata taarifa za group kuhusu washiriki
            let participants = chat.participants;
            let senderParticipant = participants.find(p => p.id._serialized === senderId);

            // Angalia kama mtumaji sio admin (kama si admin wala super admin)
            if (senderParticipant && !senderParticipant.isAdmin && !senderParticipant.isSuperAdmin) {
                try {
                    // Ongeza ufuatiliaji: futa ujumbe kwa wote (inahitaji kuwa admin)
                    await msg.delete(true); // true: kufuta ujumbe kwa wote
                    console.log(`Ujumbe kutoka ${senderId} ulio na link umefutwa.`);
                } catch (err) {
                    console.error('Kosa wakati wa kufuta ujumbe:', err);
                }
            }
        }
    }
});

client.initialize();

