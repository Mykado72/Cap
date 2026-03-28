# Cap! 🎯

**Cap!** est une PWA de suivi d'objectifs personnels — annuels, mensuels et hebdomadaires.

## Fonctionnalités

- 🎯 **3 niveaux d'objectifs** : Annuel, Mensuel, Hebdomadaire
- 📊 **Mode Pourcentage** : suivi via un slider 0–100%
- ☑️ **Mode Liste** : définissez une liste de tâches à cocher
- 🔔 **Bilan automatique** : à chaque relance après 24h+, l'app propose de faire le point sur chaque objectif
- 📦 **Données locales** : tout est stocké dans le navigateur (localStorage), aucun compte requis
- 📱 **PWA installable** : fonctionne hors ligne, installable sur mobile et desktop
- 🗃️ **Archives** : archivez les objectifs accomplis

## Déploiement sur GitHub Pages

1. Créez un repo GitHub (ex. `cap-pwa`)
2. Uploadez tous les fichiers à la racine
3. Activez GitHub Pages dans les settings → `main` branch → `/root`
4. Accédez à `https://<user>.github.io/cap-pwa/`

## Structure des fichiers

```
cap-pwa/
├── index.html       ← Application complète (HTML + CSS)
├── app.js           ← Logique JavaScript
├── sw.js            ← Service Worker (cache offline)
├── manifest.json    ← Manifeste PWA
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Mise à jour du cache (versioning)

Pour forcer les utilisateurs à recharger après une mise à jour, changez le numéro de version dans `sw.js` :

```js
const CACHE_NAME = 'cap-v1.0.1'; // ← incrémenter
```

## Stack

- Vanilla JavaScript (zero dépendance)
- CSS custom properties
- localStorage
- Service Worker API
