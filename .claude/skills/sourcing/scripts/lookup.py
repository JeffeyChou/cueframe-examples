#!/usr/bin/env python3
"""Draft a data/sources.json entry from an archive page.

usage: python3 lookup.py <url> [--id ID] [--kind footage|image|audio|music|data|font|other]

Understands Wikimedia Commons file pages, archive.org items, loc.gov items, images.nasa.gov
details pages and the Met's collection pages. Prints the entry as JSON with the archive's own
rights text in `note`; check the licence yourself before using the file. Standard library only.
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date

UA = 'cueframe-examples sourcing (https://github.com/JeffeyChou/cueframe-examples)'


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def text(s):
    s = re.sub(r'<[^>]+>', ' ', html.unescape(str(s or '')))
    return re.sub(r'\s+', ' ', s).strip()


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')[:40] or 'source'


def kind_of(mime):
    m = (mime or '').split('/')[0]
    return {'video': 'footage', 'image': 'image', 'audio': 'audio'}.get(m, 'data')


def commons(u):
    title = urllib.parse.unquote(u.path.split('/wiki/', 1)[1]).replace('_', ' ')
    q = urllib.parse.urlencode({'action': 'query', 'titles': title, 'prop': 'imageinfo', 'format': 'json',
                                'iiprop': 'url|size|mime|sha1|extmetadata'})
    page = next(iter(get(f'https://commons.wikimedia.org/w/api.php?{q}')['query']['pages'].values()))
    ii = page['imageinfo'][0]
    md = {k: text(v.get('value')) for k, v in ii.get('extmetadata', {}).items()}
    spec = f"{ii.get('width')}×{ii.get('height')}" + (f", {float(ii['duration']):.1f} s" if ii.get('duration') else '')
    return {
        'title': md.get('ObjectName') or title.removeprefix('File:'),
        'author': md.get('Artist', ''),
        'date': md.get('DateTimeOriginal', ''),
        'licence': md.get('LicenseShortName', ''),
        'page': f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'), safe=':/')}",
        'url': ii['url'].split('?')[0], 'kind': kind_of(ii.get('mime')), 'spec': f"{ii.get('mime')}, {spec}, sha1 {ii.get('sha1')}",
        'note': '; '.join(x for x in (md.get('Credit'), md.get('UsageTerms'), md.get('LicenseUrl')) if x),
    }


def archive(u):
    ident = u.path.strip('/').split('/')[1]
    d = get(f'https://archive.org/metadata/{ident}')
    m = d['metadata']
    one = lambda v: '; '.join(v) if isinstance(v, list) else (v or '')
    media = [f for f in d.get('files', []) if f.get('name', '').lower().endswith(('.mp4', '.mpeg', '.mov', '.ogv', '.mkv', '.avi', '.wav', '.flac', '.mp3', '.jpg', '.png', '.tif'))]
    media.sort(key=lambda f: (f.get('source') == 'original', int(f.get('size') or 0)), reverse=True)
    f = media[0] if media else {}
    rights = [x for x in (m.get('licenseurl'), one(m.get('rights')), one(m.get('possible-copyright-status'))) if x]
    return {
        'title': one(m.get('title')), 'author': one(m.get('creator')), 'date': one(m.get('date') or m.get('year')),
        'licence': m.get('licenseurl') or '',
        'page': f'https://archive.org/details/{ident}',
        'url': f"https://archive.org/download/{ident}/{urllib.parse.quote(f['name'])}" if f else '',
        'kind': 'footage' if m.get('mediatype') == 'movies' else kind_of(f.get('format', '')),
        'spec': ', '.join(x for x in (f.get('format'), f"{f.get('width')}×{f.get('height')}" if f.get('width') else '',
                                      f"{float(f['length']):.1f} s" if re.fullmatch(r'[\d.]+', str(f.get('length', ''))) else '',
                                      f"sha1 {f['sha1']}" if f.get('sha1') else '') if x),
        'note': '; '.join(rights + [f"collection: {one(m.get('collection'))}"]),
    }


def loc(u):
    d = get(f"https://www.loc.gov{u.path.rstrip('/')}/?fo=json")
    it = d['item']
    files = [f for r in d.get('resources', []) for fl in r.get('files', []) for f in fl]
    pick = [f for f in files if f.get('mimetype') == 'video/mp4'] or \
        sorted([f for f in files if (f.get('mimetype') or '').startswith('image/')], key=lambda f: f.get('width') or 0, reverse=True)
    f = pick[0] if pick else {}
    return {
        'title': text(it.get('title')), 'author': '; '.join(it.get('contributor_names') or []),
        'date': text(it.get('date')),
        'licence': text(it.get('rights_advisory')) if it.get('rights_advisory') else '',
        'page': f"https://www.loc.gov{u.path}", 'url': f.get('url', ''), 'kind': kind_of(f.get('mimetype')),
        'spec': ', '.join(text(x) for x in (it.get('medium') or [])[:1] + (it.get('notes') or [])[:2]),
        'note': text(' '.join(it.get('rights') or [])),
    }


def nasa(u):
    nid = u.path.rstrip('/').split('/')[-1]
    item = get(f'https://images-api.nasa.gov/search?nasa_id={urllib.parse.quote(nid)}')['collection']['items'][0]
    x = item['data'][0]
    hrefs = [i['href'] for i in get(f'https://images-api.nasa.gov/asset/{urllib.parse.quote(nid)}')['collection']['items']]
    orig = [h for h in hrefs if '~orig.' in h] or hrefs
    by = x.get('photographer') or x.get('secondary_creator') or x.get('center', '')
    return {
        'title': x.get('title', ''), 'author': f'NASA/{by}' if by and not by.startswith('NASA') else (by or 'NASA'),
        'date': (x.get('date_created') or '')[:10],
        'licence': 'Public domain (NASA, US government work)',
        'page': f'https://images.nasa.gov/details/{nid}', 'url': orig[0].replace('http://', 'https://') if orig else '',
        'kind': 'footage' if x.get('media_type') == 'video' else kind_of(x.get('media_type', '') + '/'),
        'spec': x.get('center', ''),
        'note': 'Check the description for non-NASA credits (ESA, JAXA, contractors) and recognisable people. '
                + text(x.get('description', ''))[:300],
    }


def met(u):
    oid = u.path.rstrip('/').split('/')[-1]
    x = get(f'https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}')
    free = x.get('isPublicDomain')
    return {
        'title': x.get('title', ''), 'author': x.get('artistDisplayName') or x.get('culture', ''),
        'date': x.get('objectDate', ''), 'licence': 'CC0 1.0' if free else '',
        'page': x.get('objectURL') or f'https://www.metmuseum.org/art/collection/search/{oid}',
        'url': x.get('primaryImage', ''), 'kind': 'image',
        'spec': ', '.join(v for v in (x.get('medium'), x.get('dimensions')) if v),
        'note': ('The Met Open Access (CC0)' if free else 'Not in Open Access: do not use')
                + f"; credit line: {x.get('creditLine', '')}",
    }


SITES = {'commons.wikimedia.org': commons, 'archive.org': archive, 'www.loc.gov': loc, 'loc.gov': loc,
         'images.nasa.gov': nasa, 'www.metmuseum.org': met, 'metmuseum.org': met}


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__.strip())
        return 0
    u = urllib.parse.urlparse(argv[0])
    fn = SITES.get(u.netloc)
    if not fn:
        print(f'lookup: no reader for {u.netloc} (knows {", ".join(sorted(SITES))}); fill the entry by hand', file=sys.stderr)
        return 2
    e = fn(u)
    opt = dict(zip(argv[1::2], argv[2::2]))
    out = {'id': opt.get('--id') or slug(e['title']), 'file': '', 'kind': opt.get('--kind') or e.pop('kind')}
    e.pop('kind', None)
    out.update(e)
    out['retrieved'] = date.today().isoformat()
    out['used'] = []
    if not out['licence']:
        print('lookup: the archive gives no licence field; read `note` and the page, then fill `licence`', file=sys.stderr)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
