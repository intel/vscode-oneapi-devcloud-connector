/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

'use strict';

import { execSync } from 'child_process';
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { DEVCLOUD, SSH_DEVCLOUD_INTEL_COM } from './devcloud_key_pub';

export class SshConfigUtils {
    private _sshConfigPath!: string;
    private _cygwinFolderPath!: string;
    private _shellPath: string | undefined;
    private _proxyServer: string | undefined;
    public _firstConnection: boolean | undefined;

    constructor(cygwinFolderPath: string | undefined, shellPath: string, proxyServer: string | undefined) {
        if (cygwinFolderPath) {
            this._cygwinFolderPath = cygwinFolderPath;
        }
        this._shellPath = shellPath;
        this._proxyServer = proxyServer;
    }

    public async readSshConfig(): Promise<string | undefined> {
        let path: string;
        if (process.platform === 'win32') {
            path = join(this._cygwinFolderPath, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        } else {
            path = join(`${process.env.HOME}`, `.ssh`, `config`);
        }
        if (!existsSync(path)) {
            return undefined;
        }
        return readFileSync(path).toString();
    }

    public async createSshConfig(): Promise<boolean> {
        if (!(await this.init())) {
            return false;
        }
        if (!this.sshExist() || !this.isSshConfigContentValid()) {
            const sshAccessScript = await this.getSshScript();
            if (!sshAccessScript) {
                return false;
            }
            const sshAccessScriptCopy = process.platform === 'win32' ? join(this._cygwinFolderPath, `home`, `${process.env.USERNAME}`, `setup-devcloud-accsess.txt`) :
                join(`${process.env.HOME}`, `setup-devcloud-accsess.txt`);
            if (process.platform === 'win32') {
                execSync(`${this._shellPath} --login `);
            }
            copyFileSync(sshAccessScript, sshAccessScriptCopy);
            const cmd = process.platform === 'win32' ? `${this._shellPath} -i -l -c "bash '/home/${process.env.USERNAME}/setup-devcloud-accsess.txt'"` :
                `bash '${sshAccessScriptCopy}'`;
            execSync(cmd);
            unlinkSync(sshAccessScriptCopy);
        }
        if (!this.configureProxySettings()) {
            vscode.window.showErrorMessage("Failed to automatically configure ssh config proxy settings.");
            return false;
        }
        return true;
    }

    private sshExist(): boolean {
        return existsSync(this._sshConfigPath);
    }

    private isSshConfigContentValid(): boolean {
        const sshConfig = readFileSync(this._sshConfigPath).toString();
        const res = sshConfig.match(/Host devcloud/gi);
        return res !== null;
    }

    private async init(): Promise<boolean> {
        const configPath = (process.platform !== 'win32' && process.env.HOME) ? join(process.env.HOME, ".ssh", "config") :
            join(this._cygwinFolderPath, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        this._sshConfigPath = configPath;
        if (process.platform === 'win32') {
            if (!existsSync(join(this._cygwinFolderPath, 'bin', 'ssh.exe'))) {
                vscode.window.showErrorMessage("Cygwin does not contain the SSH executable.");
                return false;
            }
            await this.setRemoteSshSettings();
            this._firstConnection = false;
        }
        return true;
    }
    private async setRemoteSshSettings(): Promise<void> {
        const settings = vscode.workspace.getConfiguration('remote');
        await settings.update('SSH.configFile', this._sshConfigPath, true);
        await settings.update('SSH.path', join(this._cygwinFolderPath, 'bin', 'ssh.exe'), true);

    }

    private async getSshScript(): Promise<string | undefined> {
        let sshAccessScript;
        const selection = await vscode.window.showErrorMessage("SSH config file does not exist or doesn't contain 'DevCloud' host.\n*To find path to setup-devcloud-access script, click 'Provide access script' button.\n*To get access to Intel Developer Cloud and download the script, click Get access button.", { modal: true },
            "Provide access script", "Get access to Intel Developer Cloud");
        if (selection === "Provide access script") {
            const uri = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { 'setup-devcloud-access-': ['txt'] } });
            if (uri && uri[0]) {
                sshAccessScript = uri[0].fsPath;
            }
            this._firstConnection = true;
        }
        if (selection === "Get access to Intel Developer Cloud") {
            vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/`));
        }
        return sshAccessScript;
    }

    private configureProxySettings(): boolean {
        const config = readFileSync(this._sshConfigPath).toString();
        if (config) {
            const firstRegEx = /Host devcloud-via-proxy\nUser guest\nHostname ssh\.devcloud\.intel\.com\nIdentityFile ~\/\.ssh\/devcloud-access-key-[0-9]*\.txt\nLocalForward 4022 c009:22\nProxyCommand nc -x .*:.* %h %p/gmi;
            const secondRegEx = /Host \*\.aidevcloud\nUser .*\nIdentityFile .*\nProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/gmi;
            const firstReplace = config.match(firstRegEx);
            const secondReplace = config.match(secondRegEx);
            if (firstReplace === null || secondReplace === null) {
                return false;
            }
            firstReplace[0] = firstReplace[0].replace(/ProxyCommand nc -x .*:.* %h %p/gm,
                `ProxyCommand nc -x ${this._proxyServer ? this._proxyServer : "PROXY_HOSTNAME:PORT"} %h %p`);
            secondReplace[0] = secondReplace[0].replace(/ProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/,
                `ProxyCommand ssh -T ${this._proxyServer ? 'devcloud.proxy' : 'devcloud'} nc %h %p`);
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
            join(`${this._cygwinFolderPath}`, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts`) :
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

export async function unsetRemoteSshSettings(): Promise<void> {
    const settings = vscode.workspace.getConfiguration('remote');
    await settings.update('SSH.configFile', undefined, true);
    await settings.update('SSH.path', undefined, true);
    return;
}
