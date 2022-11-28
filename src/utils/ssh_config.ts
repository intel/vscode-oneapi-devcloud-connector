/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { join, posix, sep } from 'path';
import * as vscode from 'vscode';
import { DEVCLOUD, SSH_DEVCLOUD_INTEL_COM, devcloudName } from './constants';
import { ExtensionSettings } from './extension_settings';
import { Shell } from './shell';

export class SshConfigUtils {
    private _sshConfigPath: string;
    private _setupAccessScriptPath: string | undefined;
    public _firstConnection: boolean;

    constructor() {
        this._setupAccessScriptPath = undefined;
        this._firstConnection = false;
        this._sshConfigPath = (process.platform !== 'win32' && process.env.HOME) ? join(process.env.HOME, ".ssh", "config") :
            join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
    }

    public async readSshConfig(): Promise<string | undefined> {
        let path: string;
        if (process.platform === 'win32') {
            path = join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        } else {
            path = join(`${process.env.HOME}`, `.ssh`, `config`);
        }
        if (!existsSync(path)) {
            return undefined;
        }
        return readFileSync(path).toString();
    }

    public async createSshConfig(): Promise<boolean> {
        const settings = vscode.workspace.getConfiguration('remote');
        await settings.update('SSH.configFile', undefined, true);
        await settings.update('SSH.path', undefined, true);
        if (!this.isSshConfigExist() || !this.isSshConfigContentValid()) {
            if (process.platform === 'win32') {
                this.rewriteConfigFile();
            }
            if (!await this.runSetupAccessScript(true)) {
                return false;
            }
        }
        if (process.platform === "win32") {
            if (!this.isCygwSshExecutableExist()) {
                return false;
            }
            try {
                this.createSshLinks();
            }
            catch (e) {
                vscode.window.showWarningMessage(`Failed to use existing ssh config file. Created a new one in ${this._sshConfigPath}`);
                rmSync(join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`), { recursive: true, force: true });
                await this.runSetupAccessScript(false);

                await settings.update('SSH.configFile', this._sshConfigPath, true);
                await settings.update('SSH.path', join(ExtensionSettings._cygwinPath!, 'bin', 'ssh.exe'), true);
            }
        }
        if (!this.configureProxySettings()) {
            vscode.window.showErrorMessage("Failed to automatically configure ssh config proxy settings.");
            return false;
        }
        return true;
    }

    //fixing file owner and permissions
    private rewriteConfigFile() {
        const configPath = join(`${process.env.USERPROFILE}`, `.ssh`, `config`);
        if (!existsSync(configPath)) {
            return;
        }
        const configContent = readFileSync(configPath).toString();
        unlinkSync(configPath);
        execSync(`> /cygdrive/c/Users/${process.env.USERNAME}/.ssh/config`, { shell: Shell.shellPath });
        writeFileSync(configPath, configContent);
    }

    private createSshLinks(): void {
        const winSshFolder = join(`${process.env.USERPROFILE}`, `.ssh`);
        const cygwSshFolder = join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`);
        if (!existsSync(cygwSshFolder)) {
            mkdirSync(cygwSshFolder);
        }
        readdirSync(winSshFolder).forEach((name) => {
            if (!existsSync(join(cygwSshFolder, name))) {
                linkSync(join(winSshFolder, name), join(cygwSshFolder, name));
                const path = join("/", "cygdrive", winSshFolder, name).replace(':', '').split(sep).join(posix.sep);
                execSync(`${Shell.shellPath} -l -c "chmod 600 ${path}"`);
            }
        });
        if (execSync(`${Shell.shellPath} -l -c "cat ~/.ssh/config"`).toString().
            indexOf('Permission denied') >= 0) {
            throw Error("Failed to create links");
        }
    }

    private async runSetupAccessScript(defaultWinConfig: boolean): Promise<boolean> {
        if (!this._setupAccessScriptPath) {
            this._setupAccessScriptPath = await this.getSshScript();
        }
        if (!this._setupAccessScriptPath) {
            return false;
        }
        const cmd = process.platform === 'win32' ? `${Shell.shellPath} -l -c "${defaultWinConfig === true ? 'export HOME=$USERPROFILE && ' : ''}bash '${this._setupAccessScriptPath}'"` :
            `bash '${this._setupAccessScriptPath}'`;
        return execSync(cmd).length !== 0;
    }
    private isSshConfigExist(): boolean {
        const config = process.platform === 'win32' ? join(`${process.env.USERPROFILE}`, `.ssh`, `config`) : this._sshConfigPath;
        return existsSync(config);
    }

    private isSshConfigContentValid(): boolean {
        const config = process.platform === 'win32' ? join(`${process.env.USERPROFILE}`, `.ssh`, `config`) : this._sshConfigPath;
        const sshConfigContent = readFileSync(config).toString();
        const res = sshConfigContent.match(/Host devcloud/gi);
        return res !== null;
    }

    private isCygwSshExecutableExist(): boolean {
        if (!existsSync(join(ExtensionSettings._cygwinPath!, 'bin', 'ssh.exe'))) {
            vscode.window.showErrorMessage("Cygwin does not contain the SSH executable.");
            return false;
        }
        return true;
    }

    private async getSshScript(): Promise<string | undefined> {
        let sshAccessScript;
        const selection = await vscode.window.showErrorMessage(`SSH config file does not exist or doesn't contain 'DevCloud' host.\n*To find path to setup-devcloud-access script, click 'Provide access script' button.\n*To get access to ${devcloudName} and download the script, click Get access button.`, { modal: true },
            "Provide access script", `Get access to ${devcloudName}`);
        if (selection === "Provide access script") {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const uri = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'setup-devcloud-access-': ['txt'] } });
            if (uri && uri[0]) {
                sshAccessScript = uri[0].fsPath;
            }
            this._firstConnection = true;
        }
        if (selection === `Get access to ${devcloudName}`) {
            vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/`));
        }
        if (process.platform === "win32" && sshAccessScript) {
            sshAccessScript = join("/", "cygdrive", sshAccessScript).replace(':', '');
            sshAccessScript = sshAccessScript.split(sep).join(posix.sep);
        }
        return sshAccessScript;
    }

    private configureProxySettings(): boolean {
        const config = readFileSync(this._sshConfigPath).toString().replace(/\r/gm, '');
        if (config) {
            const firstRegEx = /Host devcloud-via-proxy\nUser guest\nHostname ssh\.devcloud\.intel\.com\nIdentityFile ~\/\.ssh\/devcloud-access-key-[0-9]*\.txt\nLocalForward 4022 c009:22\nProxyCommand nc -x .*:.* %h %p/gmi;
            const secondRegEx = /Host \*\.aidevcloud\nUser .*\nIdentityFile .*\nProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/gmi;
            const firstReplace = config.match(firstRegEx);
            const secondReplace = config.match(secondRegEx);
            if (firstReplace === null || secondReplace === null) {
                return false;
            }
            firstReplace[0] = firstReplace[0].replace(/ProxyCommand nc -x .*:.* %h %p/gm,
                `ProxyCommand nc -x ${ExtensionSettings._proxy ? ExtensionSettings._proxyServer : "PROXY_HOSTNAME:PORT"} %h %p`);
            secondReplace[0] = secondReplace[0].replace(/ProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/,
                `ProxyCommand ssh -T ${ExtensionSettings._proxy ? 'devcloud.proxy' : 'devcloud'} nc %h %p`);
            const newConfig = config.replace(firstRegEx, firstReplace[0]).replace(secondRegEx, secondReplace[0]);
            if (newConfig.length !== 0) {
                writeFileSync(this._sshConfigPath, newConfig);
            } else {
                return false;
            }
            return true;
        }
        return false;
    }

    public async checkKnownHosts(): Promise<boolean> {
        const knownHostsPath = process.platform === 'win32' ?
            join(`${ExtensionSettings._cygwinPath}`, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts`) :
            join(`${process.env.HOME}`, `.ssh`, `known_hosts`);
        if (!existsSync(knownHostsPath)) {
            return false;
        }
        const knownHosts = readFileSync(knownHostsPath).toString();
        let sshDevcloudIntelComHost = false;
        let devcloudHost = false;
        for (const key of SSH_DEVCLOUD_INTEL_COM) {
            if (knownHosts.indexOf(key) !== -1) {
                sshDevcloudIntelComHost = true;
                break;
            }
        }
        for (const key of DEVCLOUD) {
            if (knownHosts.indexOf(key) !== -1) {
                devcloudHost = true;
                break;
            }
        }
        if (!sshDevcloudIntelComHost || !devcloudHost) {
            return false;
        }
        return true;
    }

}
