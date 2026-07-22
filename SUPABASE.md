# LivrExpress × Supabase — Auth + base de données

Le site peut tourner en **localStorage** (démo) ou en **Supabase** (Auth + Postgres) dès que vous collez vos clés.

## 1. Créer le projet Supabase

1. Allez sur [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. **New project** → nommez-le `livrexpress` (ou autre)
3. Choisissez un mot de passe base de données (gardez-le)
4. Attendez que le projet soit **Ready**

## 2. Exécuter le schéma SQL

1. Menu **SQL Editor** → **New query**
2. Ouvrez le fichier du repo :
   `supabase/migrations/001_init_livrexpress.sql`
3. Copiez **tout** le contenu → collez dans l’éditeur → **Run**
4. Vérifiez les tables : **Table Editor**
   - `profiles`
   - `order_requests`
   - `shipments`
   - `notifications`

## 3. Clés API

1. **Project Settings** → **API**
2. Copiez :
   - **Project URL** (ex. `https://abcdxyz.supabase.co`)
   - **anon public** key

3. Ouvrez `js/supabase-config.js` et remplacez :

```js
url: "https://VOTRE_REF.supabase.co",
anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
```

> Si les placeholders restent, l’app reste en mode localStorage.

## 4. Auth (emails)

1. **Authentication** → **Providers** → Email activé
2. Pour les tests sans confirmation d’email :
   - **Authentication** → **Providers** → Email  
   - désactivez **Confirm email** (ou confirmez via le lien)
3. Créez le **super-admin** :
   - **Authentication** → **Users** → **Add user**
   - Email : `michelndathi@gmail.com`
   - Mot de passe fort
   - Le trigger SQL met `role = super_admin` sur `profiles`
4. Sinon, après inscription :

```sql
update public.profiles
set role = 'super_admin'
where email = 'michelndathi@gmail.com';
```

## 5. Tester

1. Servez le site en local (ex. `python -m http.server 5500`)
2. Ouvrez la console navigateur : pas d’erreur Supabase
3. **Inscription** client → ligne dans `auth.users` + `profiles`
4. **Connexion** super-admin → `admin.html`
5. Validez une commande → lignes dans `order_requests` + `shipments`

## Architecture

| Couche | Rôle |
|--------|------|
| Supabase Auth | Inscription / connexion email-password |
| `profiles` | Rôles `client` \| `admin` \| `super_admin` |
| `order_requests` | Demandes avant validation |
| `shipments` | Colis + événements de suivi (jsonb) |
| `notifications` | Alertes client |
| RLS | Client voit ses données ; staff voit tout ; suivi colis public en lecture |

Fichiers JS :

```
js/supabase-config.js   ← vos clés
js/supabase-client.js    ← client + CRUD
js/auth.js               ← Auth hybride
js/livraison.js          ← sync commandes / colis / notifs
```

## Sécurité

- La clé **anon** est publique (navigateur) : la sécurité repose sur les **RLS**.
- Ne mettez **jamais** la clé `service_role` dans le front.
- Changez le mot de passe super-admin par défaut en production.

## Dépannage

| Problème | Solution |
|----------|----------|
| Toujours en local | Clés encore en `YOUR_…` dans `supabase-config.js` |
| « Invalid API key » | Mauvaise anon key ou mauvais projet |
| Profil introuvable | Rejouer le SQL (trigger `handle_new_user`) |
| Inscription sans session | Confirmation email activée → confirmer ou la désactiver |
| RLS deny | Vérifier les policies du SQL `001_init` |
