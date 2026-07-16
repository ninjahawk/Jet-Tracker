# JETTRACK — r/ElonJetTracker OSINT Terminal

A [Palantir](https://www.palantir.com/)-style "intelligence terminal" for
[r/ElonJetTracker](https://www.reddit.com/r/elonjettracker/), tracking
**N628TS** (Gulfstream G650ER, ICAO `A835AF`).

> **Parody UI.** Not affiliated with, endorsed by, or connected to Palantir
> Technologies. All data shown is public, open-source information.

## Features

- **Tactical map** (Leaflet + dark CARTO basemap) with target marker, range
  rings, breadcrumb trail, and points of interest (Giga Texas, Starbase, …).
- **Live ADS-B lookup** via the free [adsb.lol](https://api.adsb.lol/docs) API.
  When the jet isn't broadcasting (LADD/PIA filtering — the usual case), the
  page falls back to a clearly-labeled **MOCK DATA** simulated leg so the
  terminal stays alive.
- **AIP-style investigation feed** with an alert card and a canned-response
  "assistant" prompt box (try `where is the jet`, `g700`, `help`).
- **G700 Watchlist tab** — the sub's registry sweep of early G700 airframes,
  with the two **Falcon Holdings LLC** airframes flagged.
- **Sub Info tab** — the sidebar's aircraft links (OpenSky, FAA Registry,
  JetPhotos, FAA ADS-B FAQ) and credits.

## Running it

It's a fully static site — no build step.

```sh
# any static file server works:
python3 -m http.server 8080
# then open http://localhost:8080
```

For **GitHub Pages**: Settings → Pages → deploy from branch, root folder.

## Structure

```
index.html      page layout
css/styles.css  dark tactical theme
js/data.js      target info, G700 watchlist, POIs, mock route
js/app.js       map, live polling, simulation, feed, ask box
```
