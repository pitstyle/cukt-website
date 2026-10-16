// render.mjs — node render.mjs  -> habeas-mentem-ustawa-druk-E3-A4.pdf + habeas-mentem-ustawa-druk-E3.html (static, no JS)
import {chromium} from 'playwright'; import fs from 'node:fs'; import path from 'node:path';
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:794,height:1123}});
await p.goto('file://'+path.resolve('build.html')); await p.waitForFunction('window.DONE',null,{timeout:60000});
console.log('pages',await p.evaluate('window.DONE'));
fs.writeFileSync('habeas-mentem-ustawa-druk-E3.html','<!doctype html>'+await p.evaluate('document.documentElement.outerHTML'));
await p.emulateMedia({media:'print'});
await p.pdf({path:'habeas-mentem-ustawa-druk-E3-A4.pdf',format:'A4',printBackground:true,margin:{top:0,bottom:0,left:0,right:0}});
await b.close();
