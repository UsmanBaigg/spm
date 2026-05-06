import { chromium } from 'playwright';

describe('User Journey Tests', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('Complete rating and review flow', async () => {
    // Navigate to user profile
    await page.goto('http://localhost:5173/users/1');
    
    // Check user profile loads
    await expect(page.locator('h1')).toContainText('User Profile');
    
    // Click "Write a Review" button
    await page.click('button:has-text("Write a Review")');
    
    // Fill out review form
    await page.click('[data-testid="rating-star-5"]');
    await page.fill('textarea[name="comment"]', 'Excellent user! Very professional and responsive.');
    
    // Submit review
    await page.click('button:has-text("Submit Review")');
    
    // Verify review appears in list
    await expect(page.locator('text=Excellent user!')).toBeVisible();
    
    // Check trust score updated
    await page.reload();
    await expect(page.locator('[data-testid="trust-score"]')).toBeVisible();
  });

  test('Service rating flow', async () => {
    await page.goto('http://localhost:5173/services/1');
    
    // Verify service page loads
    await expect(page.locator('h1')).toContainText('Service Detail');
    
    // Add rating
    await page.click('[data-testid="rating-star-4"]');
    
    // Verify rating summary updates
    await expect(page.locator('[data-testid="rating-summary"]')).toBeVisible();
  });

  test('Marketplace item flow', async () => {
    await page.goto('http://localhost:5173/marketplace/1');
    
    // Verify marketplace page loads
    await expect(page.locator('h1')).toContainText('Marketplace Item');
    
    // Check existing ratings
    await expect(page.locator('[data-testid="reviews-list"]')).toBeVisible();
  });
});
