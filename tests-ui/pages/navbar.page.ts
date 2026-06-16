import { By, WebDriver } from "selenium-webdriver";
import { waitVisible } from "../waits.js";

export class NavbarPage {
  constructor(private readonly driver: WebDriver) {}

  async brandLink() {
    return waitVisible(this.driver, By.xpath(`//a[contains(normalize-space(.), 'ChartHedgehog')]`));
  }

  async diagramsNavLink() {
    return waitVisible(
      this.driver,
      By.xpath(`//nav//a[contains(normalize-space(.), 'Мои диаграммы')]`),
    );
  }

  async themeToggleButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[@aria-label]`),
    );
  }

  async userMenuButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(@class, 'UserButton') or .//svg[contains(@class, 'KeyboardArrowDown')]]`),
    );
  }

  async openUserMenu(): Promise<void> {
    await (await this.userMenuButton()).click();
    await waitVisible(this.driver, By.css(".MuiMenu-paper"), 5_000);
  }

  async profileMenuItem() {
    return waitVisible(
      this.driver,
      By.xpath(`//li[contains(normalize-space(.), 'Профиль')]`),
    );
  }

  async logoutMenuItem() {
    return waitVisible(
      this.driver,
      By.xpath(`//li[contains(normalize-space(.), 'Выйти')]`),
    );
  }

  async currentThemeAriaLabel(): Promise<string> {
    const btn = await waitVisible(
      this.driver,
      By.xpath(`//button[@aria-label[contains(., 'тему') or contains(., 'тема')]]`),
    );
    return (await btn.getAttribute("aria-label")) ?? "";
  }

  async clickThemeToggle(): Promise<void> {
    const btn = await this.themeToggleButton();
    await btn.click();
    await this.driver.sleep(300);
  }

  async languageSwitcher() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'EN') or contains(normalize-space(.), 'RU') or contains(normalize-space(.), 'Русский') or contains(normalize-space(.), 'English')]`),
    );
  }
}
