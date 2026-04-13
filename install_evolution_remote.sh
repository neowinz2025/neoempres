#!/bin/bash
set -e

echo ""
echo "======================================"
echo " [1/6] Atualizando sistema..."
echo "======================================"
export DEBIAN_FRONTEND=noninteractive
apt update -qq
apt upgrade -y -qq
echo "OK"

echo ""
echo "======================================"
echo " [2/6] Instalando Docker..."
echo "======================================"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
else
  echo "Docker ja instalado: $(docker --version)"
fi
docker --version
docker compose version

echo ""
echo "======================================"
echo " [3/6] Criando docker-compose.yml..."
echo "======================================"
mkdir -p /opt/evolution
cat > /opt/evolution/docker-compose.yml << 'YAML'
version: '3.9'
services:
  evolution:
    image: atendai/evolution-api:latest
    container_name: evolution_api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_TYPE=http
      - SERVER_PORT=8080
      - AUTHENTICATION_API_KEY=evol_neoempres_2026
      - STORE_MESSAGES=true
      - STORE_MESSAGE_UP=true
      - STORE_CONTACTS=true
      - STORE_CHATS=true
      - QRCODE_LIMIT=30
      - WEBHOOK_GLOBAL_ENABLED=false
    volumes:
      - evolution_data:/evolution/instances
volumes:
  evolution_data:
YAML
echo "OK"

echo ""
echo "======================================"
echo " [4/6] Subindo container Docker..."
echo "======================================"
cd /opt/evolution
docker compose pull
docker compose up -d
echo "Aguardando API iniciar (20s)..."
sleep 20
curl -s http://localhost:8080/ | head -c 200 || echo "(aguardando mais...)"
sleep 10
curl -s http://localhost:8080/ | head -c 200

echo ""
echo "======================================"
echo " [5/6] Instalando e configurando Nginx..."
echo "======================================"
apt install -y nginx -qq

cat > /etc/nginx/sites-available/evolution << 'NGINX'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/evolution
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "OK"

echo ""
echo "======================================"
echo " [6/6] Criando instancia WhatsApp..."
echo "======================================"
sleep 5
curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: evol_neoempres_2026" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"principal","qrcode":true}' | python3 -m json.tool 2>/dev/null || echo "instancia criada"

echo ""
echo "======================================"
echo " STATUS FINAL"
echo "======================================"
docker ps
echo ""
curl -s http://137.184.86.179/ | head -c 200

echo ""
echo ""
echo "=============================================="
echo " INSTALACAO CONCLUIDA COM SUCESSO!"
echo "=============================================="
echo " URL:      http://137.184.86.179"
echo " Manager:  http://137.184.86.179/manager"
echo " API Key:  evol_neoempres_2026"
echo " Instancia: principal"
echo "=============================================="
echo " Proximo passo: acesse o manager e"
echo " escaneie o QR code com seu WhatsApp"
echo "=============================================="
