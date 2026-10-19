import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '30kb' }));
app.use(express.static('public'));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'GameVolt', time: new Date().toISOString() });
});

// Trusted order creation. Requires a server-only Supabase service-role key.
app.post('/api/orders', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: 'Checkout database belum dikonfigurasi. Owner perlu mengisi SUPABASE_SERVICE_ROLE_KEY di .env server.' });
  }
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan masuk kembali.' });
  const { customer_name, customer_phone, customer_email, game_id, product_id } = req.body || {};
  if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 80 || typeof customer_phone !== 'string' || customer_phone.trim().length < 8 || customer_phone.length > 25) {
    return res.status(400).json({ error: 'Nama dan nomor WhatsApp wajib valid.' });
  }
  if (typeof product_id !== 'string') return res.status(400).json({ error: 'Produk tidak valid. Muat katalog dari database lalu pilih produk lagi.' });
  const { data: product, error: productError } = await admin.from('products').select('id,name,price,is_active').eq('id', product_id).eq('is_active', true).single();
  if (productError || !product) return res.status(400).json({ error: 'Produk tidak ditemukan atau sedang tidak tersedia.' });
  const orderNumber = 'GV-' + crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const { data: order, error: insertError } = await admin.from('orders').insert({
    order_number: orderNumber, user_id: userData.user.id, customer_name: customer_name.trim(),
    customer_phone: customer_phone.trim(), customer_email: typeof customer_email === 'string' && customer_email.length <= 150 ? customer_email : null,
    game_id: typeof game_id === 'string' && game_id.length <= 100 ? game_id.trim() : null,
    product_id: product.id, product_name: product.name, amount: product.price,
    payment_method: 'qris_manual', payment_status: 'pending', order_status: 'awaiting_payment'
  }).select('order_number,product_name,amount,customer_name,customer_phone').single();
  if (insertError) { console.error('Order insert error:', insertError.message); return res.status(500).json({ error: 'Pesanan gagal disimpan. Periksa schema database.' }); }
  return res.status(201).json({ order });
});

// The key stays server-side. If no key is configured, return a clear setup message.
app.post('/api/ai-chat', async (req, res) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 1500) {
    return res.status(400).json({ error: 'Pesan wajib diisi dan maksimal 1500 karakter.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      reply: 'AI belum diaktifkan. Owner perlu mengisi OPENAI_API_KEY di file .env lalu restart server.',
      configured: false
    });
  }
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        instructions: 'Kamu adalah asisten toko game digital GameVolt berbahasa Indonesia. Bantu menjelaskan cara belanja dan produk secara sopan. Jangan pernah mengklaim pembayaran telah terverifikasi. Untuk pembayaran, arahkan pengguna mengirim bukti manual ke WhatsApp admin. Jangan mengarang stok, harga, atau status pesanan.',
        input: message,
        max_output_tokens: 350
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('AI provider error:', response.status, data?.error?.message || 'unknown');
      return res.status(502).json({ error: 'Layanan AI sedang bermasalah. Coba lagi nanti.' });
    }
    const reply = (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text)
      .join('\n') || 'Maaf, aku belum bisa menjawab sekarang.';
    return res.json({ reply, configured: true });
  } catch (err) {
    console.error('AI request failed:', err.message);
    return res.status(502).json({ error: 'Tidak dapat menghubungi layanan AI.' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(new URL('../public/index.html', import.meta.url).pathname);
});

app.listen(port, () => console.log(`GameVolt berjalan di http://localhost:${port}`));
