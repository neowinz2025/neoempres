#!/usr/bin/expect -f
set timeout 600
set host "137.184.86.179"
set user "root"
set pass "hUg@9615@h"

proc ssh_run {pass cmd} {
    global timeout
}

spawn ssh -o StrictHostKeyChecking=no -o ConnectTimeout=30 $user@$host

expect {
    "password:" { send "$pass\r" }
    timeout { puts "ERRO: timeout na conexao"; exit 1 }
}

expect {
    "# " { }
    "$ " { }
    timeout { puts "ERRO: nao chegou ao prompt"; exit 1 }
}

puts "\n=== [1/6] Atualizando sistema ===\n"
send "export DEBIAN_FRONTEND=noninteractive && apt update -qq && apt upgrade -y -qq 2>&1 | tail -3\r"
expect -timeout 300 "# "

puts "\n=== [2/6] Instalando Docker ===\n"
send "curl -fsSL https://get.docker.com | sh 2>&1 | tail -5\r"
expect -timeout 300 "# "

puts "\n=== Verificando Docker ===\n"
send "docker --version && docker compose version\r"
expect "# "

puts "\n=== [3/6] Criando estrutura de pastas ===\n"
send "mkdir -p /opt/evolution && cd /opt/evolution\r"
expect "# "

puts "\n=== [4/6] Criando docker-compose.yml ===\n"
send {cat > /opt/evolution/docker-compose.yml << 'YAML'
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
}
send "\r"
expect "# "

puts "\n=== [5/6] Subindo container (pode demorar alguns minutos) ===\n"
send "cd /opt/evolution && docker compose up -d 2>&1\r"
expect -timeout 300 "# "

puts "\n=== Aguardando API iniciar ===\n"
send "sleep 10 && curl -s http://localhost:8080/ | head -c 200\r"
expect "# "

puts "\n=== [6/6] Instalando Nginx ===\n"
send "apt install -y nginx 2>&1 | tail -3\r"
expect -timeout 120 "# "

send {cat > /etc/nginx/sites-available/evolution << 'NGINX'
server {
    listen 80;
    server_name 137.184.86.179;
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
}
send "\r"
expect "# "

send "ln -sf /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx\r"
expect "# "

puts "\n=== Testando API via Nginx ===\n"
send "curl -s http://137.184.86.179/ | head -c 300\r"
expect "# "

puts "\n=== Criando instância WhatsApp ===\n"
send {curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: evol_neoempres_2026" \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"principal","qrcode":true}' | python3 -m json.tool 2>/dev/null || echo "instancia criada"}
send "\r"
expect "# "

puts "\n=== Status dos containers ===\n"
send "docker ps\r"
expect "# "

puts "\n\n======================================"
puts "INSTALACAO CONCLUIDA!"
puts "======================================"
puts "URL:    http://137.184.86.179"
puts "APIKEY: evol_neoempres_2026"
puts "INSTANCIA: principal"
puts "======================================"
puts "Proximos passos:"
puts "1. Acesse http://137.184.86.179/manager"
puts "2. Use a apikey acima para logar"
puts "3. Escaneie o QR code com seu WhatsApp\n"

send "exit\r"
expect eof
