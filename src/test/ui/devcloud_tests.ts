/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ComboSetting, InputBox, ModalDialog, Notification, NotificationType, Setting, SettingsEditor, StatusBar, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { existsSync, readFileSync, renameSync, rmSync, } from 'fs';
import { join } from 'path/win32';

const cygwinDefaultPath = join('C:', 'cygwin64');
const sshFolderCyg = join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`);
const sshFolderWin = join(`${process.env.USERPROFILE}`, `.ssh`);

const sshConfigDefaultPath = join(sshFolderCyg, `config`);

describe('Intel DevCloud connector basic tests', () => {
  let browser: VSBrowser;
  let driver: WebDriver;
  let workbench: Workbench;

  before(async () => {
    browser = VSBrowser.instance;
    driver = browser.driver;
    workbench = new Workbench();
  });

  describe('Extension settings', () => {
    let settings: SettingsEditor;

    before(async () => {
      settings = await workbench.openSettings();
      driver.sleep(1000);
    });

    describe('Choose cluster', () => {
      it("Choose_cluster setting available and contains three options", async function () {
        const setting = await settings.findSetting('Choose_cluster', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector') as ComboSetting;
        const value = await setting.getValues();
        expect(value.length).eq(3);
      });
    });

    describe('Connection_timeout', () => {
      it("Connection_timeout setting available and has default value 30", async function () {
        const setting = await settings.findSetting('Connection_timeout', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        const value = await setting.getValue();
        expect(value).eq('30');
      });
    });

    describe('Cygwin_path', () => {
      let setting: Setting;

      before(async () => {
        setting = await settings.findSetting('Cygwin_path', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
      });
      it("Cygwin_path setting available and has default value 'C:/cygwin64'", async function () {
        const value = await setting.getValue();
        expect(value).eq('C:/cygwin64');
      });
      it("Dialog box pops up if Cygwin_path is invalid", async function () {
        await setting.setValue('invalid string');
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("Cancel");
          await driver.sleep(1000);
          return res;
        }, 10000);
        expect(message.indexOf('Path to the Cygwin folder specified in the extension settings is invalid.')).greaterThanOrEqual(0);
      });
      after(async () => {
        const setting = await settings.findSetting('Cygwin_path', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await setting.setValue('C:/cygwin64');
      });
    });

    describe('Session_timeout', () => {
      let setting: Setting;

      before(async () => {
        setting = await settings.findSetting('Session_timeout', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
      });

      it("Error message if invalid session timeout format", async function () {
        await setting.setValue('invalid string');
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);

        expect(message.indexOf('Use the following format: hh:mm:ss')).greaterThanOrEqual(0);
      });

      it("Error message if 'hh' is not a number", async function () {
        await setting.setValue("aa:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("Invalid session timeout value. hh,mm,ss must be positive integers")).greaterThanOrEqual(0);
      });

      it("Error message if 'hh' is negative number", async function () {
        await setting.setValue("-10:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if 'hh' is greater than 24", async function () {
        await setting.setValue("25:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if 'mm' is not a number", async function () {
        await setting.setValue("00:aa:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("Invalid session timeout value. hh,mm,ss must be positive integers")).greaterThanOrEqual(0);
      });

      it("Error message if 'mm' is negative number", async function () {
        await setting.setValue("00:-10:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if 'mm' is greater than 59", async function () {
        await setting.setValue("00:65:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if 'ss' is not a number", async function () {
        await setting.setValue("00:00:aa");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("Invalid session timeout value. hh,mm,ss must be positive integers")).greaterThanOrEqual(0);
      });

      it("Error message if 'ss' is negative number", async function () {
        await setting.setValue("00:00:-10");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if 'ss' is greater than 59", async function () {
        await setting.setValue("00:00:65");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("where ss and mm take values from 0 to 59, and hh from 0 to 24")).greaterThanOrEqual(0);
      });

      it("Error message if time out value is greater than 24h", async function () {
        await setting.setValue("24:00:1");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("Max time is 24h, so the only valid entry for hh = 24 is 24:00:00")).greaterThanOrEqual(0);
      });

      after(async () => {
        await setting.setValue('06:00:00');
      });
    });

    describe('Proxy', () => {
      let proxy: Setting;
      let proxyServer: Setting;

      before(async () => {
        proxy = await settings.findSetting('Proxy', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await proxy.setValue(true);
        proxyServer = await settings.findSetting('Proxy_server', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await proxyServer.setValue("");
      });

      it("Error message if proxy enabled but the Proxy_server is not specified", async function () {
        await workbench.executeCommand('Intel DevCloud: Setup connection');
        await driver.sleep(1000);
        const message = await driver.wait(async () => {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("OK");
          return res;
        }, 10000);
        expect(message.indexOf("You have the Proxy option enabled")).greaterThanOrEqual(0);
      });

      after(async () => {
        proxy = await settings.findSetting('Proxy', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await proxy.setValue(false);
        proxyServer = await settings.findSetting('Proxy_server', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await proxyServer.setValue("");
      });
    });
  });

  describe('Commands are available', () => {
    it('Contain "Close connection" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel DevCloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel DevCloud: Close connection");
      expect(picks).not.undefined;
    });

    it('Contain "Setup connection" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel DevCloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel DevCloud: Setup connection");
      expect(picks).not.undefined;
    });

    it('Contain "Get help" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel DevCloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel DevCloud: Get help");
      expect(picks).not.undefined;
    });

    it('Contain "New DevCloud terminal" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel DevCloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel DevCloud: New Intel DevCloud terminal");
      expect(picks).not.undefined;
    });
  });

  describe("No connection", () => {
    it('"Close connection" shows message about no connection', async function () {
      await workbench.executeCommand('Intel DevCloud: Close connection');
      const notification = await driver.wait(async () => {
        return await getNotifications('There is no active connection to Intel DevCloud');
      }, 10000) as Notification;
      expect(await notification.getType()).equals(NotificationType.Info);
    });

    it('"Create terminal" shows message about no connection', async function () {
      await workbench.executeCommand('Intel DevCloud: New Intel DevCloud terminal');
      const notification = await driver.wait(async () => {
        return await getNotifications('There is no active connection to Intel DevCloud');
      }, 10000) as Notification;
      expect(await notification.getType()).equals(NotificationType.Error);
    });

    it('There is a status bar with "Not connected to Intel DevCloud" text', async function () {
      const statusbar = new StatusBar();

      //StatusBar.getItem() find status bar item by title
      //The title attribute represents the text + the tooltip of the status bar element
      //This may be changed in the future
      const devcloudStatusBar = await statusbar.getItem('Not connected to Intel DevCloud, Intel DevCloud connection status');
      expect(devcloudStatusBar).not.undefined;
    });

    afterEach(async function () {
      const center = await new Workbench().openNotificationsCenter();
      await center.clearAllNotifications();
    });
  });

  describe('SSH', () => {
    const accessScriptPath = join(process.cwd(), 'src', 'test', 'ui', 'assets', 'setup-devcloud-access.txt');
    const tmpSshFolderWin = join(`${process.env.USERPROFILE}`, `.ssh-tmp`);
    const tmpSshFolderCyg = join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh-tmp`);

    before(async function () {
      if (existsSync(sshFolderWin)) {
        renameSync(sshFolderWin, tmpSshFolderWin);
      } if (existsSync(sshFolderCyg)) {
        renameSync(sshFolderCyg, tmpSshFolderCyg);
      }
    });

    it('Prompt to provide access script', async function () {
      await workbench.executeCommand('Intel DevCloud: Setup connection');
      await driver.sleep(1000);
      const message = await driver.wait(async () => {
        try {
          const dialog = new ModalDialog();
          const res = await dialog.getText();
          await dialog.pushButton("Cancel");
          return res;
        }
        catch (e) { }
      }, 10000);
      if (!message) {
        chai.assert.fail();
      }
      console.log(message);
      expect(message.indexOf("SSH config file does not exist or doesn't contain 'DevCloud' host.")).greaterThanOrEqual(0);
    });

    it('Error message if SSH executable does not exist', async function () {
      const oldName = join(cygwinDefaultPath, 'bin', 'ssh.exe');
      const newName = join(cygwinDefaultPath, 'bin', 'ssh1.exe');
      if (existsSync(oldName)) {
        renameSync(oldName, newName);
      }
      await workbench.executeCommand('Intel DevCloud: Setup connection');
      await driver.sleep(1000);
      const notification = await driver.wait(async () => {
        try {
          const dialog = new ModalDialog();
          await dialog.pushButton('Provide access script');
          await driver.sleep(1000);
          const input = await InputBox.create();
          await input.setText(accessScriptPath);
          await input.confirm();
          await driver.sleep(2000);
          return await getNotifications('Cygwin does not contain the SSH executable.');
        }
        catch (e) { }
      }, 10000);
      renameSync(newName, oldName);
      if (!notification) {
        chai.assert.fail();
      }
      await driver.sleep(1000);
      expect(await notification.getType()).equals(NotificationType.Error);

    });

    it('SSH config contain "Host DevCloud" after providing access', async function () {
      const config = readFileSync(join(tmpSshFolderCyg, "config")).toString();
      expect(config.indexOf(`Host devcloud`)).greaterThanOrEqual(0);
    });

    // it("Config file modified in case proxy enabled", async function () {
    //   const proxyServerTestValue = 'test_proxy_server_string';
    //   await proxyServer.setValue(proxyServerTestValue);
    //   await workbench.executeCommand('Intel DevCloud: Setup connection');
    //   await driver.sleep(1000);
    //   const notification = await driver.wait(async () => {
    //     return await getNotifications('Connecting to head node...');
    //   }, 10000) as Notification;
    //   await notification.takeAction('Cancel');
    //   await driver.sleep(1000);
    //   const config = readFileSync(sshConfigDefaultPath).toString();
    //   expect(config.indexOf(`ProxyCommand nc -x ${proxyServerTestValue} %h %p`)).greaterThanOrEqual(0);
    // });

    after(function () {
      if (existsSync(sshFolderWin)) {
        rmSync(sshFolderWin, { recursive: true, force: true });
        renameSync(tmpSshFolderWin, sshFolderWin);
      } if (existsSync(sshFolderCyg)) {
        rmSync(sshFolderCyg, { recursive: true, force: true });
        renameSync(tmpSshFolderCyg, sshFolderCyg);
      }
    });
  });

  describe('SSH fingerprint verification', () => {
    let knownHostsPath: string;
    let knownHostsPathTemp: string;
    before(async function () {
      knownHostsPath = process.platform === 'win32' ?
        join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts`) :
        join(`${process.env.HOME}`, `.ssh`, `known_hosts`);
      knownHostsPathTemp = process.platform === 'win32' ?
        join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts_temp`) :
        join(`${process.env.HOME}`, `.ssh`, `known_hosts_temp`);
      if (existsSync(knownHostsPath)) {
        renameSync(knownHostsPath, knownHostsPathTemp);
      }
    });

    it('Progress bar appeared', async function () {
      await workbench.executeCommand('Intel DevCloud: Setup connection');
      await driver.sleep(2000);
      const notification = await driver.wait(async () => {
        try {
          const dialog = new ModalDialog();
          await dialog.pushButton("OK");
          const res = await getNotifications('SSH fingerprint verification');
          return res;
        }
        catch { }
      }, 60000) as Notification;
      const type = await notification.getType();
      await notification.takeAction('Cancel');
      expect(type).equals(NotificationType.Info);
      return;
    });

    after(async function () {
      if (existsSync(knownHostsPath)) {
        renameSync(knownHostsPathTemp, knownHostsPath);
      }
    });

  });
});

async function getNotifications(text: string): Promise<Notification | undefined> {
  const notifications = await new Workbench().getNotifications();
  for (const notification of notifications) {
    const message = await notification.getMessage();
    if (message.indexOf(text) >= 0) {
      return notification;
    }
  }
}
