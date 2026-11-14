"""Browser integration smoke tests and screenshot capture; service must be running."""
from pathlib import Path
import json,shutil,sys,re,httpx
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'benchmarks';screens=ROOT/'docs/figures'
errors=[];checks=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=shutil.which('chromium'),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1512,'height':1120},device_scale_factor=1)
    page.on('pageerror',lambda e:errors.append(str(e)))
    if '--bridge' in sys.argv:
        # Test-only transport: managed browser blocks navigation. Python calls the real
        # loopback API; UI DOM, JS, interaction and rendering run unmodified in Chromium.
        def bridge(url, opts):
            if not url.startswith('/api/v1/'): raise ValueError('Unexpected test URL')
            r=httpx.request(opts.get('method','GET'),'http://127.0.0.1:8765'+url,
                            headers=opts.get('headers',{}),content=opts.get('body'),timeout=60)
            return {'body':r.text,'status':r.status_code}
        page.expose_function('localApiBridge',bridge)
        page.set_content(re.sub(r'<link[^>]+>|<script[^>]+></script>','',(ROOT/'src/convolvex/web/index.html').read_text()))
        page.add_style_tag(content=(ROOT/'src/convolvex/web/styles.css').read_text())
        page.evaluate("() => {window.fetch=async (url,opts={})=>{const r=await localApiBridge(url,opts);return new Response(r.body,{status:r.status,headers:{'Content-Type':'application/json'}})}}")
        page.add_script_tag(content=(ROOT/'src/convolvex/web/app.js').read_text())
    else:
        page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
    page.wait_for_function("document.querySelector('#fileName').textContent==='signal.json'")
    page.click('#runButton');page.wait_for_function("document.querySelector('#footerStatus').textContent==='COMPLETED'",timeout=45000)
    checks.append({'name':'signal calculation','status':page.locator('#statusMetric').inner_text()})
    page.screenshot(path=str(screens/'frontend_desktop.png'),full_page=True)
    page.select_option('#demo','dems');page.click('#loadDemo');page.wait_for_timeout(200);page.click('#runButton')
    page.wait_for_function("document.querySelector('#footerStatus').textContent==='COMPLETED'",timeout=45000)
    checks.append({'name':'multichannel calculation','channels':page.locator('#channel option').count()})
    page.select_option('#channel','2');page.select_option('#sourceChannel','1')
    page.click('#editProject');page.wait_for_selector('#editor[open]');page.click('#applyEditor');checks.append({'name':'JSON editor','passed':not page.locator('#editor').is_visible()})
    page.click('[data-view="records"]');page.wait_for_timeout(250);checks.append({'name':'job records','rows':page.locator('#recordsTable tbody tr').count()})
    page.click('[data-view="workspace"]');page.select_option('#demo','image');page.click('#loadDemo');page.wait_for_timeout(150);page.click('#runButton')
    page.wait_for_function("document.querySelector('#footerStatus').textContent==='COMPLETED'",timeout=45000)
    checks.append({'name':'image calculation','canvas_count':page.locator('canvas').count()})
    page.select_option('#imageLayer','predicted');page.select_option('#sourceLayer','truth')
    scales=page.locator('.heat-scale').count();pixel=page.locator('#sourcePlot canvas').bounding_box()
    page.mouse.move(pixel['x']+pixel['width']/2,pixel['y']+pixel['height']/2)
    checks.append({'name':'image comparison and scale','scales':scales,'hover':page.locator('#sourcePlot .tooltip').inner_text(),'legend':page.locator('#observedLegend').inner_text()})
    assert scales==3 and '重构' in page.locator('#observedLegend').inner_text()
    page.select_option('#imageLayer','observed');page.select_option('#sourceLayer','estimate');page.mouse.move(10,10)
    page.screenshot(path=str(screens/'frontend_image.png'),full_page=True)
    page.select_option('#demo','volume');page.click('#loadDemo');page.wait_for_timeout(200);page.click('#runButton')
    page.wait_for_function("document.querySelector('#footerStatus').textContent==='COMPLETED'",timeout=45000)
    page.select_option('#channel','12');page.select_option('#sourceChannel','12')
    checks.append({'name':'volume calculation','slices':page.locator('#sourceChannel option').count()})
    page.screenshot(path=str(screens/'frontend_volume.png'),full_page=True)
    page.select_option('#demo','signal');page.click('#loadDemo');page.wait_for_timeout(150);page.click('#runButton')
    page.wait_for_function("document.querySelector('#footerStatus').textContent==='COMPLETED'",timeout=45000)
    with page.expect_download() as d:page.click('#exportResult')
    checks.append({'name':'result download','filename':d.value.suggested_filename})
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(250)
    checks.append({'name':'mobile overflow','pixels':page.evaluate('document.documentElement.scrollWidth-window.innerWidth')})
    page.screenshot(path=str(screens/'frontend_mobile.png'),full_page=True)
    browser.close()
result={'checks':checks,'browser_errors':errors,'transport':'Python loopback HTTP bridge (managed Chromium navigation disabled)' if '--bridge' in sys.argv else 'direct browser HTTP'};(out/'ui_smoke.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,indent=2,ensure_ascii=False))
if errors or any(c.get('pixels',0)>0 for c in checks):raise SystemExit(1)
