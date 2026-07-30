// ============================================================
// Carimba uma versão nova no service worker antes de cada build.
//
// O navegador só percebe que existe uma atualização do app quando o
// ARQUIVO /sw.js muda de conteúdo (comparação byte a byte). Por isso,
// sem isso, publicar uma mudança no app não dispara nenhum aviso de
// atualização — o service worker antigo continua servindo a versão
// antiga do cache pra sempre.
//
// Rodando isso a cada build (ver "prebuild" no package.json), o
// CACHE_NAME do sw.js muda sempre, o que faz o navegador detectar a
// atualização sozinho, baixar o novo service worker em segundo plano
// e disparar o fluxo de "nova versão disponível" implementado em
// src/lib/registerServiceWorker.ts.
// ============================================================

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const version = `${Date.now()}`;

let contents = fs.readFileSync(swPath, 'utf8');

const stamped = contents.replace(
  /const CACHE_NAME = ['"].*?['"];/,
  `const CACHE_NAME = 'zoada-${version}';`
);

if (stamped === contents) {
  console.warn('[stamp-sw] Não encontrei a linha de CACHE_NAME em public/sw.js — nada foi alterado.');
} else {
  fs.writeFileSync(swPath, stamped, 'utf8');
  console.log(`[stamp-sw] public/sw.js atualizado para zoada-${version}`);
}
