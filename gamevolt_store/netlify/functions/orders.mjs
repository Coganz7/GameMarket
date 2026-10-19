import { createClient } from '@supabase/supabase-js';
export default async (request) => {
 if(request.method!=='POST') return json({error:'Method tidak diizinkan.'},405);
 const authHeader=request.headers.get('authorization')||''; const token=authHeader.startsWith('Bearer ')?authHeader.slice(7):'';
 if(!token) return json({error:'Silakan masuk terlebih dahulu.'},401);
 const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key) return json({error:'Checkout belum dikonfigurasi. Owner perlu mengatur SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di Netlify Environment variables.'},503);
 let body; try{body=await request.json()}catch{return json({error:'Format permintaan tidak valid.'},400)}
 const {customer_name,customer_phone,customer_email,game_id,product_id}=body||{};
 if(typeof customer_name!=='string'||customer_name.trim().length<2||customer_name.length>80||typeof customer_phone!=='string'||customer_phone.trim().length<8||customer_phone.length>25) return json({error:'Nama dan nomor WhatsApp wajib valid.'},400);
 if(typeof product_id!=='string') return json({error:'Produk tidak valid.'},400);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await admin.auth.getUser(token); if(userError||!userData?.user)return json({error:'Sesi login tidak valid. Silakan masuk kembali.'},401);
 const {data:product,error:productError}=await admin.from('products').select('id,name,price,is_active').eq('id',product_id).eq('is_active',true).single(); if(productError||!product)return json({error:'Produk tidak ditemukan atau sedang tidak tersedia.'},400);
 const orderNumber='GV-'+crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase();
 const {data:order,error}=await admin.from('orders').insert({order_number:orderNumber,user_id:userData.user.id,customer_name:customer_name.trim(),customer_phone:customer_phone.trim(),customer_email:typeof customer_email==='string'&&customer_email.length<=150?customer_email:null,game_id:typeof game_id==='string'&&game_id.length<=100?game_id.trim():null,product_id:product.id,product_name:product.name,amount:product.price,payment_method:'qris_manual',payment_status:'pending',order_status:'awaiting_payment'}).select('order_number,product_name,amount,customer_name,customer_phone').single();
 if(error){console.error('Order insert error',error.message);return json({error:'Pesanan gagal disimpan. Periksa schema database.'},500)}
 return json({order},201);
};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
