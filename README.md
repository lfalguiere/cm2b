# CM2B

<p align="center">
  <img src="client/public/cm2b.png" alt="CM2B" width="160"/>
</p>

**CM2B** is a simple inventory tool for your organisation's assets — people, machines, software, locations, and more.
Define the categories that make sense for your context, link things together, and browse your inventory through customisable views and diagrams.

---

## Quick start with Docker

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
