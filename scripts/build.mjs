import fs from 'node:fs/promises';
const file=new URL('../dist/index.html',import.meta.url);
let html=await fs.readFile(file,'utf8');
const host=process.env.SITE_URL||process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
let origin;
if(host){const u=new URL(host.includes('://')?host:'https://'+host);if(!['http:','https:'].includes(u.protocol))throw Error('SITE_URL must be an HTTP(S) address');origin=u.origin;}
html=html.replace(/<link rel="canonical"[^>]*>\s*/g,'').replace(/<meta property="og:(?:url|image)"[^>]*>\s*/g,'');
html=html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_,json)=>{const schema=JSON.parse(json);if(origin)schema.url=origin+'/';else delete schema.url;return '<script type="application/ld+json">'+JSON.stringify(schema)+'</script>';});
if(origin)html=html.replace('</head>',()=>'<link rel="canonical" href="'+origin+'/"><meta property="og:url" content="'+origin+'/"><meta property="og:image" content="'+origin+'/assets/sushi.webp"></head>');
await fs.writeFile(file,html);
console.log('Static website ready in dist/.'+(origin?' Site URL: '+origin:''));
