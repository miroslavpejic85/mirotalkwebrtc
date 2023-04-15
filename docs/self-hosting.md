# Self hosting MiroTalk WebRTC admin

## Requirements

-   Recommended: [Hetzner](https://www.hetzner.com/cloud) (`CX21` it's enough, OS: `Ubuntu 20.04 LTS / 22.04.1 LTS`).
-   Use my [personal link](https://hetzner.cloud/?ref=XdRifCzCK3bn) to receive `€⁠20 in cloud credits`.
-   Mandatory: [Node.js](https://nodejs.org/en/) at least 16x (`16.15.1 LTS`) & npm
-   Mandatory: Your domain name, example: `your.domain.name`

    -   Set a DNS A record for that domain that point to Your Server public IPv4.

    > DNS A Record: The Address Mapping record (or DNS host record) stores a hostname and its corresponding IPv4 address. When users search for your website, the A record redirects this traffic from the web address (xxxxx.com – human-readable domain) to the IPv4 address.

---

Install the requirements (Note: Many of the installation steps require `root` or `sudo` access)

```bash
# Install NodeJS 16.X and npm
$ sudo apt update
$ sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates
$ curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ npm install -g npm@latest
```

---

## Quick start

```bash
# Clone the project repo
$ git clone https://github.com/miroslavpejic85/mirotalkwebrtc.git
# Go to project dir
$ cd mirotalkwebrtc
# Copy .env.template to .env and edit it
$ cp .env.template .env
```

Change the [MONGO](https://www.mongodb.com/) URL & DATABASE, with your own:

```bash
MONGO_URL=mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOST}:${MONGO_PORT}
MONGO_DATABASE=mirotalk
```

Or if you have docker & docker-compose, and want only instantiate mongodb, run:

```bash
$ npm run mongo:up
# npm run mongo:down to stop container
```

> **Note**
> if you disable the user email verification `EMAIL_VERIFICATION=false` skip this email setup and .env config.

Setup your email and [app password](https://support.google.com/mail/answer/185833?hl=en):

```bash
EMAIL_HOST=emailHost
EMAIL_PORT=emailPort
EMAIL_USERNAME=emailUsername
EMAIL_PASSWORD=emailPassword
```

```bash
# Install dependencies
$ npm install
# Start the server
$ npm start
```

Check if is correctly installed: https://your.domain.name:9000

---

## PM2

![pm2](../frontend/Images/pm2.png)

Using [PM2](https://pm2.keymetrics.io)

```bash
# Install pm2
$ npm install -g pm2
# Start the server
$ pm2 start backend/server.js
# Takes a snapshot
$ pm2 save
# Add it on startup
$ pm2 startup
```

---

## Docker

![docker](../frontend/Images/docker.png)

Using `Docker`

```bash
# Install docker
$ sudo apt install docker.io
# Install docker-compose
$ sudo apt install docker-compose
# Copy env.template to .env and edit it
$ cp .env.template .env
# Copy docker-compose.template.yml in docker-compose.yml and edit it if needed
$ cp docker-compose.template.yml docker-compose.yml
# Get official image from Docker Hub
$ docker pull mirotalk/webrtc:latest
# Create and start containers
$ docker-compose up -d
```

Check if is correctly installed: https://your.domain.name:9000

---

## Nginx & Certbot

![nginx](../frontend/Images/nginx.png)

In order to use it without the port number at the end, and to have encrypted communications (`mandatory to make it work correctly`), we going to install [nginx](https://www.nginx.com) and [certbot](https://certbot.eff.org)

```bash
# Install Nginx
$ sudo apt-get install nginx

# Install Certbot (SSL certificates)
$ sudo apt install snapd
$ sudo snap install core; sudo snap refresh core
$ sudo snap install --classic certbot
$ sudo ln -s /snap/bin/certbot /usr/bin/certbot

# Setup Nginx sites
$ sudo vim /etc/nginx/sites-enabled/default
```

Paste this:

```bash
# HTTP — redirect all traffic to HTTPS
server {
    if ($host = your.domain.name) {
        return 301 https://$host$request_uri;
    }
        listen 80;
        listen [::]:80  ;
    server_name your.domain.name;
    return 404;
}
```

```bash
# Check if all configured correctly
$ sudo nginx -t

# Active https for your domain name (follow the instruction)
$ sudo certbot certonly --nginx

# Add let's encrypt part on nginx config
$ sudo vim /etc/nginx/sites-enabled/default
```

Paste this:

```bash
# MiroTalk WebRTC admin - HTTPS — proxy all requests to the Node app
server {
	# Enable HTTP/2
	listen 443 ssl http2;
	listen [::]:443 ssl http2;
	server_name your.domain.name;

	# Use the Let’s Encrypt certificates
	ssl_certificate /etc/letsencrypt/live/your.domain.name/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/your.domain.name/privkey.pem;

	location / {
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header Host $host;
		proxy_pass http://localhost:9000/;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
	}
}
```

```bash
# Check if all configured correctly
$ sudo nginx -t

# Restart nginx
$ service nginx restart
$ service nginx status

# Auto renew SSL certificate
$ sudo certbot renew --dry-run

# Show certificates
$ sudo certbot certificates
```

Check Your MiroTalk WebRTC admin instance: https://your.domain.name

---

## Update script

In order to have Your MiroTalk WebRTC admin instance always updated to latest, we going to create a script

```bash
$ cd
# Create a file mirotalkwebrtcUpdate.sh
$ vim mirotalkwebrtcUpdate.sh
```

---

Using `PM2`, paste this:

```bash
#!/bin/bash

cd mirotalkwebrtc
git pull
pm2 stop backend/server.js
sudo npm install
pm2 start server.js
```

---

Using `Docker`, paste this:

```bash
#!/bin/bash

cd mirotalkwebrtc
git pull
docker-compose down
docker-compose pull
docker images |grep '<none>' |awk '{print $3}' |xargs docker rmi
docker-compose up -d
```

---

Make the script executable

```bash
$ chmod +x mirotalkwebrtcUpdate.sh
```

Follow the commits of the MiroTalk WebRTC admin project [here](https://github.com/miroslavpejic85/mirotalkwebrtc/commits/master)

To update Your MiroTalk WebRTC admin instance at latest commit, execute:

```bash
./mirotalkwebrtcUpdate.sh
```
