# LivrExpress — Livraison, clients & admin

Site HTML / CSS / JS avec **espace client**, **espace admin**, validation des commandes et suivi type transporteur.

## Rôles

| Rôle | Accès |
|------|--------|
| **Visiteur** | Accueil, tarifs, suivi public par n° (si déjà validé) |
| **Client** | Compte, demander une livraison, historique, suivi de ses colis validés |
| **Admin** | Valider / refuser les demandes, gérer livraisons & clients |

## Flux commande

1. Le client crée un compte et se connecte  
2. Il envoie une **demande** de livraison (pas de n° de suivi tout de suite)  
3. L’**admin** valide → génération du n° `LX-…` + fiche + pipeline  
4. Le client suit son colis dans **Mon espace** / page Suivi  

## Comptes & rôles admin

| Rôle | Droits |
|------|--------|
| **super_admin** | Propriétaire unique. Valide les demandes, gère livraisons, **ajoute / retire des co-admins** |
| **admin** (co-admin) | Valide / refuse (unité ou masse), gère livraisons. **Ne peut pas** gérer l’équipe |
| **client** | Demandes + suivi de ses colis |

**Super-admin (propriétaire)**

- Email : `michelndathi@gmail.com`  
- Mot de passe : `admin123`  

Modifiable dans `js/auth.js` → `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`.

Les co-admins s’ajoutent depuis **Admin → Équipe admin** (visible uniquement pour le super-admin).

**Client** : inscription via `register.html`.

## Pages

| Fichier | Rôle |
|---------|------|
| `index.html` | Landing publique |
| `login.html` | Connexion |
| `register.html` | Inscription client |
| `espace-client.html` | Interface client |
| `admin.html` | Administration |
| `suivi.html` | Suivi live par n° |
| `fiche.html` | Waybill / fiche produit |

## Structure JS

```text
js/
├── supabase-config.js  # URL + clé anon Supabase (à renseigner)
├── supabase-client.js  # Auth + CRUD distant
├── auth.js             # comptes, session, rôles (Supabase ou local)
├── livraison.js        # demandes, colis, pipeline (+ sync cloud)
├── live-map.js         # carte de suivi live
├── push-notify.js      # notifications téléphone
└── main.js             # UI pages
```

Données : **Supabase** (Auth + Postgres) si configuré, sinon **localStorage** (démo hors-ligne).

Guide complet : **[SUPABASE.md](./SUPABASE.md)**

## Lancer

Ouvrir **`splash.html`** (entrée recommandée) ou n’importe quelle page :
sans session, le site redirige vers le splash puis la connexion.

```bash
python -m http.server 5500
```

Puis `http://localhost:5500/splash.html`.

### Accès

1. Splash bleu 3 s (icône livraison + 0→100 %)  
2. Connexion ou inscription obligatoire  
3. Accès au site (accueil, commandes, suivi, admin)

## Personnalisation

- WhatsApp / téléphone : `js/livraison.js` (`WHATSAPP`)
- Admin par défaut : `js/auth.js` (`DEFAULT_ADMIN`)
- Tarifs : `PLAN_PRICES` dans `livraison.js` + section tarifs HTML
