function getFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return countryCode
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('');
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function randomconfig() {
  try {
    const HOSTKU = 'joss.krikkrik.tech';

    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/main/cek/proxyList.txt');
    if (!response.ok) return '⚠️ Gagal mengambil daftar proxy.';
    const ipText = await response.text();
    const ipList = ipText.split('\n').filter(line => line.trim() !== '');
    const randomProxy = ipList[Math.floor(Math.random() * ipList.length)];
    const [ip, port, country, provider] = randomProxy.split(',');

    if (!ip || !port) return '⚠️ Data IP tidak lengkap.';

    const checkResponse = await fetch(`https://api.checker-ip.web.id/check?ip=${ip}:${port}`);
    if (!checkResponse.ok) return `⚠️ Gagal cek status IP ${ip}:${port}.`;
    const data = await checkResponse.json();

    if (data.status?.toUpperCase() !== 'ACTIVE') {
      return `⚠️ IP ${ip}:${port} tidak aktif.`;
    }

    const flag = getFlagEmoji(data.country);
    const path = `/Free-VPN-CF-Geo-Project/${ip}=${port}`;

    const toBase64 = (str) => {
      if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
      else return Buffer.from(str, 'utf-8').toString('base64');
    };

    const infoMessage = `
IP      : ${data.ip}
PORT    : ${data.port}
ISP     : ${data.isp}
COUNTRY : ${data.country}
DELAY   : ${data.delay}
STATUS  : ${data.status}
`;

    const vlessUUID = generateUUID();
    const trojanUUID = generateUUID();
    const ssPassword = generateUUID();

    const vlessTLSLink = `vless://${vlessUUID}@${HOSTKU}:443?encryption=none&security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

    const trojanTLSLink = `trojan://${trojanUUID}@${HOSTKU}:443?security=tls&sni=${HOSTKU}&fp=randomized&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

    const ssConfig = `none:${ssPassword}`;
    const ssTLSLink = `ss://${toBase64(ssConfig)}@${HOSTKU}:443?encryption=none&type=ws&host=${HOSTKU}&path=${encodeURIComponent(path)}&security=tls&sni=${HOSTKU}#${encodeURIComponent(provider)}%20${encodeURIComponent(country)}`;

    const configText = `
\`\`\`INFORMATION
${infoMessage}
\`\`\`
\`\`\`VLESS-TLS
${vlessTLSLink}
\`\`\`
\`\`\`TROJAN-TLS
${trojanTLSLink}
\`\`\`
\`\`\`SHADOWSOCKS-TLS
${ssTLSLink}
\`\`\`

👨‍💻 Modded By : [GEO PROJECT](https://t.me/sampiiiiu)
`;
    return configText;
  } catch (error) {
    return `⚠️ Terjadi kesalahan: ${error.message}`;
  }
}
