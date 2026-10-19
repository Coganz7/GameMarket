export default async (request) => {
  if (request.method !== 'POST') return json({error:'Method tidak diizinkan.'},405);
  let body; try { body=await request.json(); } catch { return json({error:'Format permintaan tidak valid.'},400); }
  const message=typeof body?.message==='string'?body.message.trim():'';
  if(!message||message.length>1500) return json({error:'Pesan wajib diisi dan maksimal 1500 karakter.'},400);
  if(!process.env.OPENAI_API_KEY) return json({reply:'AI belum diaktifkan. Owner perlu mengisi OPENAI_API_KEY di Site configuration → Environment variables.',configured:false},503);
  try {
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:'Kamu adalah asisten toko game digital GameVolt berbahasa Indonesia. Bantu menjelaskan cara belanja dan produk secara sopan. Jangan pernah mengklaim pembayaran telah terverifikasi. Untuk pembayaran, arahkan pengguna mengirim bukti manual ke WhatsApp admin. Jangan mengarang stok, harga, atau status pesanan.',input:message,max_output_tokens:350})});
    const data=await response.json(); if(!response.ok){console.error('AI provider error',response.status);return json({error:'Layanan AI sedang bermasalah. Coba lagi nanti.'},502)}
    const reply=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||'Maaf, aku belum bisa menjawab sekarang.';
    return json({reply,configured:true});
  } catch(e){console.error('AI request failed',e);return json({error:'Tidak dapat menghubungi layanan AI.'},502)}
};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
