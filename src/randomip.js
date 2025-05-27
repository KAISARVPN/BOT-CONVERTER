const ipDetailsMap = new Map();

export function getFlagEmoji(countryCode = '') {
  const code = countryCode.trim().toUpperCase();
  return code.length === 2
    ? String.fromCodePoint(...[...code].map(c => 0x1f1e6 + c.charCodeAt(0) - 65))
    : '';
}

/**
 * Menghasilkan teks dan tombol dengan paging.
 * @param {string|number} userId 
 * @param {number} page - halaman mulai 1
 * @returns {Promise<{text:string, buttons:Array}>}
 */
export async function randomip(userId, page = 1) {
  try {
    const response = await fetch('https://raw.githubusercontent.com/jaka2m/botak/refs/heads/main/cek/proxyList.txt');
    const ipText = await response.text();
    const ipList = ipText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '');

    if (ipList.length === 0) {
      return { text: '❌ Tidak ada IP yang tersedia.', buttons: [] };
    }

    // Ambil 100 IP random supaya paging lebih berasa (atau bisa sesuai kebutuhan)
    const shuffled = ipList.sort(() => 0.5 - Math.random());
    const totalIPs = Math.min(100, shuffled.length);
    const selectedIPs = shuffled.slice(0, totalIPs);

    // Kelompokkan detail by country code
    const detailsByCountry = {};
    selectedIPs.forEach(line => {
      const [ip, port, code, isp] = line.split(',');
      const flag = getFlagEmoji(code);
      const detail = `📍 *IP:PORT*: \`${ip}:${port}\`\n🌐 *Country*: ${code} ${flag}\n💻 *ISP*: ${isp}`;
      if (!detailsByCountry[code]) {
        detailsByCountry[code] = [];
      }
      detailsByCountry[code].push(detail);
    });

    // Simpan ke map untuk user
    ipDetailsMap.set(userId, detailsByCountry);

    // Buat tombol per negara, 3 per baris, maksimal 12 tombol per halaman (4 baris)
    const countryCodes = Object.keys(detailsByCountry).sort();
    const buttonsPerPage = 12; // 3 tombol x 4 baris
    const totalPages = Math.ceil(countryCodes.length / buttonsPerPage);
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * buttonsPerPage;
    const end = start + buttonsPerPage;
    const pageCountries = countryCodes.slice(start, end);

    // Tombol negara 3 per baris
    const buttons = [];
    for (let i = 0; i < pageCountries.length; i += 3) {
      const row = pageCountries.slice(i, i + 3).map(code => ({
        text: getFlagEmoji(code) + ' ' + code,
        callback_data: `DETAIL_${code}`
      }));
      buttons.push(row);
    }

    // Tombol navigasi Prev/Next di baris baru
    const navButtons = [];
    if (page > 1) {
      navButtons.push({ text: '⬅️ Prev', callback_data: `PAGE_${page - 1}` });
    }
    if (page < totalPages) {
      navButtons.push({ text: 'Next ➡️', callback_data: `PAGE_${page + 1}` });
    }
    if (navButtons.length) buttons.push(navButtons);

    const text = `🔑 *Here are ${totalIPs} random Proxy IPs:*\n\nTekan bendera untuk detail:\nHalaman ${page} dari ${totalPages}`;
    return { text, buttons };
  } catch (error) {
    return { text: '❌ Gagal mengambil data IP.', buttons: [] };
  }
}

export function getIpDetail(userId, countryCode) {
  const map = ipDetailsMap.get(userId);
  if (!map) return null;
  return map[countryCode] || null;
}
