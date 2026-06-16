import { By, WebDriver } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible, waitTextInPage, waitToast } from "../waits.js";

export class ProfilePage {
  constructor(private readonly driver: WebDriver) {}

  async goto(): Promise<void> {
    await this.driver.get(`${getAppUrl()}/profile`);
  }

  async title() {
    return waitVisible(this.driver, By.xpath(`//h1[contains(normalize-space(.), 'Профиль')]`));
  }

  async usernameField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Логин')]/following::input[1]`),
    );
  }

  async emailField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Email')]/following::input[1]`),
    );
  }

  async fullNameField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Полное имя')]/following::input[1]`),
    );
  }

  async saveProfileButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'Сохранить профиль')]`),
    );
  }

  async isSaveProfileDisabled(): Promise<boolean> {
    const btn = await this.saveProfileButton();
    const disabled = await btn.getAttribute("disabled");
    return disabled !== null;
  }

  async oldPasswordField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Текущий пароль')]/following::input[1]`),
    );
  }

  async newPasswordField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Новый пароль')]/following::input[1]`),
    );
  }

  async confirmPasswordField() {
    return waitVisible(
      this.driver,
      By.xpath(`//label[contains(normalize-space(.), 'Повторите новый пароль')]/following::input[1]`),
    );
  }

  async changePasswordButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'Изменить пароль')]`),
    );
  }

  async isChangePasswordDisabled(): Promise<boolean> {
    const btn = await this.changePasswordButton();
    const disabled = await btn.getAttribute("disabled");
    return disabled !== null;
  }

  async deleteAccountButton() {
    return waitVisible(
      this.driver,
      By.xpath(`//button[contains(normalize-space(.), 'Удалить аккаунт')]`),
    );
  }

  async successAlert(): Promise<string> {
    return waitToast(this.driver, "", 10_000);
  }

  async successToast(substring: string): Promise<string> {
    return waitToast(this.driver, substring, 10_000);
  }

  async errorAlert(): Promise<string> {
    const el = await waitVisible(this.driver, By.css(".MuiAlert-colorError .MuiAlert-message"), 8_000);
    return (await el.getText()).trim();
  }

  async hasErrorAlert(): Promise<boolean> {
    try {
      await waitVisible(this.driver, By.css(".MuiAlert-colorError .MuiAlert-message"), 8_000);
      return true;
    } catch {
      return false;
    }
  }

  async fillEmail(value: string): Promise<void> {
    const el = await this.emailField();
    await el.clear();
    await el.sendKeys(value);
  }

  async fillFullName(value: string): Promise<void> {
    const el = await this.fullNameField();
    await el.clear();
    await el.sendKeys(value);
  }

  async fillPasswordFields(old: string, next: string, confirm: string): Promise<void> {
    const oldEl = await this.oldPasswordField();
    await oldEl.clear();
    await oldEl.sendKeys(old);
    const newEl = await this.newPasswordField();
    await newEl.clear();
    await newEl.sendKeys(next);
    const confirmEl = await this.confirmPasswordField();
    await confirmEl.clear();
    await confirmEl.sendKeys(confirm);
  }
}
