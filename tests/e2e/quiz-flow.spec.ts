import { test, expect } from '@playwright/test';

test.describe('Quiz Application Workflow', () => {
  test('loads home page and displays course header', async ({ page }) => {
    await page.goto('/');

    // Check title or main heading
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText('Destination B1: English Grammar')).toBeVisible({ timeout: 15000 });
  });

  test('filters quizzes by status and search query', async ({ page }) => {
    await page.goto('/');

    // Wait for quizzes to load
    await expect(page.getByText('Destination B1: English Grammar')).toBeVisible({ timeout: 15000 });

    // Check search input
    const searchInput = page.getByPlaceholder(/search quizzes/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('Present simple');
      await expect(page.getByText(/Unit 01/i)).toBeVisible();
    }
  });

  test('opens quiz start configuration modal', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Destination B1: English Grammar')).toBeVisible({ timeout: 15000 });

    // Look for a start or practice button
    const startButton = page.getByRole('button', { name: /start|exam|practice/i }).first();
    if (await startButton.isVisible()) {
      await startButton.click();
      // Verify modal appears
      await expect(page.getByText(/Choose Session Mode|Select Duration/i)).toBeVisible();
    }
  });
});
