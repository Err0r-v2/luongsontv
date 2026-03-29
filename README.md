# LuongSon TV

Une interface Netflix-style pour regarder les matchs en direct via HLS.

## ⚠️ Disclaimer

Ce projet est une **interface utilisateur (UI) uniquement** qui se connecte à une API externe (`api-ls.cdnokvip.com`).

- Ce projet **ne cautionne pas** le contenu, les services ou les pratiques de tiers
- Ce projet **ne stocke pas** de contenu
- Ce projet agit comme un **simple proxy** vers une API externe
- Les créateurs de ce projet ne sont **pas responsables** de l'utilisation du contenu affiché
- Respectez les conditions d'utilisation et la législation applicable dans votre juridiction

## Fonctionnalités

- 🎥 Lecteur HLS.js avec buffering intelligent
- 🎬 Interface Netflix-style avec cartes de matchs
- 🎯 Sélection de zone de recadrage (crop) persistante
- 📱 Design responsive
- ⚡ Pas de framework — Vanilla JS pur

## Développement

```bash
# Serveur local
python3 -m http.server 8080

# Puis ouvre http://localhost:8080
```

## Technos

- Vanilla JavaScript (pas de dependencies)
- HLS.js pour le streaming
- CSS3 Grid/Flexbox
- localStorage pour la persistance du crop

## Licence

MIT — Libre d'usage, pas de garanties.
