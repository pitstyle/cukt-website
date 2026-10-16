// build.mjs — node build.mjs  -> writes build.html
import fs from 'node:fs'; import {buildSync} from 'esbuild';
const r=(f,e)=>fs.readFileSync(f,e); const b64=f=>r(f).toString('base64');
const pre=buildSync({stdin:{contents:'export * from "@chenglou/pretext"',resolveDir:process.cwd()},bundle:true,format:'iife',globalName:'Pretext',write:false}).outputFiles[0].text;
const blocks=JSON.parse(r('blocks-hy.json','utf8')).filter(b=>!/^[-—\s]*$/.test(b.t));
const cfg=r('cfg.json','utf8').trim();
let html=r('template.html','utf8');
const rep={'__FONT__':b64('fonts/JetBrainsMono[wght].ttf'),'__BEBAS__':b64('fonts/BebasNeue-Regular.ttf'),'__LOGO__':r('logo.b64','utf8').trim(),
 '__BLOCKS__':JSON.stringify(blocks),'__CFG__':cfg,'__KICK__':'projekt ustawy'};
for(const [k,v] of Object.entries(rep)) html=html.split(k).join(v);
html=html.split('__PRETEXT__').join(pre);   // pretext last (its code could contain none of the tokens)
fs.writeFileSync('build.html',html); console.log('build.html',html.length);
