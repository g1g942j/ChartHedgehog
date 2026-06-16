import { By, WebDriver } from "selenium-webdriver";
import { getAppUrl } from "../base-url.js";
import { waitVisible } from "../waits.js";

export class RegisterPage {
  constructor(private readonly driver: WebDriver) {}

  async goto(): Promise<void> {
    await this.driver.get(`${getAppUrl()}/register`);
  }

  async title(): Promise<string> {
    const el = await waitVisible(this.driver, By.xpath(`//h1[contains(normalize-space(.), "Регистрация")]`));
    return (await el.getText()).trim();
  }

  async usernameInput() {
    return waitVisible(this.driver, By.css("input[name='username']"));
  }

  async emailInput() {
    return waitVisible(this.driver, By.css("input[name='email']"));
  }

  async passwordInput() {
    return waitVisible(this.driver, By.css("input[name='password']"));
  }

  async confirmPasswordInput() {
    return waitVisible(this.driver, By.css("input[name='confirmPassword']"));
  }

  async fullNameInput() {
    return waitVisible(this.driver, By.css("input[name='fullName']"));
  }

  async submitButton() {
    return waitVisible(this.driver, By.xpath(`//button[@type='submit' and contains(normalize-space(.), 'Зарегистрироваться')]`));
  }

  async loginLink() {
    return waitVisible(this.driver, By.xpath(`//a[contains(normalize-space(.), 'Войти')]`));
  }

  async fieldErrors(): Promise<string[]> {
    await this.driver.sleep(500);
    const els = await this.driver.findElements(By.css("p.MuiFormHelperText-root.Mui-error"));
    return Promise.all(els.map((e) => e.getText().then((t) => t.trim())));
  }

  async alertMessage(): Promise<string> {
    const el = await waitVisible(this.driver, By.css(".MuiAlert-message"), 10_000);
    return (await el.getText()).trim();
  }

  async hasSuccessAlert(): Promise<boolean> {
    try {
      await waitVisible(this.driver, By.css(".MuiAlert-colorSuccess .MuiAlert-message"), 8_000);
      return true;
    } catch {
      return false;
    }
  }

  async hasErrorAlert(): Promise<boolean> {
    try {
      await waitVisible(this.driver, By.css(".MuiAlert-colorError .MuiAlert-message"), 8_000);
      return true;
    } catch {
      return false;
    }
  }

  async fill(data: {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
  }): Promise<void> {
    if (data.username !== undefined) {
      const el = await this.usernameInput();
      await el.clear();
      await el.sendKeys(data.username);
    }
    if (data.email !== undefined) {
      const el = await this.emailInput();
      await el.clear();
      await el.sendKeys(data.email);
    }
    if (data.password !== undefined) {
      const el = await this.passwordInput();
      await el.clear();
      await el.sendKeys(data.password);
    }
    if (data.confirmPassword !== undefined) {
      const el = await this.confirmPasswordInput();
      await el.clear();
      await el.sendKeys(data.confirmPassword);
    }
    if (data.fullName !== undefined) {
      const el = await this.fullNameInput();
      await el.clear();
      await el.sendKeys(data.fullName);
    }
  }

  async submit(): Promise<void> {
    await this.driver.executeScript(
      "document.querySelectorAll('form').forEach(f => { f.noValidate = true; });",
    );
    await (await this.submitButton()).click();
    await this.driver.sleep(300);
  }
}
