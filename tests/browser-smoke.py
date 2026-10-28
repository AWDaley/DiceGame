"""Optional graphical smoke check; not a runtime dependency.
Requires Python + Playwright + Chromium. Run: python tests/browser-smoke.py
Uses the exact standalone HTML in an isolated document, with all network blocked.
This sandbox restricts file:// navigation; static packaging is covered by offline.test.js.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)

def allocate(page, name, count=1):
    for _ in range(count):
        page.get_by_role('button', name=f'Add {name} point', exact=True).click()

def click(page, action, id=None, attribute=None):
    selector = f'[data-action="{action}"]'
    if id:
        selector += f'[data-id="{id}"]'
    if attribute:
        selector += f'[data-attribute="{attribute}"]'
    page.locator(selector).click()

results = []
with sync_playwright() as p:
    import os, shutil
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
    browser = p.chromium.launch(**({'executable_path': executable} if executable else {}), headless=True)
    for width, height, label in [(1440, 1000, 'desktop'), (390, 844, 'mobile')]:
        context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce')
        page = context.new_page()
        errors, requests = [], []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('request', lambda request: requests.append(request.url))
        page.on('dialog', lambda dialog: dialog.accept())
        page.route('**/*', lambda route: route.abort())
        page.evaluate('Math.random = () => 0.5')
        page.set_content(HTML, wait_until='load')
        assert page.get_by_role('button', name='BEGIN ADVENTURE').is_disabled()
        assert page.locator('.phase-meta__big').inner_text() == '3 POINTS LEFT'
        page.screenshot(path=str(OUT / f'{label}-creation.png'), full_page=True)
        allocate(page, 'Might', 2)
        allocate(page, 'Finesse')
        click(page, 'confirm-attributes')
        for id in ['die-1', 'die-7', 'die-8']:
            click(page, 'toggle-die', id)
        click(page, 'roll')
        for mod in ['die-7', 'die-8']:
            click(page, 'select-roll', mod)
            click(page, 'select-roll', 'die-1')
        attack = page.locator('article.rolled-die').filter(has=page.locator('[data-id="die-1"]'))
        assert attack.locator('.rolled-die__result').inner_text() == '22 DAMAGE'
        assert 'Face 4 + 2 Might = 6' in attack.inner_text()
        click(page, 'focus', attribute='might')
        assert attack.locator('.rolled-die__result').inner_text() == '26 DAMAGE'
        assert '0/7 MANA' in page.locator('.control-panel').inner_text()
        assert page.locator('[data-action="focus"]').first.is_disabled()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        page.screenshot(path=str(OUT / f'{label}-cast.png'), full_page=True)
        click(page, 'commit')
        assert 'TURN 2' in page.locator('.phase-meta').inner_text()
        assert '53' in page.locator('.hero-combatant').inner_text()
        click(page, 'new-run')
        assert page.locator('.phase-meta__big').inner_text() == '3 POINTS LEFT'
        allocate(page, 'Spirit', 2)
        allocate(page, 'Vitality')
        assert page.get_by_role('button', name='BEGIN ADVENTURE').is_disabled()
        page.locator('[data-talent="meditation"]').click()
        click(page, 'confirm-attributes')
        assert '9/9' in page.locator('.hero-combatant').inner_text()
        assert '5 / turn' in page.locator('.character-sheet').inner_text()
        assert '66/66' in page.locator('.hero-combatant').inner_text().replace(' ', '')
        page.get_by_role('button', name='How to play', exact=True).click()
        assert page.locator('dialog').is_visible()
        page.locator('dialog .primary-button').click()
        assert not page.locator('dialog').is_visible()
        assert not errors, errors
        assert not requests, requests
        results.append({'viewport': label, 'passed': True, 'javascript_errors': errors, 'network_requests': requests})
        context.close()
    browser.close()
(OUT / 'browser-smoke.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps(results, indent=2))
