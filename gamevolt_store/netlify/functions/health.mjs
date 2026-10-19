export default async () => new Response(JSON.stringify({ok:true,app:'GameVolt',runtime:'Netlify Functions',time:new Date().toISOString()}), {headers:{'content-type':'application/json'}});
