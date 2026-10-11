#!/usr/bin/env bash
# Preparacao local da ponte Sagamente em VM Linux. Nao inicia nem habilita o servico.
set -euo pipefail

SERVICE=sagamente-whatsapp-bridge
APP_USER=sagamente-wa
TARGET=/opt/sagamente-whatsapp-bridge
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ "${EUID}" -ne 0 ]]; then
  echo 'Execute como root: sudo bash services/whatsapp-bridge/deploy/vm/install-service.sh' >&2
  exit 1
fi
if ! command -v systemctl >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Necessario Linux com systemd, Node.js >= 22 e npm instalados.' >&2
  exit 1
fi
NODE_BIN="$(command -v node)"
NODE_MAJOR="$($NODE_BIN -p 'process.versions.node.split(".")[0]')"
if [[ ! "$NODE_MAJOR" =~ ^[0-9]+$ ]] || (( NODE_MAJOR < 22 )); then
  echo 'Node.js 22 ou superior e obrigatorio.' >&2
  exit 1
fi
if systemctl is-active --quiet "${SERVICE}.service"; then
  echo 'Servico ja ativo: nao substitua arquivos durante a operacao. Pare manualmente primeiro.' >&2
  exit 1
fi
if [[ ! -f "${SOURCE}/index.mjs" || ! -f "${SOURCE}/package.json" ]]; then
  echo 'Diretorio-fonte da ponte nao encontrado.' >&2
  exit 1
fi
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$TARGET" --shell /usr/sbin/nologin "$APP_USER"
fi
install -d -o root -g root -m 0755 "$TARGET"
install -d -o "$APP_USER" -g "$APP_USER" -m 0700 "$TARGET/.local"
for file in index.mjs phone-utils.mjs receipt-tracker.mjs package.json .env.example; do
  install -o root -g root -m 0644 "$SOURCE/$file" "$TARGET/$file"
done
install -o root -g root -m 0644 "$SOURCE/deploy/vm/preflight.mjs" "$TARGET/preflight.mjs"
# Modulos sob controle do root; o usuario da ponte nao pode alterar seu proprio codigo.
npm --prefix "$TARGET" install --omit=dev --no-audit --no-fund
chown -R root:root "$TARGET/node_modules" "$TARGET/package-lock.json"

cat > "/etc/systemd/system/${SERVICE}.service" <<UNIT
[Unit]
Description=Sagamente - ponte WhatsApp (Baileys, nao oficial)
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${TARGET}
ExecStartPre=${NODE_BIN} ${TARGET}/preflight.mjs
ExecStart=${NODE_BIN} ${TARGET}/index.mjs
Restart=on-failure
RestartSec=15s
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${TARGET}/.local
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=

[Install]
WantedBy=multi-user.target
UNIT
chmod 0644 "/etc/systemd/system/${SERVICE}.service"
systemctl daemon-reload

echo 'Arquivos e unidade systemd instalados. NAO foi ativado nem iniciado qualquer envio.'
echo "Proximo passo: configure ${TARGET}/.env (proprietario ${APP_USER}, modo 0600)."
echo "Valide com: sudo -u ${APP_USER} ${NODE_BIN} ${TARGET}/preflight.mjs"
echo 'Nao habilite o servico antes do teste controlado e de parar a ponte Windows.'
