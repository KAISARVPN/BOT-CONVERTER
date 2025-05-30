
const APIKU = 'https://api.checker-ip.web.id/check?ip='; // Ganti dengan URL asli API status IP
const DEFAULT_HOST = 'your.domain.com'; // Ganti dengan host default

// Simpan pesan yang sudah dikirim ke user (chatId) supaya tidak spam
const sentMessages = new Map();

// Fungsi untuk generate UUID (simple version)
export function generateUUID() {
  // Random UUID v4 generator sederhana
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0,
      v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getFlagEmoji(countryCode) {
  if (!countryCode) return '';
  const codePoints = [...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

// Fungsi untuk mencegah spam pesan berulang
export function canSendMessage(chatId, key, interval = 30000) {
  const now = Date.now();
  if (!sentMessages.has(chatId)) sentMessages.set(chatId, {});
  const userData = sentMessages.get(chatId);
  if (!userData[key] || now - userData[key] > interval) {
    userData[key] = now;
    return true;
  }
  return false;
}

function getCountryKeyboard(countryCodes, page, totalPages) {
  const start = page * 16;
  const selectedCodes = countryCodes.slice(start, start + 16);
  const rows = [];

  for (let i = 0; i < selectedCodes.length; i += 4) {
    const row = selectedCodes.slice(i, i + 4).map(code => ({
      text: `${getFlagEmoji(code)} ${code}`,
      callback_data: `select_${code}`
    }));
    rows.push(row);
  }

  // Tombol navigasi
  const navButtons = [];

  if (page > 0) navButtons.push({ text: '⬅️ Prev', callback_data: `page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: '➡️ Next', callback_data: `page_${page + 1}` });
  navButtons.push({ text: '🔙 Back', callback_data: 'back_menu' });

  rows.push(navButtons);
  return rows;
}

// Handler command /proxyip
export async function handleProxyipCommand(bot, msg) {
  const chatId = msg.chat.id;
  if (!canSendMessage(chatId, 'proxyip_command')) return;

  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');

    if (ipList.length === 0) {
      await bot.sendMessage(chatId, `⚠️ *Daftar IP kosong atau tidak ditemukan. Coba lagi nanti.*`, { parse_mode: 'Markdown' });
      return;
    }

    const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))];
    const buttons = [];

    for (let i = 0; i < countryCodes.length; i += 4) {
      buttons.push(
        countryCodes.slice(i, i + 4).map(code => ({
          text: `${getFlagEmoji(code)} ${code}`,
          callback_data: `select_${code}`
        }))
      );
    }

    await bot.sendMessage(chatId, '🌍 *Pilih negara:*', {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: buttons }
    });

  } catch (error) {
    console.error('Error fetching IP list:', error);
    await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat mengambil daftar IP: ${error.message}*`, { parse_mode: 'Markdown' });
  }
}

// Handler callback query
// Handler callback query
export async function handleCallbackQuery(bot, callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  // Handle pagination for country list
  if (data.startsWith('page_')) {
    const page = parseInt(data.split('_')[1], 10);
    if (isNaN(page) || page < 1) return; // Validasi page

    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt'
      );
      if (!response.ok) throw new Error('Failed to fetch proxy list');

      const ipText = await response.text();
      const ipList = ipText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

      const countryCodes = [...new Set(ipList.map(line => line.split(',')[2]))];
      const totalPages = Math.ceil(countryCodes.length / 16);

      const keyboard = getCountryKeyboard(countryCodes, page, totalPages);
      const msgId = sentMessages.get(chatId)?.proxy_keyboard;

      if (msgId) {
        await bot.editMessageReplyMarkup(
          { inline_keyboard: keyboard },
          { chat_id: chatId, message_id: msgId }
        );
      }
    } catch (error) {
      console.error('Error handling page callback:', error);
      // Optionally notify user of error
    }

    return;
  }

  // Handle back to main menu
  if (data === 'back_menu') {
    await handleProxyipCommand(bot, { chat: { id: chatId } });
    return;
  }

  // Handle country selection
  if (data.startsWith('select_')) {
    if (!canSendMessage(chatId, data)) return;

    const countryCode = data.split('_')[1];
    if (!countryCode) return;

    try {
      const response = await fetch(
        'https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt'
      );
      if (!response.ok) throw new Error('Failed to fetch proxy list');

      const ipText = await response.text();
      const ipList = ipText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== '');

      const filteredIPs = ipList.filter(line => line.split(',')[2] === countryCode);

      if (filteredIPs.length === 0) {
        await bot.sendMessage(chatId, `⚠️ *Tidak ada IP tersedia untuk negara ${countryCode}.*`, {
          parse_mode: 'Markdown',
        });
        return;
      }

      const randomProxy = filteredIPs[Math.floor(Math.random() * filteredIPs.length)];
      const [ip, port, , provider] = randomProxy.split(',');

      const statusResponse = await fetch(`${APIKU}${ip}:${port}`);
      if (!statusResponse.ok) throw new Error('Failed to fetch proxy status');

      const ipData = await statusResponse.json();
      const status = ipData.status === 'ACTIVE' ? '✅ ACTIVE' : '❌ DEAD';

      const safeProvider = provider.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);

      const buttons = [
        [
          { text: '⚡ VLESS', callback_data: `config_vless_${ip}_${port}_${countryCode}_${safeProvider}` },
          { text: '⚡ TROJAN', callback_data: `config_trojan_${ip}_${port}_${countryCode}_${safeProvider}` },
        ],
        [{ text: '⚡ VMESS', callback_data: `config_vmess_${ip}_${port}_${countryCode}_${safeProvider}` }],
        [{ text: '⚡ SHADOWSOCKS', callback_data: `config_ss_${ip}_${port}_${countryCode}_${safeProvider}` }],
      ];

      let messageText = `✅ *Info IP untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```\nINFORMATION\n" +
        `IP      : ${ip}\nPORT    : ${port}\nISP     : ${provider}\nCOUNTRY : ${ipData.country}\nSTATUS  : ${status}\n` +
        "```";

      if (ipData.latitude && ipData.longitude) {
        messageText += `\n👉 🌍 [View Google Maps](https://www.google.com/maps?q=${ipData.latitude},${ipData.longitude})`;
      }

      await bot.sendMessage(chatId, messageText, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
      });

    } catch (error) {
      console.error('❌ Error fetching IP status:', error);
      await bot.sendMessage(chatId, `⚠️ *Terjadi kesalahan saat memverifikasi IP.*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  if (data.startsWith('config_')) {
    if (!canSendMessage(chatId, `config_${data}`)) return;

    try {
      const [_, type, ip, port, countryCode, provider] = data.split('_');
      const uuid1 = 'f282b878-8711-45a1-8c69-5564172123c1';
      const uuid = generateUUID();

      const path = encodeURIComponent(`/Geo-Project/${ip}=${port}`);
      const pathh = `/Geo-Project/${ip}-${port}`;
      const prov = encodeURIComponent(`${provider} ${getFlagEmoji(countryCode)}`);
      const prov1 = `${provider} ${getFlagEmoji(countryCode)}`;
      const toBase64 = (str) => btoa(unescape(encodeURIComponent(str)));

      let configText = '';

      if (type === 'vmess') {
        const vmessJSON_TLS = {
          v: "2",
          ps: `${countryCode} - ${prov1} [VMess-TLS]`,
          add: DEFAULT_HOST,
          port: "443",
          id: uuid1,
          aid: "0",
          net: "ws",
          type: "none",
          host: DEFAULT_HOST,
          path: pathh,
          tls: "tls",
          sni: DEFAULT_HOST,
          scy: "zero"
        };

        const vmessJSON_NTLS = {
          ...vmessJSON_TLS,
          port: "80",
          tls: "none",
          ps: `${countryCode} - ${prov1} [VMess-NTLS]`
        };

        configText = "``````VMESS-TLS\nvmess://" + toBase64(JSON.stringify(vmessJSON_TLS)) + "``````\n" +
          "``````VMESS-NTLS\nvmess://" + toBase64(JSON.stringify(vmessJSON_NTLS)) + "``````";

      } else if (type === 'vless') {
        configText = `\`\`\`\`\`\`VLESS-TLS
vless://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`VLESS-NTLS
vless://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else if (type === 'trojan') {
        configText = `\`\`\`\`\`\`TROJAN-TLS
trojan://${uuid}@${DEFAULT_HOST}:443?encryption=none&security=tls&sni=${DEFAULT_HOST}&fp=randomized&type=ws&host=${DEFAULT_HOST}&path=${path}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`TROJAN-NTLS
trojan://${uuid}@${DEFAULT_HOST}:80?path=${path}&security=none&encryption=none&host=${DEFAULT_HOST}&fp=randomized&type=ws&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else if (type === 'ss') {
        configText = `\`\`\`\`\`\`SHADOWSOCKS-TLS
ss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:443?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=tls&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\`\n\`\`\`\`\`\`SHADOWSOCKS-NTLS
ss://${toBase64(`none:${uuid}`)}@${DEFAULT_HOST}:80?encryption=none&type=ws&host=${DEFAULT_HOST}&path=${path}&security=none&sni=${DEFAULT_HOST}#${prov}
\`\`\`\`\`\``;

      } else {
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Protokol tidak dikenali." });
        return;
      }

      const infoText = `✅ *Konfigurasi ${type.toUpperCase()} untuk ${getFlagEmoji(countryCode)} ${countryCode} :*\n` +
        "```" + configText + "```";

      await bot.sendMessage(chatId, infoText, { parse_mode: 'Markdown' });
      await bot.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('Error generating config:', error);
      await bot.sendMessage(chatId, `⚠️ *Gagal membuat konfigurasi: ${error.message}*`, { parse_mode: 'Markdown' });
    }
    return;
  }

  await bot.answerCallbackQuery(callbackQuery.id);
}
