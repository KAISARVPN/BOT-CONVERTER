// ========================================
// Main Telegram Wildcard Bot Entry Point
// ========================================
export async function WildcardBot(link) {
  console.log("Bot link:", link);
}

// ========================================
// Global Constants for Cloudflare API
// ========================================
export class KonstantaGlobalbot {
  constructor({ apiKey, rootDomain, accountID, zoneID, apiEmail, serviceName }) {
    this.apiKey = apiKey;
    this.rootDomain = rootDomain;
    this.accountID = accountID;
    this.zoneID = zoneID;
    this.apiEmail = apiEmail;
    this.serviceName = serviceName;

    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'X-Auth-Email': this.apiEmail,
      'X-Auth-Key': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  escapeMarkdownV2(text) {
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async getDomainList() {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json.result
      .filter(d => d.service === this.serviceName)
      .map(d => d.hostname);
  }

  async addSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();
    if (!domain.endsWith(this.rootDomain)) return 400;

    const registeredDomains = await this.getDomainList();
    if (registeredDomains.includes(domain)) return 409;

    try {
      const testUrl = `https://${subdomain}`;
      const domainTest = await fetch(testUrl);
      if (domainTest.status === 530) return 530;
    } catch {
      return 400;
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;
    const body = {
      environment: "production",
      hostname: domain,
      service: this.serviceName,
      zone_id: this.zoneID,
    };

    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    return res.status;
  }

  async deleteSubdomain(subdomain) {
    const domain = `${subdomain}.${this.rootDomain}`.toLowerCase();
    const urlList = `https://api.cloudflare.com/client/v4/accounts/${this.accountID}/workers/domains`;

    const listRes = await fetch(urlList, { headers: this.headers });
    if (!listRes.ok) return listRes.status;

    const listJson = await listRes.json();
    const domainObj = listJson.result.find(d => d.hostname === domain);
    if (!domainObj) return 404;

    const urlDelete = `${urlList}/${domainObj.id}`;
    const res = await fetch(urlDelete, {
      method: 'DELETE',
      headers: this.headers,
    });

    return res.status;
  }
}

// ========================================
// Telegram Bot Handler
// ========================================
export class TelegramWildcardBot {
  constructor(token, apiUrl, ownerId, globalBotInstance) {
    this.token = token;
    this.apiUrl = apiUrl || 'https://api.telegram.org';
    this.ownerId = ownerId;
    this.globalBot = globalBotInstance;
    this.handleUpdate = this.handleUpdate.bind(this);
  }

  escapeMarkdownV2(text) {
    if (this.globalBot?.escapeMarkdownV2) {
      return this.globalBot.escapeMarkdownV2(text);
    }
    return text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, '\\$1');
  }

  async handleUpdate(update) {
    if (!update.message) return new Response('OK', { status: 200 });

    async handleUpdate(update) {
  if (!update.message) return new Response('OK', { status: 200 });

  const chatId = update.message.chat.id;
  const userName = update.message.from.username || update.message.from.first_name || 'User';
  const text = update.message.text || '';

  // Admin ID (owner)
  const ownerId = this.ownerId;

  // Command: /add subdomain (any user can request)
  if (text.startsWith('/add ')) {
    const subdomain = text.split(' ')[1]?.trim();
    if (!subdomain) {
      await this.sendMessage(chatId, '❌ Format salah. Gunakan: /add subdomain');
      return new Response('OK', { status: 200 });
    }

    const fullDomain = `${subdomain}.${this.globalBot.rootDomain}`;
    const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Simpan request ke database/storage (contoh pakai this.requests)
    if (!this.requests) this.requests = {};
    if (this.requests[subdomain]) {
      await this.sendMessage(chatId, `⚠️ Domain *${fullDomain}* sudah pernah di-request, tunggu proses approval.`, { parse_mode: 'Markdown' });
      return new Response('OK', { status: 200 });
    }

    this.requests[subdomain] = {
      userId: chatId,
      userName,
      domain: fullDomain,
      status: 'pending',
      time: now,
    };

    // Kirim konfirmasi ke user requester
    const userMsg = `
✅ Request domain berhasil dikirim!

🔗 Domain: ${fullDomain}
👤 Requester: ${userName}
📅 Time: ${now}

⏳ Status: Menunggu approval admin
📬 Admin akan dinotifikasi untuk approve/reject request Anda

💡 Tip: Anda akan mendapat notifikasi ketika admin memproses request ini.
    `;
    await this.sendMessage(chatId, userMsg);

    // Kirim notif ke admin (owner) agar approve/reject
    const adminMsg = `
📢 Domain request baru:

🔗 Domain: ${fullDomain}
👤 Requester: ${userName}
📅 Time: ${now}

Gunakan /approve ${subdomain} untuk approve
atau /reject ${subdomain} untuk reject.
    `;
    await this.sendMessage(ownerId, adminMsg);

    return new Response('OK', { status: 200 });
  }

  // Admin commands
  if (chatId === ownerId) {
    // Approve
    if (text.startsWith('/approve ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain || !this.requests?.[subdomain]) {
        await this.sendMessage(chatId, '❌ Request domain tidak ditemukan.');
        return new Response('OK', { status: 200 });
      }
      const request = this.requests[subdomain];
      if (request.status !== 'pending') {
        await this.sendMessage(chatId, `⚠️ Domain ${request.domain} sudah diproses.`);
        return new Response('OK', { status: 200 });
      }

      // Panggil fungsi addSubdomain
      const status = await this.globalBot.addSubdomain(subdomain);
      if (status === 200) {
        request.status = 'approved';
        await this.sendMessage(chatId, `✅ Domain *${request.domain}* approved dan ditambahkan.`, { parse_mode: 'Markdown' });
        await this.sendMessage(request.userId, `
✅ Domain Request APPROVED

🔗 Domain: ${request.domain}
✅ Status: Disetujui oleh admin
📅 Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

🎉 Domain Anda sudah aktif, silakan gunakan sesuai kebijakan.
        `);
      } else {
        await this.sendMessage(chatId, `❌ Gagal menambahkan domain, status: ${status}`);
      }
      return new Response('OK', { status: 200 });
    }

    // Reject
    if (text.startsWith('/reject ')) {
      const subdomain = text.split(' ')[1]?.trim();
      if (!subdomain || !this.requests?.[subdomain]) {
        await this.sendMessage(chatId, '❌ Request domain tidak ditemukan.');
        return new Response('OK', { status: 200 });
      }
      const request = this.requests[subdomain];
      if (request.status !== 'pending') {
        await this.sendMessage(chatId, `⚠️ Domain ${request.domain} sudah diproses.`);
        return new Response('OK', { status: 200 });
      }

      request.status = 'rejected';

      await this.sendMessage(chatId, `❌ Domain *${request.domain}* telah ditolak.`, { parse_mode: 'Markdown' });
      await this.sendMessage(request.userId, `
❌ Domain Request REJECTED

🔗 Domain: ${request.domain}
❌ Status: Ditolak oleh admin
📅 Time: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

💡 Saran:
- Pastikan domain yang direquest sesuai dengan kebijakan
- Hubungi admin jika ada pertanyaan
- Anda bisa request domain lain yang sesuai
      `);

      return new Response('OK', { status: 200 });
    }
  }

  // Default fallback
  return new Response('OK', { status: 200 });
}

    // List Subdomains
    if (text.startsWith('/list')) {
      let domains = [];

      try {
        domains = await this.globalBot.getDomainList();
      } catch (err) {
        console.error('❌ getDomainList() error:', err);
      }

      if (domains.length === 0) {
        await this.sendMessage(chatId, '*No subdomains registered yet.*', { parse_mode: 'MarkdownV2' });
      } else {
        const formattedList = domains
          .map((d, i) => `${i + 1}\\. ${this.escapeMarkdownV2(d)}`)
          .join('\n');
        const summary = `\n\nTotal: *${domains.length}* subdomain${domains.length > 1 ? 's' : ''}`;
        await this.sendMessage(chatId, `\`\`\`List-Wildcard\n${formattedList}\`\`\`${summary}`, { parse_mode: 'MarkdownV2' });

        const fileContent = domains.map((d, i) => `${i + 1}. ${d}`).join('\n');
        await this.sendDocument(chatId, fileContent, 'wildcard-list.txt', 'text/plain');
      }

      return new Response('OK', { status: 200 });
    }

    // Default fallback
    return new Response('OK', { status: 200 });
  }

  async sendMessage(chatId, text, options = {}) {
    const payload = { chat_id: chatId, text, ...options };
    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async deleteMessage(chatId, messageId) {
    await fetch(`${this.apiUrl}/bot${this.token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
  }

  async sendDocument(chatId, content, filename, mimeType) {
    const formData = new FormData();
    formData.append('document', new Blob([content], { type: mimeType }), filename);
    formData.append('chat_id', chatId.toString());

    const response = await fetch(`${this.apiUrl}/bot${this.token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    return response.json();
  }
}
