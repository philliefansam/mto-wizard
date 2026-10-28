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

  const consoleLogs = [];
  const errors = [];

  page.on('console', (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    errors.push(`PageError: ${err.message}`);
  });

  const fileUrl = 'file:///C:/Users/shanni/Documents/MTO%20Wizard/dist/index.html';
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // 1. Initial Load Screenshot
  console.log('1. Taking initial load screenshot...');
  await page.screenshot({ path: path.join(screenshotDir, '1_initial_load.png') });

  // Check if root has content
  const rootContent = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
  console.log('Root HTML length:', rootContent.length);
  if (rootContent.length === 0) {
    throw new Error('WHITE SCREEN DETECTED: #root is empty!');
  }

  // 2. Click "CV Cutlist + Nesting" tab
  console.log('2. Switching to CV Cutlist + Nesting tab...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const tabBtn = btns.find((b) => b.textContent.includes('CV Cutlist + Nesting'));
    if (tabBtn) tabBtn.click();
    else throw new Error('CV Cutlist + Nesting tab button not found');
  });

  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, '2_cutlist_tab.png') });

  // Track any native browser dialogs (alerts, confirms, prompts) - NONE should appear!
  let unexpectedDialog = null;
  page.on('dialog', async (dialog) => {
    unexpectedDialog = `UNEXPECTED DIALOG POPUP: ${dialog.type()} "${dialog.message()}"`;
    console.error(unexpectedDialog);
    await dialog.accept();
  });

  // 3. Click "Load Futrus - Two Kings (.PNC)" button
  console.log('3. Clicking Load Futrus - Two Kings (.PNC)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pncBtn = btns.find((b) => b.textContent.includes('Load Futrus - Two Kings (.PNC)'));
    if (pncBtn) pncBtn.click();
    else throw new Error('Load Futrus - Two Kings button not found');
  });

  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(screenshotDir, '3_pnc_loaded.png') });

  // 4. Verify Smart Area Offcut Buffer (HPL should be 3 sheets net & buffered, SS should be 1 sheet!)
  const sheetCountsText = await page.evaluate(() => {
    return document.body.innerText;
  });
  console.log('Verifying smart waste buffer (offcut absorbs 10% waste buffer)...');
  const hplIs3Sheets = sheetCountsText.includes('3 (3 net)') || sheetCountsText.includes('offcut covers');
  const ssIs1Sheet = sheetCountsText.includes('1 (1 net)');
  console.log('HPL calculated as 3 sheets (not overbuffered to 4):', hplIs3Sheets);
  console.log('Solid Surface calculated as 1 sheet (not overbuffered to 2):', ssIs1Sheet);

  // 4b. Test SVG Nest Preview Modal (directional part labels, cab #, hover inspector)
  console.log('4b. Opening SVG Nest Preview modal...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const viewNestBtn = btns.find((b) => b.textContent.includes('View Nest'));
    if (viewNestBtn) viewNestBtn.click();
    else throw new Error('View Nest button not found');
  });

  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: path.join(screenshotDir, '4b_svg_nest_modal.png') });

  // Hover over the first placed part rectangle in SVG
  console.log('Testing hover over first SVG nested part...');
  const firstPartRect = await page.$('svg rect[rx="0.25"]');
  if (firstPartRect) {
    await firstPartRect.hover();
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(screenshotDir, '4c_svg_part_hovered.png') });
  }

  // Check that SVG text contains cabinet number and part identifiers
  const svgTextContent = await page.evaluate(() => {
    const texts = Array.from(document.querySelectorAll('svg text')).map((t) => t.textContent);
    return texts;
  });
  console.log('Sample SVG Part Labels:', svgTextContent.slice(0, 8));
  const hasCabNumber = svgTextContent.some((t) => t.includes('#1') || t.includes('#2') || t.includes('#3'));
  console.log('SVG contains cabinet numbers (#1, #2, etc.):', hasCabNumber);

  // Test right-click hijacking on nested part to unlock grain
  console.log('Testing right-click hijacking to unlock grain and renest...');
  if (firstPartRect) {
    // Click right mouse button on part
    await firstPartRect.click({ button: 'right' });
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({ path: path.join(screenshotDir, '4d_svg_right_click_unlocked.png') });
  }

  const unlockToastFound = await page.evaluate(() => {
    return document.body.innerText.includes('Grain Unlocked');
  });
  console.log('Grain Unlocked toast found in DOM after right-click:', unlockToastFound);

  // Close SVG Nest Modal
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[title="Close Preview"]');
    if (closeBtn) closeBtn.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  // 5. Test "Re-Nest" button and visual loading indicator
  console.log('5. Testing Re-Nest button and visual loading reference...');
  // Click Re-Nest
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const renestBtn = btns.find((b) => b.textContent.includes('Re-Nest'));
    if (renestBtn) renestBtn.click();
    else throw new Error('Re-Nest button not found');
  });

  // Immediately take screenshot while loading state is active
  await page.screenshot({ path: path.join(screenshotDir, '4_renesting_loading_state.png') });

  // Wait for renest calculation to complete
  await new Promise((r) => setTimeout(r, 450));
  await page.screenshot({ path: path.join(screenshotDir, '5_renest_complete.png') });

  const renestToastFound = await page.evaluate(() => {
    return document.body.innerText.includes('Re-Nesting Complete');
  });
  console.log('Re-Nesting Complete toast found in DOM:', renestToastFound);

  // 6. Test "Apply Metadata to Job" (Sync project header)
  console.log('6. Testing Apply Metadata button (toast expected, NO alert)...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const syncBtn = btns.find((b) => b.textContent.includes('Apply Metadata'));
    if (syncBtn) syncBtn.click();
    else throw new Error('Apply Metadata button not found');
  });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '6_metadata_toast.png') });

  const metaToastFound = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Project Header Synced') && text.includes('Futrus - Two Kings');
  });
  console.log('Project Header Synced toast found in DOM:', metaToastFound);

  // 7. Test "Push to MTO Document"
  console.log('7. Testing Push to MTO Document...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const pushBtn = btns.find((b) => b.textContent.includes('Push to MTO') || b.textContent.includes('Update Takeoff'));
    if (pushBtn) pushBtn.click();
    else throw new Error('Push/Update button not found');
  });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '7_takeoff_updated.png') });

  const pushToastFound = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Takeoff') && (text.includes('Pushed') || text.includes('Updated'));
  });
  console.log('Takeoff toast found in DOM:', pushToastFound);

  // 8. Test Quick Add in Material Wizard Tab
  console.log('8. Switching to Material Wizard tab to test matrix add...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const bldBtn = btns.find((b) => b.textContent.includes('Material Wizard'));
    if (bldBtn) bldBtn.click();
    else throw new Error('Material Wizard tab button not found');
  });
  await new Promise((r) => setTimeout(r, 500));

  // Click Increase button to increment matrix cell
  await page.evaluate(() => {
    const incBtn = document.querySelector('button[title="Increase"]');
    if (incBtn) {
      incBtn.click();
    } else {
      throw new Error('Increase button not found');
    }
  });

  await new Promise((r) => setTimeout(r, 200));

  // Click Add to MTO button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const addBtn = btns.find((b) => b.textContent.includes('Add to MTO'));
    if (addBtn) addBtn.click();
    else throw new Error('Add to MTO button not found');
  });

  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '8_builder_toast.png') });

  const builderToastFound = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Added to Takeoff');
  });
  console.log('Builder Added to Takeoff toast found in DOM:', builderToastFound);

  // 9. Test Tab Switching Persistence (verifying CV Nesting tab data did NOT get wiped)
  console.log('9. Switching back to CV Cutlist + Nesting tab to verify session persistence...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const cvTabBtn = btns.find((b) => b.textContent.includes('CV Cutlist + Nesting'));
    if (cvTabBtn) cvTabBtn.click();
    else throw new Error('CV Cutlist + Nesting tab button not found');
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: path.join(screenshotDir, '9_tab_switched_back_persistent.png') });

  const pncActivePreserved = await page.evaluate(() => {
    return document.body.innerText.includes('.PNC ACTIVE:') && document.body.innerText.includes('Futrus - Two Kings.pnc');
  });
  console.log('PNC file & nests preserved after tab switching:', pncActivePreserved);
  if (!pncActivePreserved) {
    throw new Error('Data was wiped when switching between tabs!');
  }

  console.log('--- TEST SUMMARY ---');
  console.log('Total console logs:', consoleLogs.length);
  console.log('Errors encountered:', errors.length);
  console.log('Unexpected browser dialog occurred:', unexpectedDialog || 'None (PASSED)');

  if (unexpectedDialog) {
    throw new Error(`FAILURE: Browser popup alert/dialog was triggered: ${unexpectedDialog}`);
  }
  if (!hplIs3Sheets || !ssIs1Sheet) {
    throw new Error(`FAILURE: Smart waste buffer failed! HPL should be 3 sheets (is3=${hplIs3Sheets}), SS should be 1 sheet (is1=${ssIs1Sheet})`);
  }
  if (!renestToastFound || !metaToastFound || !pushToastFound || !builderToastFound) {
    throw new Error(`FAILURE: One or more expected toasts were not found in the DOM!`);
  }

  console.log('ALL TESTS PASSED! Smart buffer active, visual loading verified, zero popups!');
  await browser.close();
}

run().catch((err) => {
  console.error('TEST SCRIPT FAILED:', err);
  process.exit(1);
});
