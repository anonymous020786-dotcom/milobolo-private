#!/bin/bash
# MiloBolo — VPS Deploy Script
# Run on your Hostinger KVM4 VPS as root
# Server IP: 187.127.182.5

set -e

DOMAIN="chat.videodownloaders.cloud"
EMAIL="your-email@yourdomain.com"

echo "=== MiloBolo Deploy ==="

# 1. Install SSL cert (first time only)
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "--- Getting SSL certificate ---"
  apt-get install -y certbot
  certbot certonly --standalone -d $DOMAIN --email $EMAIL --agree-tos --non-interactive
fi

# 2. Copy .env
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠️  Edit .env with your real credentials, then re-run."
  exit 1
fi

# 3. Build & start
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "=== Deployed at https://$DOMAIN ==="
echo "Set superadmin role in Supabase:"
echo "  UPDATE profiles SET role = 'superadmin' WHERE id = '<your-user-id>';"
