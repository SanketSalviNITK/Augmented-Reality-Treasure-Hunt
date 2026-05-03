const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Emulate an iPhone 13 Pro
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  console.log('Navigating to Admin Dashboard...');
  // Assuming the server is running on localhost:3000
  await page.goto('http://localhost:3000/admin.html', { waitUntil: 'networkidle2' });
  
  // Wait a second for Supabase data to potentially load
  await new Promise(r => setTimeout(r, 2000));

  const dashboardPath = path.resolve(__dirname, '../paper/figures/dashboard.png');
  await page.screenshot({ path: dashboardPath });
  console.log(`Saved: ${dashboardPath}`);

  // Try to click into an event if one exists to get the Live Monitor view
  try {
    console.log('Attempting to open an event monitor...');
    await page.click('.event-card button:first-of-type'); // Clicks the 'Monitor Event' button
    await new Promise(r => setTimeout(r, 2000));
    
    const monitorPath = path.resolve(__dirname, '../paper/figures/monitor.png');
    await page.screenshot({ path: monitorPath });
    console.log(`Saved: ${monitorPath}`);
  } catch (e) {
    console.log('No events found to monitor, skipping monitor screenshot.');
  }

  await browser.close();
  console.log('Done!');
})();
