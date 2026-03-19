# PEMS-BAY Traffic Monitor (TP 2)

**Nom du projet :** PEMS-BAY Traffic Monitor

Ce projet est un **moniteur de trafic (PEMS-BAY)** avec un backend Node.js + MongoDB et une interface frontend JavaScript/Leaflet.

## 🚀 Objectif

- Ingestions des fichiers de données CSV (`metadata.csv` + `PEMS-BAY.csv`) dans une base **MongoDB**.
- Exposer une API REST qui retourne la liste des capteurs et leurs métadonnées.
- Afficher les capteurs sur une carte interactive (Leaflet/OpenStreetMap) dans un frontend statique.

## 🧱 Architecture

- **backend/** : service Node.js + Express qui lit les CSV et peuple MongoDB.
- **frontend/** : application HTML/CSS/JS qui consomme l'API et affiche les capteurs sur une carte.
- **mongo-init/** : script d'initialisation MongoDB pour créer l’utilisateur et la base.
- **data/** : contient les fichiers CSV (`metadata.csv`, `PEMS-BAY.csv`).

## ▶️ Lancer le projet (Windows)

Le script `start.ps1` s’occupe de créer le réseau Docker, démarrer MongoDB, builder et lancer le backend + frontend.

1. Ouvrir PowerShell dans le dossier du projet.
2. Exécuter :

```powershell
.\start.ps1
```

Ensuite, accéder à :

- Interface : http://localhost:8080
- API santé : http://localhost:5000/api/health

## 🧩 Endpoints API utiles

- `GET /api/health` — Vérifie que MongoDB est connecté.
- `GET /api/sensors` — Renvoie la liste des capteurs (métadonnées + position).

> ⚠️ Le frontend utilise `GET /api/stats` et `/api/sensors`. Si l’un de ces endpoints ne répond pas, le frontend peut ne pas afficher correctement les données.

## 🗂️ Datasets attendus

Le backend attend un fichier dans `data/` :

- `metadata.csv` : coordonnées et informations des capteurs.

## 🔧 Configuration

Le backend est configurable via variables d'environnement :

- `MONGO_URI` (par défaut : `mongodb://admin:admin123@pems_mongodb:27017/pems_bay?authSource=admin`)
- `MONGO_DB` (par défaut : `pems_bay`)
- `DATA_DIR` (par défaut : `/app/data`)
- `PORT` (par défaut : `5000`)

## 🧪 Test rapide

1. Lancer `start.ps1`.
2. Vérifier la santé de l’API :

```bash
curl http://localhost:5000/api/health
```

3. Ouvrir la carte : http://localhost:8080

---

**Note** : ce projet est une base pour un TP de virtualisation (sans Docker Compose). Il est possible d’améliorer l’API pour ajouter des endpoints d’historique, de filtrage ou de calcul de congestion.