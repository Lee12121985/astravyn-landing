import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const EMAIL = process.env.TEST_EMAIL || `testuser+${Date.now()}@example.com`;
const PASSWORD = process.env.TEST_PASSWORD || 'Testpass123!';

function log(step) {
  console.log(`\n▶ ${step}`);
}

async function expectUrlContains(page, fragment, message) {
  await page.waitForURL((url) => url.toString().includes(fragment), { timeout: 15000 });
  console.log(`   ✓ ${message}`);
}

async function goToLanding(page) {
  log('Opening landing page');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#signIn', { timeout: 10000 });
}

async function signupFlow(page) {
  log('Starting signup flow');
  await goToLanding(page);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expectUrlContains(page, '/auth/signup.html', 'Signup page loaded');

  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expectUrlContains(page, '/auth/hub.html', 'Hub reached after signup');
  await page.waitForSelector('#userEmail', { timeout: 10000 });
  console.log(`   ✓ Signed up as ${EMAIL}`);
}

async function navigateAppsFromHub(page) {
  log('Navigating from hub to timesheet');
  await page.getByRole('link', { name: 'Timesheet' }).click();
  await expectUrlContains(page, '/timesheet', 'Timesheet opened');
  await page.waitForSelector('#logoutBtn', { timeout: 10000 });
  console.log('   ✓ Timesheet loaded');

  log('Logging out from timesheet');
  await page.locator('#logoutBtn').click();
  await expectUrlContains(page, '/landing/index.html', 'Returned to landing after logout');
}

async function loginFlow(page) {
  log('Starting login flow');
  await goToLanding(page);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expectUrlContains(page, '/auth/login.html', 'Login page loaded');

  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expectUrlContains(page, '/auth/hub.html', 'Hub reached after login');
  await page.waitForSelector('#userEmail', { timeout: 10000 });
  console.log(`   ✓ Logged in as ${EMAIL}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  try {
    await signupFlow(page);
    await navigateAppsFromHub(page);
    await loginFlow(page);
    await navigateAppsFromHub(page);
    console.log('\n✅ Auth + navigation test completed');
  } catch (err) {
    console.error('\n❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
