const cfg = window.GAMEVOLT_CONFIG || {};
const supabaseReady = Boolean(window.supabase && cfg.supabaseUrl && cfg.supabasePublishableKey && !cfg.supabasePublishableKey.startsWith('PASTE_'));
const db = supabaseReady ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey) : null;
const money = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const $ = s => document.querySelector(s);
const state = { products: [], cart: [], category:'Semua', user:null, toastTimer:null };
const demoProducts = [
 {id:'demo-ml',name:'Diamond Mobile Legends',category:'Mobile',description:'Top up diamond MLBB · nominal pilihan',price:15000,icon:'💎',color:'#0d75b9',tag:'POPULER'},
 {id:'demo-ff',name:'Free Fire Diamonds',category:'Mobile',description:'Diamond Free Fire untuk item favorit',price:12000,icon:'🔥',color:'#9d3e18',tag:'HOT'},
 {id:'demo-pubg',name:'UC PUBG Mobile',category:'Mobile',description:'Unknown Cash PUBG Mobile',price:28000,icon:'🎯',color:'#a66b18',tag:'HOT'},
 {id:'demo-genshin',name:'Genesis Crystal',category:'Mobile',description:'Crystal untuk petualangan Genshin',price:25000,icon:'✧',color:'#5543bb',tag:'PILIHAN'},
 {id:'demo-valorant',name:'Valorant Points',category:'PC',description:'VP untuk skin dan item Valorant',price:50000,icon:'⚔',color:'#a52b50',tag:'PC'},
 {id:'demo-robux',name:'Robux Voucher',category:'Voucher',description:'Voucher digital untuk Roblox',price:18000,icon:'◈',color:'#47617b',tag:'VOUCHER'}
];
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
function safeText(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function renderProducts(){
 const list=state.products.filter(p=>(state.category==='Semua'||p.category===state.category)&&(`${p.name} ${p.category} ${p.description||''}`).toLowerCase().includes(($('#searchInput')?.value||'').toLowerCase()));
 $('#productGrid').innerHTML=list.length?list.map(p=>`<article class="product-card"><div class="product-art" style="--art:${safeText(p.color||'#0b638e')}"><span class="product-badge">${safeText(p.tag||'DIGITAL')}</span><span class="product-symbol">${safeText(p.icon||'✦')}</span></div><div class="product-body"><h3>${safeText(p.name)}</h3><div class="product-desc">${safeText(p.description||'Produk game digital')}</div><div class="product-price">${money(p.price)} <small>/ item</small></div><button class="product-buy" data-buy="${safeText(p.id)}">Pilih Produk ↗</button></div></article>`).join(''):'<div class="empty-state">Produk tidak ditemukan. Coba kata kunci lain.</div>';
}
async function loadProducts(){
 if(db){
   try{
    const {data,error}=await db.from('products').select('id,name,category,description,price,icon,color,tag,is_active').eq('is_active',true).order('created_at',{ascending:false});
    if(error) throw error;
    if(data?.length){state.products=data;renderProducts();return}
   }catch(e){console.warn('Supabase products:',e.message)}
 }
 state.products=demoProducts;renderProducts();
 if(!db) console.info('Mode preview: konfigurasi Supabase belum lengkap; produk contoh ditampilkan.');
}
function openModal(content){$('#modalContent').innerHTML=content;$('#modalBackdrop').hidden=false}
function closeModal(){$('#modalBackdrop').hidden=true;$('#modalContent').innerHTML=''}
function cartCount(){$('#cartCount').textContent=state.cart.reduce((n,x)=>n+x.qty,0)}
function productById(id){return state.products.find(p=>String(p.id)===String(id))}
function showCheckout(id){
 const product=productById(id);if(!product)return;
 state.cart=[{...product,qty:1}];
 openModal(`<div class="eyebrow">CHECKOUT AMAN</div><h2 id="modalTitle">Buat Pesanan</h2><p>Produk: <b>${safeText(product.name)}</b></p><div class="payment-total">${money(product.price)}</div><form id="checkoutForm" class="modal-form"><label>Nama pemesan<input name="customer" required maxlength="80" placeholder="Nama kamu"></label><label>Nomor WhatsApp<input name="phone" required maxlength="25" placeholder="08xxxxxxxxxx"></label><label>ID game / catatan (jika diperlukan)<input name="gameId" maxlength="100" placeholder="ID game dan server"></label><label>Email akun (opsional)<input name="email" type="email" maxlength="150" placeholder="email@example.com"></label><div class="notice">Setelah pesanan dibuat, scan QRIS lalu kirim bukti pembayaran secara manual ke WhatsApp admin. Pesanan belum dianggap lunas sebelum diverifikasi.</div><button class="btn" type="submit">Buat Pesanan & Lihat QRIS →</button></form>`);
 $('#checkoutForm').addEventListener('submit',e=>createOrder(e,product));
}
function orderCode(){return 'GV-'+Math.random().toString(36).slice(2,10).toUpperCase()}
async function createOrder(e,product){
 e.preventDefault();const form=new FormData(e.currentTarget);
 const order={order_number:orderCode(),customer_name:String(form.get('customer')).trim(),customer_phone:String(form.get('phone')).trim(),game_id:String(form.get('gameId')||'').trim(),customer_email:String(form.get('email')||'').trim()||null,product_id:typeof product.id==='string'&&product.id.startsWith('demo-')?null:product.id,product_name:product.name,amount:Number(product.price),payment_method:'qris_manual',payment_status:'pending',order_status:'awaiting_payment'};
 if(db&&state.user){
  if(typeof product.id !== 'string' || product.id.startsWith('demo-')){toast('Produk preview tidak dapat dipesan. Pastikan schema SQL sudah dijalankan dan pilih produk dari database.');return}
  const {data: sessionData}=await db.auth.getSession();
  const token=sessionData.session?.access_token;
  if(!token){toast('Sesi login berakhir. Silakan masuk kembali.');return}
  try{
   const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({customer_name:order.customer_name,customer_phone:order.customer_phone,customer_email:order.customer_email,game_id:order.game_id,product_id:product.id})});
   const result=await response.json();
   if(!response.ok){toast(result.error||'Pesanan gagal dibuat.');return}
   Object.assign(order,result.order);
  }catch(err){toast('Tidak dapat menghubungi backend. Jalankan server Node.js.');return}
 }else if(db&&!state.user){
  toast('Silakan masuk terlebih dahulu agar pesanan tersimpan di akun.');return;
 }else{
  toast('Mode preview: checkout tidak disimpan ke database. Konfigurasikan Supabase untuk transaksi nyata.');
  return;
 }
 showQris(order);
}
function showQris(order){
 const qrisExists=true;
 const waText=`Halo Admin GameVolt, saya ingin konfirmasi pembayaran QRIS.\nNomor pesanan: ${order.order_number}\nProduk: ${order.product_name}\nNominal: ${money(order.amount)}\nNama: ${order.customer_name}\nSaya akan melampirkan bukti pembayaran pada chat ini.`;
 openModal(`<div class="eyebrow">PEMBAYARAN MANUAL</div><h2 id="modalTitle">Scan QRIS</h2><p>Pesanan <b>${safeText(order.order_number)}</b> — ${safeText(order.product_name)}</p><div class="payment-total">${money(order.amount)}</div>${qrisExists?'<img class="qris-image" src="/assets/qris.jpg" alt="QRIS toko">':'<p>QRIS belum diunggah oleh owner.</p>'}<div class="notice">Bayar sesuai nominal. Klik tombol WhatsApp lalu lampirkan screenshot bukti pembayaran secara manual. Jangan mengirim PIN atau OTP.</div><div class="modal-form"><button class="btn" id="sendWa">Kirim Bukti via WhatsApp ↗</button><button class="btn btn-ghost" id="copyOrder">Salin Nomor Pesanan</button></div><p>Status saat ini: <b>Menunggu pembayaran / verifikasi admin</b>.</p>`);
 $('#sendWa').addEventListener('click',()=>window.open(`https://wa.me/${cfg.whatsappAdmin||'6285165829430'}?text=${encodeURIComponent(waText)}`,'_blank','noopener'));
 $('#copyOrder').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(order.order_number);toast('Nomor pesanan disalin')}catch{toast('Nomor pesanan: '+order.order_number)}});
}
function showAuth(){openModal(`<div class="eyebrow">AKUN GAMEVOLT</div><h2 id="modalTitle">Masuk / Daftar</h2><p>Gunakan email untuk menyimpan pesanan di akunmu.</p><form id="authForm" class="modal-form"><label>Email<input name="email" type="email" required autocomplete="email" placeholder="email@example.com"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="current-password" placeholder="Minimal 8 karakter"></label><button class="btn" type="submit">Masuk</button><button class="btn btn-ghost" type="button" id="signupBtn">Buat akun baru</button></form><p id="authNote">Konfirmasi email mungkin diperlukan sesuai pengaturan Supabase.</p>`);
 $('#authForm').addEventListener('submit',async e=>{e.preventDefault();if(!db){toast('Konfigurasikan Supabase dahulu.');return}const f=new FormData(e.currentTarget);const {data,error}=await db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){toast(error.message);return}state.user=data.user;updateAuth();closeModal();toast('Berhasil masuk')});
 $('#signupBtn').addEventListener('click',async()=>{if(!db){toast('Konfigurasikan Supabase dahulu.');return}const f=new FormData($('#authForm'));if(!f.get('email')||String(f.get('password')).length<8){toast('Isi email dan password minimal 8 karakter.');return}const {error}=await db.auth.signUp({email:f.get('email'),password:f.get('password')});toast(error?error.message:'Pendaftaran berhasil. Periksa email jika konfirmasi diaktifkan.')});
}
function updateAuth(){$('#authOpen').textContent=state.user?(state.user.email.split('@')[0]+' · Keluar'):'Masuk / Daftar';}
async function trackOrder(e){e.preventDefault();const num=$('#orderNumber').value.trim().toUpperCase();const result=$('#trackResult');if(!db){result.textContent='Database belum dikonfigurasi. Pesanan mode preview tidak tersimpan setelah halaman ditutup.';return}if(!state.user){result.textContent='Masuk terlebih dahulu untuk melihat status pesanan yang terhubung dengan akunmu.';showAuth();return}const {data,error}=await db.from('orders').select('order_number,product_name,amount,payment_status,order_status,created_at').eq('order_number',num).eq('user_id',state.user.id).maybeSingle();if(error){result.textContent='Gagal membaca pesanan. Periksa konfigurasi SQL/RLS.';return}if(!data){result.textContent='Pesanan tidak ditemukan pada akun ini.';return}result.innerHTML=`<b>${safeText(data.order_number)}</b> · ${safeText(data.product_name)} · ${money(data.amount)}<br>Pembayaran: <b>${safeText(data.payment_status)}</b> · Status: <b>${safeText(data.order_status)}</b>`}
function openCart(){if(!state.cart.length){openModal('<div class="eyebrow">KERANJANG</div><h2 id="modalTitle">Keranjang kamu masih kosong</h2><p>Pilih produk dari katalog untuk memulai checkout.</p><button class="btn" id="browseProducts">Jelajahi produk</button>');$('#browseProducts').addEventListener('click',()=>{closeModal();$('#products').scrollIntoView()});return}showCheckout(state.cart[0].id)}
function openAi(){openModal(`<div class="eyebrow">GAMEVOLT AI</div><h2 id="modalTitle">AI Store Assistant</h2><p>Tanya tentang cara belanja, produk, atau bantuan umum. AI tidak memverifikasi pembayaran.</p><div class="chat-window" id="chatWindow"><div class="chat-msg">Hai! Aku asisten GameVolt. Ada yang bisa kubantu? Untuk status pembayaran, admin tetap perlu memverifikasi bukti.</div></div><form class="chat-row" id="chatForm"><input class="chat-input" id="chatInput" maxlength="1500" required placeholder="Tulis pertanyaan..." aria-label="Pesan untuk AI"><button class="btn" type="submit">Kirim</button></form>`);
 $('#chatForm').addEventListener('submit',async e=>{e.preventDefault();const input=$('#chatInput'),msg=input.value.trim();if(!msg)return;const win=$('#chatWindow');win.insertAdjacentHTML('beforeend',`<div class="chat-msg user">${safeText(msg)}</div>`);input.value='';const loading=document.createElement('div');loading.className='chat-msg';loading.textContent='AI sedang berpikir…';win.appendChild(loading);win.scrollTop=win.scrollHeight;try{const r=await fetch('/api/ai-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});const data=await r.json();loading.textContent=data.reply||data.error||'AI belum bisa menjawab.'}catch{loading.textContent='Server AI belum aktif. Jalankan backend terlebih dahulu.'}win.scrollTop=win.scrollHeight});
}
document.addEventListener('click',e=>{const buy=e.target.closest('[data-buy]');if(buy)showCheckout(buy.dataset.buy);const filter=e.target.closest('[data-category]');if(filter){state.category=filter.dataset.category;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===filter));renderProducts()}});
$('#searchInput').addEventListener('input',renderProducts);
$('#cartOpen').addEventListener('click',openCart);
$('#authOpen').addEventListener('click',()=>{if(state.user){db?.auth.signOut();state.user=null;updateAuth();toast('Kamu telah keluar')}else showAuth()});
$('#modalClose').addEventListener('click',closeModal);
$('#modalBackdrop').addEventListener('click',e=>{if(e.target===$('#modalBackdrop'))closeModal()});
$('#askAi').addEventListener('click',openAi);
$('#contactAdmin').addEventListener('click',()=>window.open(`https://wa.me/${cfg.whatsappAdmin||'6285165829430'}`,'_blank','noopener'));
$('#trackForm').addEventListener('submit',trackOrder);
$('#year').textContent=new Date().getFullYear();
(async()=>{if(db){const {data}=await db.auth.getSession();state.user=data.session?.user||null;updateAuth();db.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;updateAuth()})}await loadProducts()})();
