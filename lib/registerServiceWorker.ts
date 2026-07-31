'use client';

import { toast } from 'sonner';

// ============================================================
// Registro do service worker + fluxo de atualização do app.
//
// Sem isso, um usuário que deixa o Zôada aberto (ou instalado como PWA)
// nunca vê as mudanças publicadas: o navegador continua servindo a
// versão antiga do app a partir do cache do service worker.
//
// O que esse módulo garante:
// 1) Registra o /sw.js normalmente.
// 2) Sempre que o navegador encontra um /sw.js com conteúdo diferente
//    (o que passa a acontecer a cada build, graças ao scripts/stamp-sw.js),
//    ele baixa essa nova versão em segundo plano — sem afetar quem já
//    está usando o app.
// 3) Assim que essa nova versão termina de instalar, mostramos um aviso
//    (toast) com um botão "Atualizar". A pessoa decide quando recarregar,
//    sem perder o que estava fazendo (ex: uma música tocando).
// 4) Verifica periodicamente (e quando a aba volta a ficar visível) se
//    existe uma versão nova, já que um PWA pode ficar aberto por dias.
// ============================================================

let updateToastShown = false;
let reloadingAfterUpdate = false;

function notifyUpdateAvailable(registration: ServiceWorkerRegistration) {
  if (updateToastShown) return;
  updateToastShown = true;

  toast('Nova versão do Zôada disponível', {
    description: 'Atualize para pegar as últimas mudanças.',
    duration: Infinity,
    action: {
      label: 'Atualizar',
      onClick: () => {
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
      },
    },
  });
}

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register('/sw.js')
    .then((registration) => {
      // Já existe uma versão nova esperando (ex: instalada numa aba
      // anterior, mas a pessoa nunca recarregou).
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdateAvailable(registration);
      }

      // Uma versão nova terminou de baixar/instalar agora.
      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            notifyUpdateAvailable(registration);
          }
        });
      });

      // Checa por atualização a cada 5 minutos e sempre que a aba volta
      // a ficar visível — cobre quem deixa o app/PWA aberto por muito tempo.
      const checkForUpdate = () => registration.update().catch(() => {});
      const intervalId = window.setInterval(checkForUpdate, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });

      window.addEventListener('beforeunload', () => window.clearInterval(intervalId));
    })
    .catch(() => {
      // Registro falhou (ex: ambiente de desenvolvimento sem HTTPS) — sem problema.
    });

  // Quando o novo service worker assume o controle (depois do SKIP_WAITING),
  // recarrega a página uma única vez para servir os arquivos novos.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingAfterUpdate) return;
    reloadingAfterUpdate = true;
    window.location.reload();
  });
}
