# @traiku/sdk

Le client de l'API Traiku, comme `@medusajs/js-sdk`. Il est partagé par l'app mobile et le site, et n'a aucune dépendance (il utilise le `fetch` intégré).

```ts
import Traiku from '@traiku/sdk';

const sdk = new Traiku({
  baseUrl: process.env.EXPO_PUBLIC_API_URL,           // jamais écrit dans le code
  publishableKey: process.env.EXPO_PUBLIC_PUBLISHABLE_KEY,
  auth: { storage },                                  // expo-secure-store dans l'app
});

await sdk.auth.requestCode('+33612345678');           // SMS
const { registered } = await sdk.auth.verifyCode(phone, code);
if (!registered) await sdk.auth.register({ first_name: 'Chloé' });
const { member } = await sdk.app.me.retrieve();
await sdk.auth.logout();                              // sur tous les appareils
```

- La clé `pk_` part sur `/app/*`, et le jeton du membre sur chaque appel.
- Si l'API refuse le jeton (401), il est oublié : `sdk.client.onTokenChange` prévient l'app.
- Les erreurs arrivent en `TraikuApiError` (`status`, `type`, `code`, `message` en français). `offline` est vrai quand l'API est injoignable.
- Toutes les routes de l'app : `sdk.app.me`, `missions` (publier, accepter, annuler, créneaux du vendeur), `runs` (chaque étape), `trips`, `conversations`, `reviews`, `disputes`, `uploads`.
- Pour une route pas encore dans le SDK : `sdk.client.fetch('/app/…', { method, body, query })`.

L'app mobile l'utilise avec `"@traiku/sdk": "file:../web/backend/sdk"`. Metro surveille ce dossier (`mobile/metro.config.js`).
