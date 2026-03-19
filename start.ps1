# =============================================================
#  PEMS-BAY Node.js — start.ps1  (Windows PowerShell)
# =============================================================

$ErrorActionPreference = "Continue"
$PROJECT = "C:\Users\Fatima\Documents\document\virtualisation\tp2-node"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    PEMS-BAY — Node.js + MongoDB                  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Réseau ─────────────────────────────────────────────
Write-Host "[1/7] Réseau Docker..." -ForegroundColor Yellow
docker network create pems_network 2>$null
Write-Host "      OK" -ForegroundColor Green

# ── 2. Volume MongoDB ─────────────────────────────────────
Write-Host "[2/7] Volume MongoDB..." -ForegroundColor Yellow
docker volume create pems_mongo_data 2>$null
Write-Host "      OK" -ForegroundColor Green

# ── 3. MongoDB ────────────────────────────────────────────
Write-Host "[3/7] Lancement MongoDB..." -ForegroundColor Yellow
docker rm -f pems_mongodb 2>$null

docker run -d --name pems_mongodb --network pems_network `
  --volume pems_mongo_data:/data/db `
  --volume "${PROJECT}/mongo-init/init.js:/docker-entrypoint-initdb.d/init.js:ro" `
  --env MONGO_INITDB_ROOT_USERNAME=admin `
  --env MONGO_INITDB_ROOT_PASSWORD=admin123 `
  --env MONGO_INITDB_DATABASE=pems_bay `
  --publish 27018:27017 `
  mongo:6.0

Write-Host "      Attente MongoDB (15s)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

$ping = docker exec pems_mongodb mongosh -u admin -p admin123 `
  --authenticationDatabase admin --eval "db.adminCommand('ping').ok" --quiet 2>$null
if ($ping -match "1") {
  Write-Host "      MongoDB prêt !" -ForegroundColor Green
} else {
  Write-Host "      MongoDB lent, on continue..." -ForegroundColor Yellow
}

# ── 4. Build Backend Node.js ──────────────────────────────
Write-Host "[4/7] Build backend Node.js..." -ForegroundColor Yellow
docker build --tag pems_backend_img --file backend/Dockerfile ./backend
Write-Host "      OK" -ForegroundColor Green

# ── 5. Lancer Backend ─────────────────────────────────────
Write-Host "[5/7] Lancement backend..." -ForegroundColor Yellow
docker rm -f pems_backend 2>$null

docker run -d --name pems_backend --network pems_network `
  --volume "${PROJECT}/data:/app/data:ro" `
  --env MONGO_URI="mongodb://admin:admin123@pems_mongodb:27017/pems_bay?authSource=admin" `
  --env MONGO_DB="pems_bay" `
  --publish 5000:5000 `
  pems_backend_img

Write-Host "      Attente ingestion (30s)..." -ForegroundColor Gray
Start-Sleep -Seconds 30

# ── 6. Build Frontend ─────────────────────────────────────
Write-Host "[6/7] Build frontend..." -ForegroundColor Yellow
docker build --tag pems_frontend_img --file frontend/Dockerfile ./frontend
Write-Host "      OK" -ForegroundColor Green

# ── 7. Lancer Frontend ────────────────────────────────────
Write-Host "[7/7] Lancement frontend Nginx..." -ForegroundColor Yellow
docker rm -f pems_frontend 2>$null

docker run -d --name pems_frontend --network pems_network `
  --publish 8080:80 `
  pems_frontend_img

Write-Host "      OK" -ForegroundColor Green

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅  Tout est lancé !                            ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════╣" -ForegroundColor Green
Write-Host "║  Carte  →  http://localhost:8080                 ║" -ForegroundColor White
Write-Host "║  API    →  http://localhost:5000/api/health      ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
