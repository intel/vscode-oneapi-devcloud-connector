/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, posix, sep } from 'path';
import * as vscode from 'vscode';
import { DEVCLOUD, SSH_DEVCLOUD_INTEL_COM, devcloudName } from './constants';
import { ExtensionSettings } from './extension_settings';
import { Shell } from './shell';

export class SshConfigUtils {
    private _sshConfigPath: string;
    public _firstConnection: boolean;

    constructor() {
        this._firstConnection = false;
        this._sshConfigPath = (process.platform !== 'win32') ? join(`${process.env.HOME}`, ".ssh", "config") :
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
        try {
            if (!this.isSshConfigExist() || !this.isSshConfigContentValid()) {
                await this.runSetupAccessScript();
            }
            if (process.platform === "win32") {
                await this.setRemoteSshSettings();
                if (!this.isCygwSshExecutableExist()) {
                    return false;
                }
            }
            if (!this.configureProxySettings()) {
                vscode.window.showErrorMessage("Failed to automatically configure ssh config proxy settings.");
                return false;
            }
            return true;
        }
        catch (e) {
            vscode.window.showErrorMessage(`Failed to create SSH config file:\n${(e as Error).message}`);
            return false;
        }
    }

    private async runSetupAccessScript(): Promise<boolean> {
        const setupAccessScriptPath = await this.getSshScript();
        const cmd = process.platform === 'win32' ? `${Shell.shellPath} -l -c "bash '${setupAccessScriptPath}'"` :
            `bash '${setupAccessScriptPath}'`;
        const output = execSync(cmd);
        return output.length !== 0;
    }

    private isSshConfigExist(): boolean {
        return existsSync(this._sshConfigPath);
    }

    private isSshConfigContentValid(): boolean {
        const sshConfigContent = readFileSync(this._sshConfigPath).toString();
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

    private async setRemoteSshSettings(): Promise<void> {
        const settings = vscode.workspace.getConfiguration('remote');
        await settings.update('SSH.configFile', this._sshConfigPath, true);
        await settings.update('SSH.path', join(ExtensionSettings._cygwinPath!, 'bin', 'ssh.exe'), true);

    }
}

export async function unsetRemoteSshSettings(): Promise<void> {
    const settings = vscode.workspace.getConfiguration('remote');
    await settings.update('SSH.configFile', undefined, true);
    await settings.update('SSH.path', undefined, true);
    return;
}