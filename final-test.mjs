import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[ERROR] ${msg.text().substring(0, 80)}`);
  });

  console.log('🌐 Loading SPX on port 1420...');
  await page.goto('http://localhost:1420', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  
  console.log('✅ Page loaded');
  console.log('📄 Title:', await page.title());
  
  const content = await page.evaluate(() => document.body.innerText);
  console.log('\n📝 Content:\n', content.substring(0, 400));
  
  // Check if authenticated
  const isAuthed = !content.includes('Connect with Spotify');
  console.log('\n🔐 Authenticated:', isAuthed ? '✅' : '⚠️ Needs OAuth');
  
  await page.screenshot({ path: 'spx-port1420.png', fullPage: true });
  console.log('\n📸 Screenshot: spx-port1420.png');
  
  await browser.close();
})();
