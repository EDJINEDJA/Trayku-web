# Traiku — backend

L'architecture de Medusa v2 (modules, workflows, routes par fichiers, liens, Query, événements, tâches planifiées, clés API), sans le e-commerce, adaptée à Traiku.

## Lancer en local

```bash
cp .env.template .env        # puis remplacez chaque change-me (openssl rand -hex 32)
(cd .. && docker compose up -d)   # Postgres 16 + PostGIS, sur 127.0.0.1:5432 seulement (le compose est dans Traiku/web)
npm install
npm run db:migrate           # tables des modules et des liens
npm run seed                 # clé publique de l'app, 3 membres, missions de démo
npm run user -- -e equipe@traiku.fr -p motdepasse   # un compte équipe pour l'admin
npm run admin:build          # construit le tableau de bord
npm run dev                  # API sur http://localhost:9000, tableau de bord sur /admin
```

Sans Twilio dans `.env`, les SMS (codes de connexion, codes de remise) s'écrivent dans le journal du serveur.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm start` | le serveur, avec les abonnés et les tâches planifiées |
| `npm run db:generate [module]` | écrit la migration d'après les changements des modèles |
| `npm run db:migrate` | exécute les migrations pas encore passées, puis crée les tables de liens |
| `npm run db:rollback -- mission` | annule la dernière migration d'un module |
| `npm run user -- -e … -p …` | crée un compte équipe |
| `npm run api-key -- -t publishable --title "App mobile"` | crée une clé (`-t secret` pour un serveur) |
| `npm run exec -- ./src/scripts/x.ts` | lance un script avec le conteneur |
| `npm run typecheck` | vérifie les types |
| `npm run db:backup` | une sauvegarde maintenant, dans `backups/` |
| `npm run db:restore -- <fichier> --confirmer` | remplace la base par une sauvegarde (après en avoir fait une de l'état actuel) |
| `npm run admin:build` | construit le tableau de bord, servi par le backend sur `/admin` |
| `npm run admin:dev` | le tableau de bord en développement sur http://localhost:5173/admin (rechargement à chaud) |

## Organisation

```
framework/            l'équivalent de @medusajs/framework, écrit pour Traiku
  dml/                model.define, model.text()… et les types déduits
  modules/            Module(), TraikuService (comme MedusaService), le conteneur de chaque module
  modules-core/       api-key, auth, user, notification, file (comme les modules de base de Medusa)
  migrations/         db:generate (diff du snapshot) et db:migrate
  links/              defineLink, le service link et Query (query.graph)
  workflows/          createStep, createWorkflow, StepResponse, transform, when, compensation
  core-flows/         étapes partagées : emitEventStep, useQueryGraphStep…
  http/               routes par fichiers, middlewares, authenticate, clé publique, validation
  events/  jobs/  cli/
src/
  modules/            member, mission, trip, review, conversation
  links/              les liens entre modules (mission.requester, run.traveler…)
  workflows/          la logique métier, étape par étape
  api/                app/ (l'app mobile), admin/ (l'équipe), auth/, files/
  subscribers/        les SMS des codes
  jobs/               missions expirées, réponses au rapport sans réponse
  lib/rules.ts        les règles (annulation, désistement, délais), reprises de l'app
admin/                le tableau de bord, comme celui de Medusa (React, Vite, @medusajs/ui)
  src/routes/         missions, membres, litiges, conversations, clés API
  src/hooks/api/      les appels à /admin avec TanStack Query
traiku-config.ts      comme medusa-config.ts
```

## Tableau de bord

Il est construit comme celui de Medusa, avec les mêmes briques (`@medusajs/ui`, Tailwind et le preset Medusa, react-router, TanStack Query). Le backend le sert sur `/admin`, à la même adresse que l'API de l'équipe :
- le navigateur qui demande une page reçoit le tableau de bord ;
- un appel JSON va à l'API.

| Écran | Ce qu'on y fait |
|---|---|
| Missions | valider ou refuser les titres libres ; voir le dossier complet (déroulé, historique, codes, vérifications du visage, photos, litiges, conversation) ; débloquer après 3 codes faux |
| Membres | vérifier l'identité, accorder ou retirer le certificat de vérification, suspendre ou réactiver ; missions publiées et faites, avis reçus |
| Litiges | lire le signalement, puis clore le dossier avec une réponse |
| Virements | ce qui est dû à chaque Traikeur, les virements (échoués à relancer), l'export CSV pour la comptabilité |
| Clés API | créer et révoquer les clés publiques (apps) et secrètes (serveurs) |

Les mêmes règles que Medusa :
- un module ne lit jamais les tables d'un autre ; les liens et Query font le pont ;
- toute action qui change quelque chose passe par un workflow ; si une étape échoue, les précédentes sont annulées dans l'ordre inverse ;
- les événements ne partent qu'une fois le workflow réussi ;
- chaque exécution de workflow est enregistrée en base, étape par étape (`workflow_execution`). Si le serveur s'arrête au milieu, les étapes faites sont annulées au redémarrage, ou par un autre serveur après 3 minutes.

## Sauvegardes

Le conteneur `traiku-backup` (lancé avec `docker compose up -d` dans `Traiku/web`) sauvegarde la base toutes les `BACKUP_EVERY_HOURS` heures dans `backups/`, et garde les sauvegardes `BACKUP_KEEP_DAYS` jours. Les fichiers ne sont lisibles que par vous.

Copiez-les aussi ailleurs : un autre disque, ou un stockage chiffré. Une sauvegarde sur le même disque disparaît avec lui. En production, avec une base gérée (Scaleway, OVH, AWS…), activez aussi leurs sauvegardes automatiques.

## Accès

| Partie | Ce qu'il faut |
|---|---|
| `/app/*` | l'en-tête `x-publishable-api-key: pk_…` (clé publique de l'app), plus `Authorization: Bearer <jeton>` pour agir |
| `/admin/*` | le cookie de session de l'équipe (tableau de bord), un jeton d'équipe (`/auth/user/emailpass`), ou une clé secrète `sk_…` en `Authorization: Basic` (serveur à serveur) |
| `/auth/*` | rien : connexion par code SMS, inscription, rafraîchissement du jeton |
| `/files/*` | un lien signé qui expire, donné par l'API |

La clé publique identifie l'app et peut être révoquée depuis l'admin, mais elle ne protège rien à elle seule : elle est lisible dans l'app. La sécurité vient de la connexion de chaque membre et des droits vérifiés sur chaque donnée.

Connexion d'un membre (comme Medusa) :
1. `POST /auth/member/phone-otp/request { phone }` envoie un code à 6 chiffres.
2. `POST /auth/member/phone-otp { phone, code }` renvoie le jeton. Pour un nouveau numéro, c'est un jeton d'inscription.
3. Pour un nouveau numéro : `POST /app/members { first_name }`, puis `POST /auth/token/refresh`.

## Sécurité

| Risque | Protection |
|---|---|
| Injection SQL | requêtes paramétrées (Knex) ; noms de filtres, de tris et de champs vérifiés contre une liste ; corps validés strictement (zod refuse les champs inconnus) |
| Base de données | port ouvert sur la machine seulement ; trois comptes : `postgres` (conteneur), `traiku_owner` (migrations), `traiku_app` (le serveur : lire et écrire des lignes, ni créer ni supprimer de table) |
| Accès aux données d'un autre | chaque mission, déroulé ou conversation vérifie que vous en faites partie, sinon « introuvable » |
| Fausse IP pour contourner les limites | `TRUST_PROXY` : le nombre réel de proxys devant le serveur (0 sans proxy) |
| Fraude aux SMS (SMS pumping) | SMS vers tous les pays, sauf les numéros spéciaux et surtaxés (`SMS_BLOCKED_PREFIXES`), vérifiés à la connexion, à la publication et à l'envoi ; codes de connexion plafonnés par heure, au total (`OTP_MAX_PER_HOUR`) et par zone de numéros hors France (`OTP_MAX_PER_ZONE_PER_HOUR`) |
| Codes devinés | connexion : 6 chiffres, 3 essais, 10 min, 5 codes par heure et par numéro ; mission : 3 codes faux bloquent jusqu'au support |
| Déni de service | recherches faites par PostGIS (index géographique, une seule page lue) ; photos reçues sur disque, jamais en mémoire ; limites d'appels sur les routes coûteuses |
| Fichiers piégés | type réel lu dans le contenu (JPEG, PNG, WebP, HEIC, PDF), le reste refusé ; fichiers privés, servis par lien signé qui expire |
| Secrets | refus de démarrer en production avec un secret faible ; clés `sk_` et mots de passe stockés hachés |
| Jetons | algorithme imposé (HS256) ; 7 jours pour les membres, 12 h pour l'équipe ; révocables (`DELETE /auth/token` : déconnexion partout ; suspension d'un membre) |
| Comptes équipe | bloqués 15 minutes après 5 mots de passe faux ; chaque modification inscrite au journal (qui, quoi, quand, d'où) ; tableau de bord connecté par cookie `httpOnly` + `SameSite=Strict` (le jeton n'est jamais lisible par la page), modifications acceptées seulement depuis le site (CSRF) |
| Navigateur | en-têtes de sécurité (CSP, HSTS, nosniff, pas d'iframe) |
| Connexions lentes (slowloris) | en-têtes en 10 s, requête en 2 min, connexions inactives fermées après 5 s ; plafond d'appels par IP sur `/app`, `/auth` et `/admin` |
| Photos | métadonnées supprimées (EXIF avec position GPS, XMP) pour JPEG, PNG et WebP ; un rapport ne peut citer que ses propres photos |
| Messages | numéros de téléphone (tous pays) et e-mails masqués par le serveur, quel que soit l'appareil |

Encore à faire avant la mise en ligne :
- HTTPS et protection en amont (nginx ou Cloudflare) ;
- Redis pour les limites et les événements quand il y aura plusieurs serveurs ;
- double authentification pour l'équipe ;
- copie des sauvegardes hors de la machine.

## Ce que chacun voit

- **Avant acceptation :** la zone (ville, position à environ 1 km). Jamais les téléphones, le numéro de commande ni les codes.
- **Le Traikeur de la mission :** les adresses exactes et les contacts, puis le numéro de commande une fois son visage vérifié. Jamais les codes.
- **Le demandeur :** tout sur sa mission, codes compris.
- **L'équipe :** le dossier complet (historique, vérifications du visage, photos, conversations).

## Inscription et vérification d'identité

Après le code SMS et le compte, trois étapes obligatoires, l'app est bloquée tant qu'elles ne sont pas faites :
1. **Identité** : la pièce (carte d'identité, passeport, titre de séjour, permis de conduire ; liste dans `src/lib/identity.ts`), recto puis verso dans un cadre, puis un selfie dans un ovale. `POST /app/me/identity`, avec le consentement explicite.
2. **Métier** : dans la liste, ou écrit par le membre, ou aucun. Avec un diplôme ou une certification : le justificatif (`POST /app/me/credentials`) ; validé par l'équipe, le membre devient vérificateur certifié.
3. **Zone d'activité** : une ville et un rayon, gardés sur le compte.

Règles : publier demande la pièce envoyée ; accepter une mission demande l'identité vérifiée.

L'équipe compare la pièce et le selfie dans `/admin` → Vérifications, puis valide ou refuse avec un motif (le membre recommence). Le selfie de l'inscription reste la référence : la fiche d'une mission le montre à côté des vérifications du visage faites pendant la mission.

Photos d'identité : données biométriques (RGPD, article 9). Consentement explicite à l'envoi, photos visibles par l'équipe seulement (jamais par les autres membres), à supprimer à la fermeture du compte. Pour comparer automatiquement, brancher un prestataire certifié (voir « Pas encore fait »).

## Le déroulé d'une mission

| Route `POST /app/runs/:id/…` | Règle |
|---|---|
| `leg` | « Je pars » vers la prise en charge, puis vers la remise |
| `face` | vérification du visage en arrivant (colis, magasin, vendeur, mission sur place), pas à la remise ; distance de 150 m si `CHECK_PICKUP_LOCATION=true` |
| `seller-code` | vérification : le code que le demandeur a donné au vendeur |
| `report` | vérification : le rapport signé ; vérification seule, la mission s'arrête là |
| `decision` | demandeur, vérification et retrait : accepter ou refuser, dans les 20 minutes |
| `pickup-code` | le code de la personne qui remet, tapé en arrivant ; bon, elle reçoit un SMS : c'est le bon Traikeur |
| `pickup` | une photo, plus le code s'il n'a pas été tapé avant (pas de code pour Clic & Collect ni pour un retrait accepté) |
| `dropoff` | code du destinataire ; photo facultative |
| `photos`, `complete` | sur place : photos en arrivant et une fois fini, puis « Mission faite » (code si le demandeur est là) |
| `release` | le Traikeur rend la mission avant de partir : gratuit dans les 5 minutes, puis compté (3 en 30 jours, une semaine de suspension) |
| `tip` | le demandeur : un pourboire, versé en entier au Traikeur |

Avec un vendeur qui n'est pas sur Traiku (vérifications avec disponibilités) :
1. `POST /app/missions/:id/proposals { at }` : un Traikeur propose une heure dans les disponibilités du vendeur.
2. `POST /app/missions/:id/proposals/choose { proposal_id }` : le demandeur en choisit une et la transmet au vendeur.
3. `POST /app/missions/:id/seller-confirm` : le vendeur est d'accord, la mission va à ce Traikeur.

Après une vérification et retrait close, le transport de l'objet se publie avec `from_mission_id` : une seule fois, avec le titre déjà publié, et le vendeur reçoit le code de remise par SMS.

Trois codes faux bloquent la mission jusqu'au support (`POST /admin/runs/:id/unlock`).

## Pas encore fait

- Paiement (Stripe Connect : empreinte, versement au Traikeur, frais d'annulation).
- Notifications push et suivi en direct (WebSocket).
- Recherche PostGIS : la distance est calculée en JavaScript pour l'instant.
- Stockage S3 des fichiers.
- Contenu servi par l'API (catalogue, protocoles, règles, test du vérificateur ; les pièces et les métiers le sont déjà).
- Comparaison automatique pièce / selfie / visage en mission par un prestataire certifié (Ubble, Onfido, Veriff…) ; l'équipe compare à la main en attendant.
- Fermeture de compte, avec suppression des photos d'identité.
- Position du Traikeur en direct (l'app l'estime pour l'instant).

## Gains et virements des Traikeurs

Module `src/modules/payout` : le compte de versement de chaque Traikeur, ses gains par mission, ses virements.

- À la clôture d'une mission, une fois le paiement du demandeur encaissé, chaque Traikeur reçoit un gain : sa part du prix moins la commission (plus le temps en plus et le pourboire), la vérification seule, ou sa part des frais d'une annulation tardive ou d'un client absent (`src/workflows/payouts/earnings.ts`).
- Un gain attend 48 h avant d'être disponible, et tant qu'un litige est ouvert sur la mission (tâche `release-earnings`).
- Le Traikeur retire tout son disponible depuis l'app (il faut ses informations fiscales, DAC7). L'équipe peut aussi virer, relancer un virement échoué, suspendre les virements d'un compte ou annuler le gain d'une mission depuis l'admin.
- Fournisseur : Stripe Connect (comptes Express, la même clé que les paiements). Le Traikeur donne son identité et son IBAN sur les pages de Stripe ; Trayku ne garde que les 4 derniers chiffres. Les virements partent du solde Stripe de la plateforme, puis Stripe les verse sur le compte bancaire. Sans clé Stripe en test : un fournisseur test, l'IBAN saisi dans l'app, aucun argent ne circule.
- Les missions closes avant l'arrivée des virements : `npm run exec -- ./src/scripts/backfill-earnings.ts` enregistre leurs gains (une seule fois).
