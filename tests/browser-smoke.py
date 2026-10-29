"""Graphical regression using the exact standalone artifact, with network disabled.
Run `python tests/browser-smoke.py --require-file` in CI. Restricted environments
may omit that flag: file-navigation failure is reported, never called a pass.
Requires requirements-browser.txt and Playwright Chromium; not a game dependency.
"""
from pathlib import Path
import argparse
import json
import os
import shutil
from playwright.sync_api import sync_playwright, Error

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
ARGS = argparse.ArgumentParser()
ARGS.add_argument('--require-file', action='store_true')
OPTIONS = ARGS.parse_args()
RANDOM = "window.__testRng=[]; Math.random=()=>window.__testRng.length ? window.__testRng.shift() : 0.5;"

def setup(browser, width, height):
    context = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', offline=True)
    errors, network = [], []
    def fresh_page():
        page = context.new_page()
        page.set_default_timeout(5000)
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: network.append(r.url) if r.url.startswith(('http:', 'https:')) else None)
        page.on('dialog', lambda d: d.accept())
        page.route('**/*', lambda route: route.continue_() if route.request.url.startswith('file:') else route.abort())
        page.add_init_script(RANDOM)
        return page
    page = fresh_page()
    navigation, blocked = 'file', None
    try:
        page.goto((ROOT / 'index.html').as_uri(), wait_until='load')
    except Error as error:
        if OPTIONS.require_file:
            raise
        navigation, blocked = 'isolated-document', str(error).split('\n')[0]
        page.close()
        page = fresh_page()
        page.evaluate(RANDOM)
        page.set_content(HTML, wait_until='load')
    return context, page, errors, network, navigation, blocked

def click(page, action, **fields):
    selector = f'[data-action="{action}"]'
    for key, value in fields.items():
        selector += f'[data-{key.replace("_", "-")}="{value}"]'
    page.locator(selector).click()

def allocate(page, attribute, count=1):
    for _ in range(count):
        page.get_by_role('button', name=f'Add {attribute} point', exact=True).click()

def has_enabled(page, selector):
    return page.locator(selector).count() > 0 and page.locator(selector).first.is_enabled()

def select_maneuver(page, maneuver):
    selector = f'[data-action="maneuver"][data-maneuver-id="{maneuver}"]'
    if not has_enabled(page, selector):
        return False
    page.locator(selector).first.click()
    return True

def support(page, item_id):
    selector=f'[data-action="support"][data-item-id="{item_id}"]'
    if has_enabled(page,selector):
        page.locator(selector).click()

def assert_clean(page, errors, network):
    assert not errors, errors
    assert not network, network
    assert not page.locator('.toast').count(), page.locator('.toast').all_text_contents()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'Horizontal overflow'

results=[]
with sync_playwright() as p:
    executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
    browser=p.chromium.launch(headless=True, **({'executable_path': executable} if executable else {}))
    for width,height,label in [(1440,1000,'desktop'),(390,844,'mobile')]:
        context,page,errors,network,navigation,blocked=setup(browser,width,height)
        assert page.get_by_role('button',name='CHOOSE EQUIPMENT',exact=False).is_disabled()
        for attr in ['Might','Finesse','Vitality']:
            allocate(page,attr)
        click(page,'confirm-attributes')
        assert '8 / 8 equipped' in page.locator('.loadout-banner').inner_text()
        page.screenshot(path=str(OUT/f'{label}-loadout.png'),full_page=True)
        click(page,'begin-battle')
        select_maneuver(page,'quick_strike');support(page,'item-6')
        click(page,'declare')
        assert page.locator('h1').inner_text()=='Bend the result.'
        assert '10' in page.locator('[aria-label="hero roll"] .effect-total').inner_text()
        click(page,'focus',attribute='finesse')
        assert '14' in page.locator('[aria-label="hero roll"] .effect-total').inner_text()
        click(page,'reroll',item_id='item-1')
        assert 'Free reroll spent' in page.locator('.cast-footer').inner_text()
        page.screenshot(path=str(OUT/f'{label}-roll.png'),full_page=True)
        click(page,'lock');click(page,'continue')
        assert page.locator('h1').inner_text()=='Choose your response.'
        assert 'NOT YET ROLLED' in page.locator('.incoming-panel').inner_text()
        assert select_maneuver(page,'block')
        page.screenshot(path=str(OUT/f'{label}-reaction.png'),full_page=True)
        click(page,'declare')
        assert 'LOCKED' in page.locator('[aria-label="enemy roll"] .lock-tag').inner_text()
        assert '1 MANA' in page.locator('[aria-label="hero roll"] .inline-tools').inner_text()
        click(page,'lock');click(page,'continue')
        assert 'ROUND 2' in page.locator('.arena-dash').inner_text()
        assert_clean(page,errors,network)
        # Shield Bash is offensive, and a skipped slot explicitly grants Resolve.
        click(page,'new-run');allocate(page,'Might',2);allocate(page,'Vitality')
        click(page,'confirm-attributes');click(page,'begin-battle')
        select_maneuver(page,'shield_bash');support(page,'item-6');support(page,'item-8')
        click(page,'declare');click(page,'lock');click(page,'continue')
        assert 'loses this main action' in page.locator('.exchange-outcome').inner_text()
        assert 'Resolve' in page.locator('.enemy-combatant').inner_text()
        click(page,'continue')
        assert 'ROUND 2' in page.locator('.arena-dash').inner_text()
        # Talent choice and keyboard interaction remain intact.
        click(page,'new-run');allocate(page,'Spirit',2);allocate(page,'Vitality')
        assert page.get_by_role('button',name='CHOOSE EQUIPMENT',exact=False).is_disabled()
        page.locator('[data-talent="meditation"]').click()
        page.locator('[data-action="confirm-attributes"]').focus();page.keyboard.press('Enter')
        click(page,'begin-battle')
        assert '9/9 mana' in page.locator('.hero-combatant').inner_text()
        assert '3 / round' in page.locator('.character-sheet').inner_text()
        click(page,'help');assert page.locator('dialog').is_visible();page.locator('dialog [data-action="close-help"]').first.click()
        assert_clean(page,errors,network)
        results.append({'test':label,'passed':True,'navigation':navigation,'file_navigation_blocked':blocked,'javascript_errors':errors,'network_requests':network})
        context.close()
    # Complete a four-encounter campaign using actual controls. Fixed legal dice
    # outcomes make this a progression test, not a win-rate or balance claim.
    context,page,errors,network,navigation,blocked=setup(browser,1440,1000)
    allocate(page,'Might',2);allocate(page,'Finesse');click(page,'confirm-attributes')
    forged=False;bought=False;steps=0;levelups=0
    for steps in range(260):
        assert_clean(page,errors,network)
        title=page.locator('h1').inner_text()
        if 'rewritten' in title:
            break
        assert 'silent' not in title, 'Deterministic campaign unexpectedly lost'
        if page.locator('[data-action="begin-battle"]').count():
            click(page,'begin-battle')
        elif page.locator('[data-action="allocate"]').count():
            levelups+=1
            for attr in ['Might','Finesse','Vitality','Spirit','Arcana']:
                button=page.get_by_role('button',name=f'Add {attr} point',exact=True)
                if button.is_enabled():button.click();break
            for tid in ['iron_skin','meditation']:
                selector=f'[data-talent="{tid}"]'
                if has_enabled(page,selector):page.locator(selector).click()
            click(page,'confirm-attributes')
        elif page.locator('[data-action="claim"]').count():
            page.locator('[data-action="claim"]').first.click()
        elif page.locator('[data-action="next-encounter"]').count():
            if not forged and has_enabled(page,'[data-action="forge-start"]'):
                click(page,'forge-start')
                click(page,'upgrade-face',item_id='item-2',face_index=0)
                forged=True
            elif not bought and has_enabled(page,'[data-action="buy"]'):
                page.locator('[data-action="buy"]').first.click();bought=True
            else:
                if has_enabled(page,'[data-action="shop-heal"]'):click(page,'shop-heal')
                click(page,'next-encounter')
        elif page.locator('[data-action="continue"]').count():
            click(page,'continue')
        elif page.locator('[data-action="lock"]').count():
            click(page,'lock')
        else:
            reacting=bool(page.locator('.incoming-panel').count())
            mids=['ward','block','dodge','catch_breath'] if reacting else ['heavy_strike','quick_strike','channel']
            selected=next((mid for mid in mids if select_maneuver(page,mid)),None)
            assert selected, 'No legal recovery/fallback maneuver'
            if selected not in ['channel','catch_breath']:
                if not reacting and 'Nimble Boots' in page.locator('.enemy-equipment').inner_text():support(page,'item-7')
                if not reacting:support(page,'item-8')
                support(page,'item-6')
            count=1+page.locator('[data-action="support"][aria-pressed="true"]').count()
            enemy_count=int(page.locator('.incoming-panel').get_attribute('data-dice-count')) if reacting else 0
            values=([0]*enemy_count+[.99]*count+[0]*12) if reacting else ([.99]*count+[0]*12)
            page.evaluate('(values)=>window.__testRng=values',values)
            click(page,'declare')
    assert 'rewritten' in page.locator('h1').inner_text(), f'Campaign did not finish in {steps} stages'
    assert levelups==3 and forged and bought
    page.screenshot(path=str(OUT/'campaign-victory.png'),full_page=True)
    assert_clean(page,errors,network)
    results.append({'test':'four-encounter-campaign','passed':True,'stages':steps,'levelups':levelups,'forge':forged,'purchase':bought,'navigation':navigation,'file_navigation_blocked':blocked,'javascript_errors':errors,'network_requests':network})
    context.close();browser.close()
(OUT/'browser-smoke.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(json.dumps(results,indent=2))
