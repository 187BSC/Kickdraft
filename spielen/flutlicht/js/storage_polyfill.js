/* === STORAGE-POLYFILL (iPhone/Android/PC) === */
/* Flutlicht (2026-10-15, eine App mit Kickdraft): eigene Schlüssel 'fl_' statt 'fm_'. Kickdraft nutzt weiter 'fm_' –
   beide Spiele liegen in der Gesamt-App auf derselben Adresse und würden sich sonst Spielstand-Index und Slots teilen
   (Kickdraft packt außerdem alle 'fm_fcm-save-*' mit LZ ein, das Flutlicht nicht lesen kann).
   Umzug: Beim ersten Start wandern Flutlicht-Stände von 'fm_' nach 'fl_'. Kickdraft-Stände (gepackt oder mit dflWelt)
   bleiben, wo sie sind. Einmalig, Merker 'fl_umzug'. */
(function(){if(window.storage&&typeof window.storage.get==='function')return;var P='fl_',ALT='fm_';
function umzug(){try{if(localStorage.getItem(P+'umzug'))return;var keys=[],i;for(i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf(ALT)===0)keys.push(k);}
var SLOT=/^fcm-save-(.+)-(league|cup|club|market)$/,kd={};
keys.forEach(function(k){var m=SLOT.exec(k.slice(ALT.length));if(m&&m[2]==='league'){var v=localStorage.getItem(k)||'';if(v.charCodeAt(0)===1||v.indexOf('"dflWelt"')>=0)kd[m[1]]=1;}});
var idxRoh=localStorage.getItem(ALT+'fcm-saves-index'),idx=null;try{idx=idxRoh?JSON.parse(idxRoh):null;}catch(e){idx=null;}
if(idx&&idx.slots)idx.slots.forEach(function(s){if(s&&(s.franchise||s.dfl))kd[s.id]=1;});
var kdDa=Object.keys(kd).length>0,n=0;
keys.forEach(function(k){var kurz=k.slice(ALT.length),m=SLOT.exec(kurz);
if(kurz==='fcm-saves-index')return;if(m&&kd[m[1]])return;
if(!m&&kdDa&&!/^fcm-/.test(kurz))return;           // fremde Kickdraft-Einstellungen nicht mitnehmen
if(localStorage.getItem(P+kurz)===null){localStorage.setItem(P+kurz,localStorage.getItem(k));n++;}
if(m)localStorage.removeItem(k);});              // nur Slots verschieben, Einstellungen bleiben zusätzlich stehen
if(idx&&idx.slots){var fl={slots:idx.slots.filter(function(s){return s&&!kd[s.id];}),activeId:null};
if(idx.activeId&&!kd[idx.activeId])fl.activeId=idx.activeId;
if(fl.slots.length&&localStorage.getItem(P+'fcm-saves-index')===null)localStorage.setItem(P+'fcm-saves-index',JSON.stringify(fl));
var rest={slots:idx.slots.filter(function(s){return s&&kd[s.id];}),activeId:kd[idx.activeId]?idx.activeId:null};
if(rest.slots.length)localStorage.setItem(ALT+'fcm-saves-index',JSON.stringify(rest));else localStorage.removeItem(ALT+'fcm-saves-index');}
localStorage.setItem(P+'umzug','1');if(n)console.log('[StoragePolyfill] '+n+' Einträge von fm_ nach fl_ umgezogen');}catch(e){console.warn('[StoragePolyfill] Umzug',e);}}
umzug();
/* 2026-10-15: große Werte (Spielstand: Verein mit lebender Welt ~1,5 Mio Zeichen) komprimiert (LZ, Marke \u0002LZ:) – sonst
   passten nur 3 Spielstände in den Speicher, den sich in der Gesamt-App auch Kickdraft teilt. Speicherfehler werden gemeldet. */
var LZM='\u0002LZ:',LZAB=20000;function packe(v){v=String(v);if(v.length<LZAB||!window.LZString)return v;try{return LZM+LZString.compressToUTF16(v);}catch(e){return v;}}
function entpacke(r){if(r&&r.charCodeAt(0)===2&&r.indexOf(LZM)===0){try{return window.LZString?LZString.decompressFromUTF16(r.slice(LZM.length)):null;}catch(e){return null;}}return r;}
var gemeldet=0;function voll(e){console.warn('[StoragePolyfill] Speichern fehlgeschlagen',e);if(Date.now()-gemeldet>60000){gemeldet=Date.now();try{var t='Speichern fehlgeschlagen – der Gerätespeicher ist voll. Lösche alte Spielstände.';if(typeof window.showToast==='function')window.showToast(t,'warn');else alert(t);}catch(x){}}}
function ok(v){return Promise.resolve(v);}/* 2026-10-23 (Website-Demo, Nutzer: „flüssiger ohne Hänger“): LZ-Packen in JavaScript kostete je Speichern ~0,6 s (Handy 2+ s) und fror
   das Spiel nach jeder Woche ein. Neu: native Kompression des Browsers (CompressionStream deflate-raw, Marke \u0002GZ:, 15 Bit je Zeichen
   wie LZ-UTF16 – ohne Ersatzzeichen-Bereich), asynchron. Je Schlüssel gilt nur der neueste Auftrag; noch nicht geschriebene Werte liest get
   direkt aus dem Auftrag; beim Verlassen der Seite wird Offenes sofort (LZ) geschrieben. Ohne CompressionStream wie bisher LZ. */
var GZM='\u0002GZ:',GZ=typeof CompressionStream==='function'&&typeof DecompressionStream==='function'&&typeof TextEncoder==='function',offen={},nr={};
function zuText(b){var n=b.length,o=[],acc=0,bits=0,i;o.push(String.fromCharCode(32+(n>>>15&32767)),String.fromCharCode(32+(n&32767)));
for(i=0;i<n;i++){acc=acc<<8|b[i];bits+=8;if(bits>=15){bits-=15;o.push(String.fromCharCode(32+(acc>>>bits&32767)));}acc&=(1<<bits)-1;}
if(bits>0)o.push(String.fromCharCode(32+(acc<<15-bits&32767)));var t='',j;for(j=0;j<o.length;j+=8192)t+=o.slice(j,j+8192).join('');return t;}
function ausText(t){var n=(t.charCodeAt(0)-32)*32768+(t.charCodeAt(1)-32),b=new Uint8Array(n),acc=0,bits=0,k=0,i;
for(i=2;i<t.length&&k<n;i++){acc=acc<<15|(t.charCodeAt(i)-32);bits+=15;while(bits>=8&&k<n){bits-=8;b[k++]=acc>>>bits&255;}acc&=(1<<bits)-1;}return b;}
function gzPacken(v){return new Response(new Blob([new TextEncoder().encode(v)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer().then(function(a){return GZM+zuText(new Uint8Array(a));});}
function gzEntpacken(r){return new Response(new Blob([ausText(r.slice(GZM.length))]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();}
function lesen(roh){if(roh&&roh.charCodeAt(0)===2&&roh.indexOf(GZM)===0)return gzEntpacken(roh).catch(function(){return null;});return Promise.resolve(entpacke(roh));}
function schreibOffen(){Object.keys(offen).forEach(function(k){try{localStorage.setItem(P+k,packe(offen[k]));}catch(e){voll(e);}delete offen[k];});}
window.addEventListener('pagehide',schreibOffen);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')schreibOffen();});
window.storage={get:function(k){try{if(k in offen)return ok({key:k,value:offen[k]});return lesen(localStorage.getItem(P+k)).then(function(r){return r===null?null:{key:k,value:r};},function(){return null;});}catch(e){return ok(null);}},
set:function(k,v){v=String(v);try{if(!GZ||v.length<LZAB){delete offen[k];nr[k]=(nr[k]||0)+1;localStorage.setItem(P+k,packe(v));return ok({key:k,value:v});}
var mein=nr[k]=(nr[k]||0)+1;offen[k]=v;return gzPacken(v).then(function(z){if(nr[k]!==mein)return{key:k,value:v};try{localStorage.setItem(P+k,z);}catch(e){voll(e);return null;}if(offen[k]===v)delete offen[k];return{key:k,value:v};},
function(){if(nr[k]!==mein)return{key:k,value:v};try{localStorage.setItem(P+k,packe(v));}catch(e){voll(e);return null;}if(offen[k]===v)delete offen[k];return{key:k,value:v};});}catch(e){voll(e);return ok(null);}},delete:function(k){try{delete offen[k];nr[k]=(nr[k]||0)+1;localStorage.removeItem(P+k);return ok({key:k,deleted:true});}catch(e){return ok(null);}},list:function(p){try{var o=[],pp=P+(p||'');for(var i=0;i<localStorage.length;i++){var kk=localStorage.key(i);if(kk&&kk.indexOf(pp)===0)o.push(kk.slice(P.length));}return ok({keys:o});}catch(e){return ok({keys:[]});}}};console.log('[StoragePolyfill] aktiv (Präfix fl_, '+(GZ?'native Kompression':'LZ')+')');})();
