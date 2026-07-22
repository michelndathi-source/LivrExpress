# LivrExpress

Site de livraison express à Dakar — suivi en direct du colis jusqu’à la réception.

Site HTML / CSS / JS avec **espace client**, **espace admin**, **Supabase Auth**, validation des commandes, carte live, profils et livreurs.

## Rôles

| Rôle | Accès |
|------|--------|
| **Visiteur** | Accueil, tarifs, suivi public par n° (si déjà validé) |
| **Client** | Compte, photo profil, demander une livraison, historique, suivi |
| **Admin** | Valider / refuser les demandes, gérer livraisons, mapping clients |
| **Super-admin** | + gestion des co-admins |

## Flux commande

1. Le client crée un compte et se connecte  
2. Il envoie une **demande** de livraison (pas de n° de suivi tout de suite)  
3. L’**admin** valide → génération du n° `LX-…` + fiche + pipeline  
4. Le client suit son colis (carte Maps + notifs + profil livreur)

## Comptes

**Super-admin** : `michelndathi@gmail.com` (config Auth Supabase + `js/auth.js`)

**Client** : inscription via `register.html`.

## Pages

| Fichier | Rôle |
|---------|------|
| `index.html` | Landing publique |
| `login.html` / `register.html` | Connexion / inscription |
| `espace-client.html` | Interface client |
| `profil.html` | Fiche compte produit |
| `livreur.html` | Profil livreur public |
| `admin.html` | Administration |
| `suivi.html` | Suivi live + carte |
| `fiche.html` | Waybill / fiche produit |

## Structure JS

```text
js/
├── supabase-config.js  # URL + clé publishable Supabase
├── supabase-client.js  # Auth + CRUD distant
├── auth.js             # comptes, session, rôles
├── livraison.js        # demandes, colis, pipeline
├── profile.js          # profils, mapping clients, livreurs
├── live-map.js         # carte de suivi live
├── push-notify.js      # notifications téléphone
└── main.js             # UI pages
```

Données : **Supabase** (Auth + Postgres) si configuré, sinon **localStorage**.

Guide : **[SUPABASE.md](./SUPABASE.md)**

## 📱 Lien mobile (tests & partage)

**https://michelndathi-source.github.io/LivrExpress/**

Design **mobile-first** (dock bas, gros boutons, formulaires iOS/Android).  
Guide : **[MOBILE.md](./MOBILE.md)**

## Lancer en local

```bash
# Depuis le dossier du projet
python -m http.server 5500
```

Puis ouvrir `http://localhost:5500/splash.html` ou `login.html`.

## GitHub

Dépôt : https://github.com/michelndathi-source/LivrExpress
