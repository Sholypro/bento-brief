#!/usr/bin/env python3
"""Publie la page : copie artifact/index.html vers docs/ avec un numéro de version.
La page compare ce numéro à docs/version.json et se recharge seule quand il change."""
import datetime, json, pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
build = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
src = (root / 'artifact' / 'index.html').read_text(encoding='utf-8')
assert "const BUILD = '__BUILD__';" in src
(root / 'docs' / 'index.html').write_text(src.replace("const BUILD = '__BUILD__';", f"const BUILD = '{build}';"), encoding='utf-8')
(root / 'docs' / 'version.json').write_text(json.dumps({'build': build}) + '\n', encoding='utf-8')
sw = root / 'docs' / 'sw.js'
sw.write_text(re.sub(r"const CACHE = 'bento-[^']*';", f"const CACHE = 'bento-{build}';", sw.read_text(encoding='utf-8')), encoding='utf-8')
print(build)
