# MiloBolo — Setup Guide

## Step 1: Supabase
1. Go to supabase.com → New Project
2. Copy Project URL + anon key + service role key → paste in `.env`
3. Go to SQL Editor → paste contents of `supabase/schema.sql` → Run

## Step 2: Enable Google OAuth in Supabase
1. Supabase Dashboard → Authentication → Providers → Google → Enable
2. Add your Google OAuth Client ID + Secret
3. Add redirect URL: `https://chat.videodownloaders.cloud/auth/callback`

## Step 3: Cloudflare R2
1. Cloudflare Dashboard → R2 → Create bucket: `milobolo-assets`
2. R2 → Manage API tokens → Create token (Object Read & Write)
3. Paste Account ID, Access Key, Secret Key in `.env`
4. Set bucket public domain → paste in `NEXT_PUBLIC_R2_PUBLIC_URL`

## Step 4: Google Services
1. **Analytics**: analytics.google.com → Create property → paste `G-XXXXXXXX` in `.env`
2. **reCAPTCHA v3**: console.cloud.google.com → reCAPTCHA → Create key (v3) → paste keys in `.env`
3. **AdSense**: Add your publisher ID in `NEXT_PUBLIC_ADSENSE_CLIENT_ID` (or edit AdSlot.tsx)

## Step 5: Add DNS subdomain
In your domain registrar / Hostinger DNS:
```
A    chat    187.127.182.5    (TTL: 3600)
```

## Step 6: Deploy to VPS
```bash
# SSH into VPS
ssh root@187.127.182.5

# Upload project (or git clone)
scp -r ./milobolo root@187.127.182.5:/root/milobolo

# On VPS
cd /root/milobolo
cp .env.example .env
nano .env          # fill in all values
chmod +x deploy.sh
./deploy.sh
```

## Step 7: Set yourself as superadmin
In Supabase SQL Editor:
```sql
UPDATE profiles SET role = 'superadmin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```
Then go to `https://chat.videodownloaders.cloud/admin`

## TURN Server
The coturn container starts automatically. TURN credentials must match:
- `NEXT_PUBLIC_TURN_USERNAME` in `.env` 
- `NEXT_PUBLIC_TURN_CREDENTIAL` in `.env`
- `user=` in `coturn/turnserver.conf`

## Firewall ports to open on VPS
```
80, 443 (HTTP/HTTPS)
3478, 5349 (TURN/STUN TCP+UDP)
```
