---
name: e2e-testing
description: Load when writing end-to-end tests, setting up Playwright/Cypress, or asked about E2E testing strategy, test isolation, or CI integration for browser tests.
---

# E2E Testing

## E2E Test Scope

Test **critical user journeys only** — not every edge case (that's for unit/integration tests).

High-priority flows to cover:
- Authentication (sign in, sign out, session expiry)
- Core business flow (checkout, order creation, form submission)
- Onboarding / first-run experience
- Payment (happy path)

**Rule of thumb:** if a QA engineer would manually test it before every release, it belongs in E2E.

## Test Isolation

Each test must be self-contained:

```typescript
// playwright — use fixtures for setup/teardown
test.beforeEach(async ({ page, request }) => {
  // Create test data via API — faster and more reliable than UI setup
  const user = await request.post('/api/test/users', {
    data: { email: `test-${Date.now()}@example.com`, password: 'Test1234!' }
  });
  const { token } = await user.json();
  await page.context().addCookies([{ name: 'auth', value: token, domain: 'localhost' }]);
});

test.afterEach(async ({ request }, testInfo) => {
  // Teardown — clean up test data
  await request.delete('/api/test/users/me');
});
```

**Never share state between tests.** No shared user accounts, no shared cart, no shared database rows.

## Playwright Patterns

```typescript
// Page Object Model — encapsulate selectors and actions
class CheckoutPage {
  constructor(private page: Page) {}

  async fillShipping(address: Address) {
    await this.page.getByTestId('shipping-name').fill(address.name);
    await this.page.getByTestId('shipping-street').fill(address.street);
    await this.page.getByTestId('shipping-city').fill(address.city);
  }

  async submitOrder() {
    await this.page.getByTestId('place-order-button').click();
    await this.page.waitForURL('/orders/**');
  }

  get orderConfirmation() {
    return this.page.getByTestId('order-confirmation');
  }
}

// Fixtures — shared setup for test suite
test.describe('Checkout flow', () => {
  let checkoutPage: CheckoutPage;

  test.beforeEach(async ({ page }) => {
    checkoutPage = new CheckoutPage(page);
    await page.goto('/checkout');
  });

  test('completes order with valid address', async () => {
    await checkoutPage.fillShipping(testAddress);
    await checkoutPage.submitOrder();
    await expect(checkoutPage.orderConfirmation).toBeVisible();
  });
});
```

## Selector Strategy

```typescript
// GOOD — data-testid attributes, stable and intention-revealing
await page.getByTestId('submit-order-button').click();
await page.getByRole('button', { name: 'Place Order' }).click();
await page.getByLabel('Email address').fill('user@example.com');

// BAD — brittle selectors
await page.locator('.btn-primary.checkout-flow--step-2 > span').click(); // CSS class
await page.locator('button:nth-child(3)').click();  // position
await page.locator('text=Submit').click();           // text that gets translated/changed
```

Add `data-testid` to interactive elements during development — treat it as part of the feature contract.

## Async Handling

```typescript
// GOOD — use Playwright's built-in waiting
await page.getByTestId('save-button').click();
await expect(page.getByTestId('success-toast')).toBeVisible();

// BAD — arbitrary timeouts are a smell
await page.click('[data-testid="save-button"]');
await page.waitForTimeout(2000);  // never do this
```

## API Seeding

```typescript
// Seed test data via API — much faster than UI navigation
async function createTestOrder(request: APIRequestContext): Promise<Order> {
  const response = await request.post('/api/test/orders', {
    data: { items: [{ productId: 'prod-1', quantity: 2 }] },
    headers: { 'x-test-token': process.env.TEST_API_TOKEN! }
  });
  return response.json();
}
```

Expose a `/api/test/*` namespace (disabled in production) for seeding test data.

## CI Integration

```yaml
# .github/workflows/e2e.yml
e2e:
  runs-on: ubuntu-latest
  timeout-minutes: 20
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: '20', cache: 'npm' }
    - run: npm ci
    - run: npx playwright install --with-deps chromium
    - run: npm run build && npm run start:test &
    - run: npx playwright test --retries=1   # retry flaky tests once
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Testing every form validation via E2E | Slow, fragile, expensive | Unit test validations; E2E tests happy path only |
| Shared test users / shared DB rows | Tests interfere with each other | Per-test data, teardown after each test |
| `waitForTimeout(2000)` | Flaky, slow, arbitrary | Use `waitForSelector`, `waitForURL`, `expect(...).toBeVisible()` |
| Selecting by CSS class | Breaks on style refactor | `data-testid` or ARIA roles |
| Tests that only run locally | Not caught in CI | Run E2E in CI on every PR |
| No artifacts on failure | Can't debug CI failures | Upload screenshots/videos on failure |
