<p align="center">
  <img src="client/public/cm2b.png" alt="CM2B" width="160"/>
</p>

**CM2B** is a simple inventory tool for your organisation's assets — people, machines, software, locations, and more.
Define the categories that make sense for your context, link things together, and browse your inventory through customisable views and diagrams.

---

## Quick start with Docker

> **Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) must be installed on your machine. That's the only thing you need.

### Option 1 — Docker Compose (recommended)

**Step 1** — Download the configuration file into a new folder:

```bash
mkdir cm2b && cd cm2b
curl -O https://raw.githubusercontent.com/lfalguiere/cm2b/main/docker-compose.yml
```

**Step 2** — Start the application:

```bash
docker compose up -d
```

**Step 3** — Open [http://localhost:3000](http://localhost:3000) in your browser.
On first launch, you will be prompted to create your admin account.

### Option 2 — Single command (no file needed)

```bash
docker run -d \
  --name cm2b \
  -p 3000:3000 \
  -v cm2b-data:/app/data \
  ghcr.io/lfalguiere/cm2b:latest
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Data persistence

Your data is stored in a Docker volume named `cm2b-data`.
It survives container restarts and upgrades automatically.

To start fresh (⚠ this deletes all your data):

```bash
docker compose down
docker volume rm cm2b-data
docker compose up
```

---

## Upgrade

```bash
docker compose pull
docker compose up
```

Your data is preserved.
