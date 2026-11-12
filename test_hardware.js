import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const screenshotDir = './test_screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function run() {
  const systemChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await puppeteer.launch({
    executablePath: fs.existsSync(systemChrome) ? systemChrome : undefined,
    headless: true,
    args: ['--allow-file-access-from-files', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err.message}`);
  });

  const fileUrl = `file:///${path.resolve('dist/MTOwizard.html').replace(/\\/g, '/')}`;
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // 1. Check if "+ Hardware" button is present
  console.log('1. Checking "+ Hardware" buttons...');
  const addButtons = await page.$$('button');
  let hardwareBtnFound = false;
  for (const b of addButtons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text.includes('Hardware')) {
      hardwareBtnFound = true;
      break;
    }
  }
  console.log('Hardware button found:', hardwareBtnFound);
  if (!hardwareBtnFound) throw new Error('Add Hardware button not found in DOM');

  // 2. Click "Add Hardware" to open modal
  console.log('2. Clicking "Add Hardware" to open modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('Add Hardware'));
    if (btn) btn.click();
  });

  await new Promise(r => setTimeout(r, 400));
  const modalTitle = await page.evaluate(() => document.getElementById('hardware-modal-title')?.textContent || '');
  console.log('Hardware modal opened with title:', modalTitle);
  if (!modalTitle.includes('Hardware')) throw new Error('Modal did not open');

  // 3. Fill out hardware form
  console.log('3. Filling out Hardware fields...');
  await page.type('#hw-name', 'Blum Clip Top Blumotion 110 Hinges');
  await page.click('#hw-qty', { clickCount: 3 });
  await page.keyboard.press('Backspace');
  await page.type('#hw-qty', '24');

  // Check pairs checkbox
  await page.evaluate(() => {
    const pairCb = document.querySelector('input[type="checkbox"][checked=""], input[type="checkbox"]:not([name])');
    const labels = Array.from(document.querySelectorAll('label'));
    const pairLabel = labels.find(l => l.textContent.includes('Pairs'));
    const cb = pairLabel ? pairLabel.querySelector('input') : null;
    if (cb && !cb.checked) cb.click();
  });

  await page.type('#hw-size', '1/2" Overlay');
  await page.type('#hw-color', 'Nickel');
  await page.type('#hw-url', 'https://www.blum.com/us/en/products/hingesystems/clip-top-blumotion/');

  // Set sample test image
  console.log('Setting image URL...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const urlBtn = btns.find(b => b.textContent.includes('image URL'));
    if (urlBtn) urlBtn.click();
  });
  await new Promise(r => setTimeout(r, 200));
  await page.type('input[placeholder="https://..."]', 'https://example.com/hinge.jpg');
  await page.evaluate(() => {
    const checkBtn = document.querySelector('input[placeholder="https://..."]')?.nextElementSibling;
    if (checkBtn) checkBtn.click();
  });

  await new Promise(r => setTimeout(r, 300));
  await page.screenshot({ path: path.join(screenshotDir, 'hw_1_modal_filled.png') });

  // 4. Submit form
  console.log('4. Submitting Hardware form...');
  await page.evaluate(() => {
    const form = document.querySelector('form');
    if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  await new Promise(r => setTimeout(r, 500));

  // 5. Verify the item appears under Additional Job Hardware
  console.log('5. Verifying item appears on MTO sheet...');
  const hardwareSectionText = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('section'));
    const hwSection = sections.find(s => s.textContent.includes('Additional Job Hardware'));
    return hwSection ? hwSection.innerText : '';
  });
  console.log('Section Text:', hardwareSectionText);

  if (!hardwareSectionText.includes('Blum Clip Top Blumotion 110 Hinges')) {
    throw new Error('Hardware item name not found in Additional Job Hardware section');
  }
  if (!hardwareSectionText.includes('[(24 PR)]')) {
    throw new Error('Hardware quantity [(24 PR)] not found in section');
  }
  if (!hardwareSectionText.includes('1/2" Overlay') || !hardwareSectionText.includes('Nickel')) {
    throw new Error('Hardware size or color not found in section');
  }

  // 6. Check that image is rendered
  const hasThumbnail = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('section img'));
    return imgs.length > 0;
  });
  console.log('Hardware thumbnail rendered:', hasThumbnail);
  if (!hasThumbnail) throw new Error('Hardware thumbnail image not rendered');

  // 7. Check that URL is rendered as hyperlink
  const hasLink = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('section a'));
    const blumLink = links.find(a => a.href.includes('blum.com'));
    return Boolean(blumLink);
  });
  console.log('Hardware name rendered as hyperlink:', hasLink);
  if (!hasLink) throw new Error('Hardware name not rendered as link');

  await page.screenshot({ path: path.join(screenshotDir, 'hw_2_section_rendered.png') });

  // 8. Test Load Demo button to verify Demo hardware is included
  console.log('8. Testing Load Demo with sample hardware...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const demoBtn = btns.find(b => b.textContent.includes('Load Demo') || b.title?.includes('Demo'));
    if (demoBtn) demoBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  const demoHwCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('section tbody tr');
    return rows.length;
  });
  console.log('Demo hardware rows loaded:', demoHwCount);

  await page.screenshot({ path: path.join(screenshotDir, 'hw_3_demo_loaded.png') });

  console.log('\n--- ALL HARDWARE TESTS PASSED SUCCESSFULLY! ---');
  await browser.close();
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
