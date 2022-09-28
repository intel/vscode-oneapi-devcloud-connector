/* eslint-disable no-unused-expressions */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { BottomBarPanel, ComboSetting, InputBox, ModalDialog, Notification, NotificationType, Setting, SettingsEditor, StatusBar, VSBrowser, WebDriver, Workbench } from 'vscode-extension-tester';
import { expect } from 'chai';
import { existsSync, readFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path/win32';

const cygwinDefaultPath = join('C:', 'cygwin64');
const sshConfigDefaultPath = join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
describe('Intel Developer Cloud connector basic tests', () => {
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
      settings = await new Workbench().openSettings();
    });

    describe('Choose cluster', () => {
      it("Choose_cluster setting available and contains two options - public and NDA", async function () {
        const setting = await settings.findSetting('Choose_cluster', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector') as ComboSetting;
        const value = await setting.getValues();
        expect(value.length).eq(2);
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
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
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

    describe('Node_device', () => {
      it("Node_device setting available and has default value 'core'", async function () {
        const setting = await settings.findSetting('Node_device', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        const value = await setting.getValue();
        expect(value).eq('core');
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
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('You have the Proxy option enabled');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Config file modified in case proxy enabled", async function () {
        const proxyServerTestValue = 'test_proxy_server_string';
        await proxyServer.setValue(proxyServerTestValue);
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('Connecting to head node...');
        }, 10000) as Notification;
        await notification.takeAction('Cancel');
        await driver.sleep(1000);
        const config = readFileSync(sshConfigDefaultPath).toString();
        expect(config.indexOf(`ProxyCommand nc -x ${proxyServerTestValue} %h %p`)).greaterThanOrEqual(0);
      });
      after(async () => {
        proxy = await settings.findSetting('Proxy', 'Intel-corporation', 'Vscode-oneapi-devcloud-connector');
        await proxy.setValue(false);
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
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('Use the following format: hh:mm:ss');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'hh' is not a number", async function () {
        await setting.setValue("aa:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'hh' is negative number", async function () {
        await setting.setValue("-10:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'hh' is greater than 24", async function () {
        await setting.setValue("25:00:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('ss and mm take values from 0 to 59, and hh from 0 to 24');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });

      it("Error message if 'mm' is not a number", async function () {
        await setting.setValue("00:aa:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'mm' is negative number", async function () {
        await setting.setValue("00:-10:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'mm' is greater than 59", async function () {
        await setting.setValue("00:65:00");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('ss and mm take values from 0 to 59, and hh from 0 to 24');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });

      it("Error message if 'ss' is not a number", async function () {
        await setting.setValue("00:00:aa");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'ss' is negative number", async function () {
        await setting.setValue("00:00:-10");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('hh,mm,ss must be positive integers');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });
      it("Error message if 'ss' is greater than 59", async function () {
        await setting.setValue("00:00:65");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications('ss and mm take values from 0 to 59, and hh from 0 to 24');
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });

      it("Error message if time out value is greater than 24h", async function () {
        await setting.setValue("24:00:1");
        await driver.sleep(1000);
        await workbench.executeCommand('Intel Developer Cloud: Setup connection');
        const notification = await driver.wait(async () => {
          return await getNotifications("Max time is 24h, so the only valid entry");
        }, 10000) as Notification;
        expect(await notification.getType()).equals(NotificationType.Error);
      });

      afterEach(async () => {
        const center = await new Workbench().openNotificationsCenter();
        await center.clearAllNotifications();
      });

      after(async () => {
        await driver.sleep(1000);
        await setting.setValue('06:00:00');
      });
    });
  });

  describe('Commands are available', () => {
    it('Contain "Close connection" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel Developer Cloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel Developer Cloud: Close connection");
      expect(picks).not.undefined;
    });

    it('Contain "Setup connection" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel Developer Cloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel Developer Cloud: Setup connection");
      expect(picks).not.undefined;
    });

    it('Contain "Get help" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel Developer Cloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel Developer Cloud: Get help");
      expect(picks).not.undefined;
    });

    it('Contain "New DevCloud terminal" command', async function () {
      const input = await workbench.openCommandPrompt() as InputBox;
      await input.setText('>Intel Developer Cloud');
      await driver.sleep(500);
      const picks = await input.findQuickPick("Intel Developer Cloud: New Intel Developer Cloud terminal");
      expect(picks).not.undefined;
    });
  });

  it('"Close connection" shows message about no connection', async function () {
    await workbench.executeCommand('Intel Developer Cloud: Close connection');
    const notification = await driver.wait(async () => {
      return await getNotifications('There is no active connection to Intel Developer Cloud');
    }, 10000) as Notification;
    expect(await notification.getType()).equals(NotificationType.Info);
  });

  it('"Create terminal" shows message about no connection', async function () {
    await workbench.executeCommand('Intel Developer Cloud: New Intel Developer Cloud terminal');
    const notification = await driver.wait(async () => {
      return await getNotifications('There is no active connection to Intel Developer Cloud');
    }, 10000) as Notification;
    expect(await notification.getType()).equals(NotificationType.Error);
  });

  it('There is a status bar with "Not connected to Intel Developer Cloud" text', async function () {
    const statusbar = new StatusBar();

    //StatusBar.getItem() find status bar item by title
    //The title attribute represents the text + the tooltip of the status bar element
    //This may be changed in the future
    const devcloudStatusBar = await statusbar.getItem('Not connected to Intel Developer Cloud, Intel Developer Cloud connection status');
    expect(devcloudStatusBar).not.undefined;
  });

  describe('SSH config', () => {
    const accessScriptPath = join(process.cwd(), 'src', 'test', 'ui', 'assets', 'setup-devcloud-access-117534.txt');//path to setup-access script
    before(async function () {
      if (existsSync(sshConfigDefaultPath)) {
        unlinkSync(sshConfigDefaultPath);
      }
    });

    it('Prompt to provide access script', async function () {
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      await driver.sleep(1000);
      const message = await driver.wait(async () => {
        const dialog = new ModalDialog();
        const res = await dialog.getText();
        await dialog.pushButton("Cancel");
        await driver.sleep(1000);
        return res;
      }, 10000);
      expect(message.indexOf("SSH config file does not exist or doesn't contain 'DevCloud' host.")).greaterThanOrEqual(0);
    });

    it('SSH config contain "Host DevCloud" after providing access', async function () {
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      await driver.sleep(1000);
      const dialog = new ModalDialog();
      await dialog.pushButton('Provide access script');
      await driver.sleep(1000);
      const input = await InputBox.create();
      await input.setText(accessScriptPath);
      await input.confirm();
      await driver.sleep(2000);

      const notification = await driver.wait(async () => {
        return await getNotifications('Connecting to head node...');
      }, 10000) as Notification;
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);

      const config = readFileSync(sshConfigDefaultPath).toString();
      expect(config.indexOf(`Host devcloud`)).greaterThanOrEqual(0);
    });

    it('Error message if SSH executable does not exist', async function () {
      const oldName = join(cygwinDefaultPath, 'bin', 'ssh.exe');
      const newName = join(cygwinDefaultPath, 'bin', 'ssh1.exe');
      renameSync(oldName, newName);
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      const notification = await driver.wait(async () => {
        return await getNotifications('Cygwin does not contain the SSH executable.');
      }, 10000) as Notification;
      renameSync(newName, oldName);
      expect(await notification.getType()).equals(NotificationType.Error);
    });

    it('Remote-SSH settings contain path to config file', async function () {
      const settings = await new Workbench().openSettings();
      const setting = await settings.findSetting('Config File', 'Remote.SSH');
      await setting.setValue('');
      await settings.findSetting('Config File', 'Remote.SSH');
      await driver.sleep(1000);
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      const notification = await driver.wait(async () => {
        return await getNotifications('Connecting to head node...');
      }, 10000) as Notification;
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);
      const value = await setting.getValue();
      expect(value).not.eq('');
    });

    it('Remote-SSH settings contain path to ssh executable', async function () {
      const settings = await new Workbench().openSettings();
      const setting = await settings.findSetting('Path', 'Remote.SSH');
      await setting.setValue('');
      await settings.findSetting('Path', 'Remote.SSH');
      await driver.sleep(1000);
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      const notification = await driver.wait(async () => {
        return await getNotifications('Connecting to head node...');
      }, 10000) as Notification;
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);
      const value = await setting.getValue();
      expect(value).not.eq('');

    });
  });

  describe('SSH fingerprint verification', () => {
    let knownHostsPath: string;
    let knownHostsPathNew: string;
    before(async function () {
      knownHostsPath = process.platform === 'win32' ?
        join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts`) :
        join(`${process.env.HOME}`, `.ssh`, `known_hosts`);
      knownHostsPathNew = process.platform === 'win32' ?
        join(cygwinDefaultPath, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts_new`) :
        join(`${process.env.HOME}`, `.ssh`, `known_hosts_new`);
      renameSync(knownHostsPath, knownHostsPathNew);
    });

    it('Progress bar appeared', async function () {
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      await driver.sleep(2500);
      const dialog = new ModalDialog();
      await dialog.pushButton("OK");
      await driver.sleep(1000);
      const notification = await driver.wait(async () => {
        return await getNotifications('SSH fingerprint verification...');
      }, 60000) as Notification;
      await driver.sleep(2000);
      const type = await notification.getType();
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);
      expect(type).equals(NotificationType.Info);
      return;
    });

    // it('Known_host created', async function () {
    //   const terminalView = await new BottomBarPanel().openTerminalView();
    //   await workbench.executeCommand('Intel Developer Cloud: Setup connection');
    //   await terminalView.newTerminal();

    //   await driver.sleep(2500);
    //   const dialog = new ModalDialog();
    //   await dialog.pushButton("OK");
    //   await driver.sleep(1000);
    //   await terminalView.selectChannel('HeadNode terminal');
    //   await driver.sleep(3000);
    //   await terminalView.executeCommand('Yes');
    //   await driver.sleep(3000);
    //   await terminalView.executeCommand('Yes');

    //   await driver.sleep(30000);
    //   return;
    // });
    after(async function () {
      renameSync(knownHostsPathNew, knownHostsPath);
    });
  });

  describe('Connect to head node', () => {
    it('Progress bar appeared', async function () {
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      const notification = await driver.wait(async () => {
        return await getNotifications('Connecting to head node...');
      }, 10000) as Notification;
      const type = await notification.getType();
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);
      expect(type).equals(NotificationType.Info);
    });
  });

  describe('Connect to compute node', () => {
    it('Progress bar appeared', async function () {
      await workbench.executeCommand('Intel Developer Cloud: Setup connection');
      await driver.sleep(15000);
      const notification = await driver.wait(async () => {
        return await getNotifications('Connecting to compute node...');
      }, 60000) as Notification;
      const type = await notification.getType();
      await driver.sleep(1000);
      await notification.takeAction('Cancel');
      await driver.sleep(1000);
      expect(type).equals(NotificationType.Info);
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
