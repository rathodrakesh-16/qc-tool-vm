# QC Tool — Google Cloud VM Deployment Guide

> **Stack:** Laravel 12 (PHP 8.2+) · PostgreSQL · Nginx · Vanilla JS frontend (served via Laravel public/)
> **Target:** Google Cloud Compute Engine VM (Ubuntu 22.04 LTS)
> **Access:** External IP only (no custom domain)

---

## Table of Contents

1. [Create the VM](#1-create-the-vm)
2. [Connect to the VM](#2-connect-to-the-vm)
3. [Install System Dependencies](#3-install-system-dependencies)
4. [Install and Configure PostgreSQL](#4-install-and-configure-postgresql)
5. [Install and Configure Nginx](#5-install-and-configure-nginx)
6. [Install PHP 8.2 and Extensions](#6-install-php-82-and-extensions)
7. [Install Composer](#7-install-composer)
8. [Deploy the Application](#8-deploy-the-application)
9. [Configure Environment Variables](#9-configure-environment-variables)
10. [Run Migrations and Setup](#10-run-migrations-and-setup)
11. [Configure Nginx Virtual Host](#11-configure-nginx-virtual-host)
12. [Set File Permissions](#12-set-file-permissions)
13. [Configure PHP-FPM](#13-configure-php-fpm)
14. [Firewall Rules](#14-firewall-rules)
15. [Configure Gemini API](#15-configure-gemini-api)
16. [Verify Everything Works](#16-verify-everything-works)
17. [Common Issues & Fixes](#17-common-issues--fixes)

---

## 1. Create the VM

### In Google Cloud Console:

1. Go to **Compute Engine → VM Instances → Create Instance**
2. Configure:
   - **Name:** `qc-tool-vm` (or your choice)
   - **Region/Zone:** Choose closest to your users (e.g., `us-central1-a`)
   - **Machine type:** `e2-medium` (2 vCPU, 4 GB RAM) minimum; `e2-standard-2` recommended for production
   - **Boot disk:**
     - OS: **Ubuntu 22.04 LTS**
     - Size: **20 GB SSD** (minimum), 40 GB recommended
   - **Firewall:** Check both **Allow HTTP traffic** and **Allow HTTPS traffic**
3. Click **Create**

### Note your External IP
After creation, copy the **External IP** — you will use it to access the app and throughout this guide.

---

## 2. Connect to the VM

```bash
# From Google Cloud Console, click the SSH button on your VM row
# OR use gcloud CLI:
gcloud compute ssh qc-tool-vm --zone=us-central1-a
```

All commands below are run **on the VM** via SSH.

---

## 3. Install System Dependencies

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y git curl unzip zip wget software-properties-common apt-transport-https ca-certificates
```

---

## 4. Install and Configure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib

sudo systemctl start postgresql
sudo systemctl enable postgresql

# Verify it's running
sudo systemctl status postgresql
```

### Create the database and user:

```bash
sudo -u postgres psql
```

Inside the psql prompt, run:

```sql
CREATE DATABASE qctool_db;
CREATE USER qctool_user WITH ENCRYPTED PASSWORD 'your_strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE qctool_db TO qctool_user;
ALTER DATABASE qctool_db OWNER TO qctool_user;
\q
```

> Replace `your_strong_password_here` with a strong password and save it — you'll need it in `.env`.

### Verify the connection:

```bash
psql -U qctool_user -d qctool_db -h 127.0.0.1 -W
# Enter your password — if you see the psql prompt it works
\q
```

---

## 5. Install and Configure Nginx

```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 6. Install PHP 8.2 and Extensions

```bash
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update

sudo apt install -y \
  php8.2 \
  php8.2-fpm \
  php8.2-pgsql \
  php8.2-mbstring \
  php8.2-xml \
  php8.2-curl \
  php8.2-zip \
  php8.2-bcmath \
  php8.2-tokenizer \
  php8.2-fileinfo \
  php8.2-intl \
  php8.2-gd

# Verify
php --version
# Should output: PHP 8.2.x
```

---

## 7. Install Composer

```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer

# Verify
composer --version
```

---

## 8. Deploy the Application

```bash
cd /var/www

# Clone the repository — Laravel files are at the repo root
sudo git clone https://github.com/rathodrakesh-16/qc-tool-v0.2.15.git qctool

# Set ownership
sudo chown -R www-data:www-data /var/www/qctool
sudo chmod -R 755 /var/www/qctool

# Go into the app directory (repo root = Laravel root)
cd /var/www/qctool

# Install production dependencies
sudo -u www-data composer install --optimize-autoloader --no-dev
```

---

## 9. Configure Environment Variables

```bash
cd /var/www/qctool

sudo cp .env.example .env
sudo nano .env
```

Fill in the `.env` file with these values (replace `YOUR_EXTERNAL_IP` and password):

```env
APP_NAME=QCTool
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=http://YOUR_EXTERNAL_IP

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=qctool_db
DB_USERNAME=qctool_user
DB_PASSWORD=your_strong_password_here

SESSION_DRIVER=database
SESSION_LIFETIME=300
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null

SANCTUM_STATEFUL_DOMAINS=YOUR_EXTERNAL_IP
FRONTEND_URL=http://YOUR_EXTERNAL_IP

CACHE_STORE=file

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_ENABLED=true
GEMINI_VERIFY_SSL=true
```

Save and close: `Ctrl+X` → `Y` → `Enter`

### Generate the application key:

```bash
sudo -u www-data php artisan key:generate
```

---

## 10. Run Migrations and Setup

```bash
cd /var/www/qctool

# Run all migrations (creates users, sessions, and all app tables in one pass)
sudo -u www-data php artisan migrate --force

# Seed initial data (admin users etc.)
sudo -u www-data php artisan db:seed --force

# Cache config and routes for production performance
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache

# Create storage symlink
sudo -u www-data php artisan storage:link
```

---

## 11. Configure Nginx Virtual Host

```bash
sudo nano /etc/nginx/sites-available/qctool
```

Paste this config — replace `YOUR_EXTERNAL_IP` with your actual IP:

```nginx
server {
    listen 80;
    server_name YOUR_EXTERNAL_IP;

    root /var/www/qctool/public;
    index index.php index.html;

    # Max upload size (for file imports)
    client_max_body_size 50M;

    # Gemini API calls can take up to 120 seconds
    fastcgi_read_timeout 130;
    proxy_read_timeout 130;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 130;
    }

    # Block access to hidden files (.env, .git, etc.)
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Block direct access to sensitive directories
    location ~ ^/(vendor|storage|bootstrap/cache) {
        deny all;
    }
}
```

### Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/qctool /etc/nginx/sites-enabled/

# Remove the default Nginx placeholder page
sudo rm -f /etc/nginx/sites-enabled/default

# Test the config
sudo nginx -t
# Expected: nginx: configuration file ...syntax is ok

# Reload Nginx
sudo systemctl reload nginx
```

---

## 12. Set File Permissions

```bash
cd /var/www/qctool

sudo chown -R www-data:www-data /var/www/qctool

sudo find /var/www/qctool -type d -exec chmod 755 {} \;
sudo find /var/www/qctool -type f -exec chmod 644 {} \;

# Storage and bootstrap/cache must be writable
sudo chmod -R 775 storage
sudo chmod -R 775 bootstrap/cache
```

---

## 13. Configure PHP-FPM

Increase timeouts to handle Gemini API calls (up to 120 seconds):

```bash
sudo nano /etc/php/8.2/fpm/pool.d/www.conf
```

Find and set:

```ini
request_terminate_timeout = 130
```

```bash
sudo nano /etc/php/8.2/fpm/php.ini
```

Find and set:

```ini
max_execution_time = 130
max_input_time = 130
memory_limit = 256M
upload_max_filesize = 50M
post_max_size = 50M
```

```bash
sudo systemctl restart php8.2-fpm
sudo systemctl enable php8.2-fpm
```

---

## 14. Firewall Rules

### In Google Cloud Console:

1. Go to **VPC Network → Firewall**
2. Confirm these rules exist (created automatically if you checked HTTP/HTTPS during VM setup):
   - `default-allow-http` — TCP port **80** from `0.0.0.0/0`
   - `default-allow-ssh` — TCP port **22**
3. **Do NOT expose port 5432** (PostgreSQL must stay internal only)

### On the VM (UFW):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx HTTP'
sudo ufw enable
sudo ufw status
```

---

## 15. Configure Gemini API

Verify the API key is set in `.env` and the VM can reach Google's API:

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
# Expected output: 200
```

If you get `000` — the VM has no outbound internet access. Check GCP egress firewall rules.

---

## 16. Verify Everything Works

Run these checks in order:

```bash
# 1. PHP version
php --version
# Expected: PHP 8.2.x

# 2. Laravel working
cd /var/www/qctool
sudo -u www-data php artisan --version
# Expected: Laravel Framework 12.x.x

# 3. Database connection
sudo -u www-data php artisan db:show

# 4. Nginx config valid
sudo nginx -t

# 5. PHP-FPM running
sudo systemctl status php8.2-fpm

# 6. App health check
curl http://YOUR_EXTERNAL_IP/up
# Expected: 200 OK

# 7. Watch for errors
sudo tail -f /var/www/qctool/storage/logs/laravel.log
```

### Browser test:
Open `http://YOUR_EXTERNAL_IP` in your browser — you should see the QC Tool login page.

---

## 17. Common Issues & Fixes

### 502 Bad Gateway
```bash
sudo systemctl status php8.2-fpm
ls -la /var/run/php/php8.2-fpm.sock
sudo systemctl restart php8.2-fpm
```

### 500 Internal Server Error
```bash
sudo tail -50 /var/www/qctool/storage/logs/laravel.log
# Common causes:
# - APP_KEY missing → sudo -u www-data php artisan key:generate
# - Wrong DB credentials in .env
# - Storage not writable → sudo chmod -R 775 storage bootstrap/cache
```

### Migrations fail
```bash
# Test DB connection
psql -U qctool_user -d qctool_db -h 127.0.0.1 -W

# Check .env DB values
sudo grep DB_ /var/www/qctool/.env
```

### Config changes not taking effect
```bash
cd /var/www/qctool
sudo -u www-data php artisan config:clear
sudo -u www-data php artisan route:clear
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache
```

### Gemini AI timeout
```bash
php -r "echo ini_get('max_execution_time');"
# Should be 130

grep fastcgi_read_timeout /etc/nginx/sites-available/qctool
# Should show 130
```

### Permission denied errors
```bash
sudo chown -R www-data:www-data /var/www/qctool
sudo chmod -R 775 /var/www/qctool/storage
sudo chmod -R 775 /var/www/qctool/bootstrap/cache
```

---

## Quick Reference — Key Paths

| Item | Path |
|------|------|
| Application root | `/var/www/qctool` |
| Public web root | `/var/www/qctool/public` |
| Environment file | `/var/www/qctool/.env` |
| Laravel logs | `/var/www/qctool/storage/logs/laravel.log` |
| Nginx site config | `/etc/nginx/sites-available/qctool` |
| Nginx error log | `/var/log/nginx/error.log` |
| PHP-FPM config | `/etc/php/8.2/fpm/pool.d/www.conf` |
| PHP ini | `/etc/php/8.2/fpm/php.ini` |

---

## After Future Code Updates

When you push new code to GitHub and need to deploy the update:

```bash
cd /var/www/qctool

# Pull latest changes
sudo git pull origin main

# Re-install dependencies if composer.json changed
sudo -u www-data composer install --optimize-autoloader --no-dev

# Run any new migrations
sudo -u www-data php artisan migrate --force

# Rebuild caches
sudo -u www-data php artisan config:cache
sudo -u www-data php artisan route:cache

# Fix permissions if needed
sudo chown -R www-data:www-data /var/www/qctool
```
