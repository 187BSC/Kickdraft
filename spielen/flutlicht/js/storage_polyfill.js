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
function ok(v){return Promise.resolve(v);}window.storage={get:function(k){try{var r=entpacke(localStorage.getItem(P+k));return ok(r===null?null:{key:k,value:r});}catch(e){return ok(null);}},set:function(k,v){try{localStorage.setItem(P+k,packe(v));return ok({key:k,value:String(v)});}catch(e){voll(e);return ok(null);}},delete:function(k){try{localStorage.removeItem(P+k);return ok({key:k,deleted:true});}catch(e){return ok(null);}},list:function(p){try{var o=[],pp=P+(p||'');for(var i=0;i<localStorage.length;i++){var kk=localStorage.key(i);if(kk&&kk.indexOf(pp)===0)o.push(kk.slice(P.length));}return ok({keys:o});}catch(e){return ok({keys:[]});}}};console.log('[StoragePolyfill] aktiv (Präfix fl_)');})();
