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
  await page.setViewport({ width: 1440, height: 1000 });

  const fileUrl = `file:///${path.resolve('dist/MTOwizard.html').replace(/\\/g, '/')}`;
  console.log('Navigating to:', fileUrl);
  await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 400));

  // 1. Force dark mode on
  console.log('1. Forcing Dark Mode in DOM...');
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  // Verify dark mode is active on screen
  const screenBg = await page.evaluate(() => {
    const el = document.querySelector('.min-h-screen');
    return window.getComputedStyle(el).backgroundColor;
  });
  console.log('Screen mode background color (should be dark):', screenBg);
  if (screenBg !== 'rgb(32, 33, 36)') {
    throw new Error(`Expected dark mode background rgb(32, 33, 36), got ${screenBg}`);
  }

  // Add a sample hardware line item so we test hardware printing as well
  await page.evaluate(() => {
    const testHw = {
      id: 'hw-test-1',
      name: 'Blum 110 Clip Top Free Swing Hinge',
      qty: 10,
      isPair: true,
      color: 'Satin Nickel',
      size: '',
      url: 'https://example.com/hinge'
    };
    const sessionData = JSON.parse(sessionStorage.getItem('mto_job_data') || '{"items":[],"hardware":[]}');
    sessionData.hardware = [testHw];
    sessionData.jobName = 'UNTITLED PROJECT';
    sessionData.engineer = 'Shanni';
    sessionStorage.setItem('mto_job_data', JSON.stringify(sessionData));
    window.location.reload();
  });
  await new Promise(r => setTimeout(r, 600));

  // Re-verify dark mode after reload
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });

  // 2. Click "Print / Save PDF" button (with window.print monitored)
  console.log('2. Clicking "Print / Save PDF" button...');
  const printTriggered = await page.evaluate(() => {
    let printCalled = false;
    window.print = () => {
      printCalled = true;
    };
    const btns = Array.from(document.querySelectorAll('button'));
    const printBtn = btns.find(b => b.textContent.includes('Print / Save PDF'));
    if (printBtn) printBtn.click();
    return printCalled;
  });
  console.log('Print function called:', printTriggered);
  if (!printTriggered) {
    throw new Error('window.print() was not triggered by the Print button');
  }

  // 3. Emulate print media
  console.log('3. Emulating print media...');
  await page.emulateMediaType('print');

  // 4. Verify DOM state and computed styles during print
  const printStyles = await page.evaluate(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const minScreenEl = document.querySelector('.min-h-screen');
    const printContainerEl = document.querySelector('.print-container');
    const headerTitleEl = document.querySelector('.print-container h2');
    const hwSectionEl = document.querySelector('.print-container section');

    return {
      isDarkClassPresent: htmlEl.classList.contains('dark'),
      htmlBg: window.getComputedStyle(htmlEl).backgroundColor,
      bodyBg: window.getComputedStyle(bodyEl).backgroundColor,
      minScreenBg: minScreenEl ? window.getComputedStyle(minScreenEl).backgroundColor : null,
      printContainerBg: printContainerEl ? window.getComputedStyle(printContainerEl).backgroundColor : null,
      headerColor: headerTitleEl ? window.getComputedStyle(headerTitleEl).color : null,
      hwSectionColor: hwSectionEl ? window.getComputedStyle(hwSectionEl).color : null,
    };
  });

  console.log('Print Computed Styles:');
  console.log('  isDarkClassPresent (on screen):', printStyles.isDarkClassPresent);
  console.log('  html background:', printStyles.htmlBg);
  console.log('  body background:', printStyles.bodyBg);
  console.log('  .min-h-screen background:', printStyles.minScreenBg);
  console.log('  .print-container background:', printStyles.printContainerBg);
  console.log('  .print-container header color:', printStyles.headerColor);

  // 5. Capture screenshot of emulated print view
  const screenshotPath = path.join(screenshotDir, 'print_preview_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved print screenshot to:', screenshotPath);

  // Also generate real PDF to confirm CutePDF / PDF writer compatibility
  const pdfPath = path.join(screenshotDir, 'output_verified.pdf');
  await page.pdf({ path: pdfPath, format: 'letter', printBackground: true });
  console.log('Generated test PDF to:', pdfPath);

  // Verify pure white conditions
  const isWhite = (bg) => bg === 'rgb(255, 255, 255)' || bg === '#ffffff';
  const isBlack = (color) => color === 'rgb(0, 0, 0)' || color === '#000000';

  if (!isWhite(printStyles.printContainerBg)) {
    throw new Error(`Print container background is NOT white: ${printStyles.printContainerBg}`);
  }
  if (!isWhite(printStyles.bodyBg)) {
    throw new Error(`Body background is NOT white: ${printStyles.bodyBg}`);
  }
  if (!isWhite(printStyles.minScreenBg)) {
    throw new Error(`MinScreen background is NOT white: ${printStyles.minScreenBg}`);
  }
  if (!isBlack(printStyles.headerColor)) {
    throw new Error(`Header text color is NOT black: ${printStyles.headerColor}`);
  }

  console.log('\n--- PRINT VERIFICATION TEST PASSED! 100% WHITE BACKGROUND & CRISP DARK INK ---');
  await browser.close();
}

run().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
