# Archives: endpoints, fields, quirks

Checked 2026-11-05. All are free and need no key. Send a descriptive User-Agent
(`cueframe-examples sourcing (https://github.com/JeffeyChou/cueframe-examples)`), one request at a time,
and back off on 429. `scripts/lookup.py <page url>` drafts a sources.json entry from the first five.

## Library of Congress (loc.gov)

US film before ~1930, photographs, prints, maps, newspapers, recorded sound.

- Search: `https://www.loc.gov/film-and-videos/?q=<words>&dates=1890/1920&fo=json&c=20`
  (also `/photos/`, `/maps/`, `/audio/`; newspapers: `/collections/chronicling-america/?q=…&dates=1906/1906&fo=json`).
  `results[]`: `id` (item page), `title`, `date`.
- Item: `<item page>?fo=json` → `item.title`, `item.date`, `item.contributor_names`, `item.created_published`,
  `item.medium`, `item.notes` (running time and speed: "8:23 minutes at about 15 fps"), `item.rights` (the
  collection's statement and its credit line), `item.rights_advisory`; files in `resources[].files[][]` with
  `mimetype` and `url` (film: `video/mp4` on tile.loc.gov, HTTP-seekable; the listed `size` can be stale).
- Rights: read `item.rights`. Many film collections say "in the public domain and free to use and reuse"
  and give a credit line to copy into `credit`. "No known restrictions" counts as free. Anything with
  "rights status not evaluated" or a rights holder named: don't use.
- Old Chronicling America URLs (chroniclingamerica.loc.gov) redirect to `loc.gov/chroniclingamerica/` and the
  old JSON search 404s; use the collection search above.

## Internet Archive (archive.org)

Prelinger Archives, FedFlix (US government film, often from NARA), 78 rpm records, home movies,
public-domain feature films, and many re-uploads of unknown status.

- Search: `https://archive.org/advancedsearch.php?q=title:(san francisco) AND mediatype:movies AND year:[1890 TO 1930]&fl[]=identifier&fl[]=title&fl[]=year&fl[]=licenseurl&rows=50&output=json`
  (URL-encode it). Collections: `collection:prelinger`, `collection:FedFlix`, `collection:georgeblood` (78s).
- Item: `https://archive.org/metadata/<identifier>` → `metadata.title/creator/date/licenseurl/rights/collection`,
  `files[]` with `name`, `format`, `size`, `length`, `width`, `height`, `sha1`, `source` (original or derivative).
  Download: `https://archive.org/download/<identifier>/<name>` (HTTP-seekable).
- Rights: `licenseurl` is set by the uploader, often missing. Use an item when its licence is a CC0/PDM
  URL from a known collection (LoC mirrors such as `loc-film-…`, Prelinger), or when it is a US
  government work (FedFlix: say so in `note`, e.g. "NARA: US government work"). A user upload of a
  1950s cartoon or TV show with no rights field: don't use.

## Wikimedia Commons

Photographs, scans, maps, diagrams, some film (WebM transcodes of LoC/NARA prints).

- Search files: `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=<words> filetype:video&srlimit=20&format=json`
  (`filetype:bitmap` for images).
- File: `…/w/api.php?action=query&titles=File:<name>&prop=imageinfo&iiprop=url|size|mime|sha1|extmetadata&format=json`
  → `imageinfo[0].url`, `width`, `height`, `duration`, `sha1`, and `extmetadata` `LicenseShortName`,
  `LicenseUrl`, `Artist`, `Credit`, `DateTimeOriginal`, `UsageTerms`. Video transcodes:
  `prop=videoinfo&viprop=derivatives`.
- Rights: the licence tag is the uploader's; check its reasoning (PD-US-expired with a publication year,
  PD-USGov-NASA) and the `Credit`/source link. Prefer the original archive's file when Commons cites one
  (it is usually better and its rights statement counts). upload.wikimedia.org rate-limits repeated range
  requests (429): fetch once, from one connection.

## NASA Image and Video Library (images.nasa.gov)

Launches, missions, astronauts, Earth and planets, B-roll with subtitles.

- Search: `https://images-api.nasa.gov/search?q=<words>&media_type=video|image|audio&year_start=1969&page_size=50`
  → `collection.items[].data[0]` `nasa_id`, `title`, `date_created`, `center`, `photographer`,
  `secondary_creator`, `description`.
- Files: `https://images-api.nasa.gov/asset/<nasa_id>` → `~orig.mp4|jpg`, `~large`, `~medium`, `.srt`.
- Rights: NASA material is generally not copyrighted; credit "NASA" or "NASA/<photographer>". Read the
  description: ESA, JAXA, Roscosmos, contractors' or newspapers' material inside is theirs; no NASA
  logo use or implied endorsement; recognisable people (astronauts in ads) need care.

## The Met Open Access

Paintings, prints, photographs, objects: CC0 when `isPublicDomain` is true.

- Search: `https://collectionapi.metmuseum.org/public/collection/v1.1/search?q=<words>&hasImages=true&limit=50&offset=0`
  → `total`, `objectIDs` (the old `/v1/search` was retired on 2026-10-01).
- Object: `…/public/collection/v1/objects/<id>` → `title`, `artistDisplayName`, `objectDate`, `medium`,
  `isPublicDomain`, `primaryImage` (full size), `objectURL`, `creditLine`.
- Rights: `isPublicDomain: false` means not in Open Access: don't use. Credit "The Metropolitan Museum of
  Art" with the credit line.

## Satellite and map data (evidence films)

- **Worldview snapshot**, one image of a place on a day (MODIS/VIIRS true colour, fires, aerosols):
  `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326&TIME=2024-08-01&BBOX=<south>,<west>,<north>,<east>&FORMAT=image/jpeg&WIDTH=2048&HEIGHT=2048`.
  Layer names: Worldview's "Add layers" panel. Credit: "We acknowledge the use of imagery from the NASA
  Worldview application (https://worldview.earthdata.nasa.gov), part of the NASA Earth Science Data and
  Information System (ESDIS)."
- **GIBS WMS**, big mosaics and static layers (Blue Marble):
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326&BBOX=<south>,<west>,<north>,<east>&WIDTH=1024&HEIGHT=1024&FORMAT=image/jpeg`
  (WMS 1.3.0 in EPSG:4326 takes lat,lon order; tile anything over ~4k). Public domain; same acknowledgement.
- **Landsat / Sentinel-2** through Microsoft Planetary Computer (30 m / 10 m, the same place over years):
  search `POST https://planetarycomputer.microsoft.com/api/stac/v1/search` with
  `{"collections":["landsat-c2-l2"],"bbox":[w,s,e,n],"datetime":"2024-06-01/2024-09-30","query":{"eo:cloud_cover":{"lt":10}},"limit":50}`
  (`sentinel-2-l2a` for Sentinel); render a reprojected crop with
  `https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/<w>,<s>,<e>,<n>/<W>x<H>.png?collection=<c>&item=<id>&assets=red&assets=green&assets=blue&rescale=7000,14000`
  (Landsat Collection 2 Level-2 digital numbers; `.jpg` or `.png`).
  Landsat: public domain, "Landsat imagery courtesy of the U.S. Geological Survey". Sentinel: free with
  "Contains modified Copernicus Sentinel data <year>".
- **USGS 3DEP lidar** (US terrain and buildings as points): Entwine Point Tiles under
  `https://s3-us-west-2.amazonaws.com/usgs-lidar-public/<project>/ept.json`; public domain, credit USGS.
  NAIP aerials (US, ~0.6 m) through the same Planetary Computer `item/bbox` render (`collection=naip`).
- Record the full request (layer or collection, item id, bbox, date, bands, rescale) in `spec`.

## Elsewhere

- **Flickr Commons** (`flickr.com/commons`): institutions' photos marked "no known copyright
  restrictions"; credit the institution.
- **NARA catalog** (`catalog.archives.gov`): US government film and photos; usually public domain, but
  donated collections can be restricted (read "Use restrictions").
- **Europeana**, national libraries, Smithsonian Open Access (CC0 items flagged): check each item's
  rights statement (rightsstatements.org URIs: `NoC-US`, `NKC` are usable; `InC` is not).
- Stock sites, YouTube, Pinterest, social media, "free wallpaper" sites: not sources. Find the original
  holder or pass.
