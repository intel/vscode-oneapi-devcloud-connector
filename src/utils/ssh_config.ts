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
import { Logger } from "./logger";

const logger = Logger.getInstance();

export class SshConfigUtils {
    private _sshConfigPath: string;
    public _firstConnection: boolean;

    constructor() {
        this._firstConnection = false;
        this._sshConfigPath = (process.platform !== 'win32') ? join(`${process.env.HOME}`, ".ssh", "config") :
            join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        }

    public async readSshConfig(): Promise<string> {
        logger.debug("readSshConfig()");
        let path: string;
        if (process.platform === 'win32') {
            path = join(ExtensionSettings._cygwinPath!, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        } else {
            path = join(`${process.env.HOME}`, `.ssh`, `config`);
        }
        if (!existsSync(path)) {
            logger.error("Failed to read ssh config file. Config file does not exist");
            throw Error("Failed to read ssh config file. Config file does not exist");
        }
        return readFileSync(path).toString();
    }

    public async init(): Promise<void> {
        logger.debug("createSshConfig()");
        try {
            if (!this.isSshConfigExist() || !this.isSshConfigContentValid()) {
                await this.runSetupAccessScript();
            }
            if (process.platform === "win32") {
                await this.setRemoteSshSettings();
                if (!this.isCygwSshExecutableExist()) {
                    throw Error("Cygwin does not contain the SSH executable");
                }
            }
            this.configureProxySettings();
        }
        catch (e) {
            throw Error(`Failed to create SSH config file:\n${(e as Error).message}`);
        }
    }

    private async runSetupAccessScript(): Promise<boolean> {
        logger.debug("runSetupAccessScript()");
        const setupAccessScriptPath = await this.getSshScript();
        const cmd = process.platform === 'win32' ? `${Shell.shellPath} -l -c "bash '${setupAccessScriptPath}'"` :
            `bash '${setupAccessScriptPath}'`;
        const output = execSync(cmd);
        return output.length !== 0;
    }

    private isSshConfigExist(): boolean {
        logger.debug(`isSshConfigExist() returned ${existsSync(this._sshConfigPath)}`);
        return existsSync(this._sshConfigPath);
    }

    private isSshConfigContentValid(): boolean {
        const sshConfigContent = readFileSync(this._sshConfigPath).toString();
        const res = sshConfigContent.match(/Host devcloud/gi);
        logger.debug(`isSshConfigContentValid() returned - ${res !== null}`);
        return res !== null;
    }

    private isCygwSshExecutableExist(): boolean {
        if (!existsSync(join(ExtensionSettings._cygwinPath!, 'bin', 'ssh.exe'))) {
            return false;
        }
        logger.debug(`isCygwSshExecutableExist() returned - ${true}`);
        return true;
    }

    private async getSshScript(): Promise<string | undefined> {
        logger.debug("getSshScript()");
        let sshAccessScript;
        const selection = await vscode.window.showErrorMessage(`SSH config file does not exist or doesn't contain 'DevCloud' host.\n*To find path to setup-devcloud-access script, click 'Provide access script' button.\n*To get access to ${devcloudName} and download the script, click Get access button`, { modal: true },
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
        logger.debug("getSshScript() returned - sshAccessScript");
        return sshAccessScript;
    }

    private configureProxySettings(): void {
        logger.debug("configureProxySettings()");
        const config = readFileSync(this._sshConfigPath).toString().replace(/\r/gm, '');
        if (config) {
            const firstRegEx = /Host devcloud-via-proxy\nUser guest\nHostname ssh\.devcloud\.intel\.com\nIdentityFile ~\/\.ssh\/devcloud-access-key-[0-9]*\.txt\nLocalForward 4022 c009:22\nProxyCommand nc -x .*:.* %h %p/gmi;
            const secondRegEx = /Host \*\.aidevcloud\nUser .*\nIdentityFile .*\nProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/gmi;
            const firstReplace = config.match(firstRegEx);
            const secondReplace = config.match(secondRegEx);
            if (firstReplace === null || secondReplace === null) {
                logger.error(`configureProxySettings() failed - firstReplace === ${firstReplace} || secondReplace ===${secondReplace}\n\
                firstRegEx = ${firstRegEx}\n\
                secondRegEx = ${secondRegEx}`);
                throw Error("Failed to automatically configure ssh config proxy settings.\nUnable to parse devcloud ssh targets in the config file");
            }
            firstReplace[0] = firstReplace[0].replace(/ProxyCommand nc -x .*:.* %h %p/gm,
                `ProxyCommand nc -x ${ExtensionSettings._proxy ? ExtensionSettings._proxyServer : "PROXY_HOSTNAME:PORT"} %h %p`);
            secondReplace[0] = secondReplace[0].replace(/ProxyCommand ssh -T (devcloud\.proxy|devcloud) nc %h %p/,
                `ProxyCommand ssh -T ${ExtensionSettings._proxy ? 'devcloud.proxy' : 'devcloud'} nc %h %p`);
            const newConfig = config.replace(firstRegEx, firstReplace[0]).replace(secondRegEx, secondReplace[0]);
            if (newConfig.length !== 0) {
                writeFileSync(this._sshConfigPath, newConfig);
            } else {
                logger.error(`configureProxySettings() failed. newConfig.length === 0`);
                throw Error("Failed to automatically configure ssh config proxy settings.\nUnable to make changes to the config file");
            }
            return;
        }
        logger.error(`configureProxySettings() unable to read ssh config file`);
        throw Error("Failed to automatically configure ssh config proxy settings.\nUnable to read ssh config file");
    }

    public async checkKnownHosts(): Promise<boolean> {
        logger.debug("checkKnownHosts()");
        const knownHostsPath = process.platform === 'win32' ?
            join(`${ExtensionSettings._cygwinPath}`, `home`, `${process.env.USERNAME}`, `.ssh`, `known_hosts`) :
            join(`${process.env.HOME}`, `.ssh`, `known_hosts`);
        if (!existsSync(knownHostsPath)) {
            logger.warn(`checkKnownHosts() - knownHostsPath does not exist. knownHostsPath = ${knownHostsPath}`);
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
            logger.warn(`checkKnownHosts() - knownHostsPath does not contain fingerprints for devcloud`);
            return false;
        }
        return true;
    }

    private async setRemoteSshSettings(): Promise<void> {
        logger.debug("setRemoteSshSettings()");
        const settings = vscode.workspace.getConfiguration('remote');
        await settings.update('SSH.configFile', this._sshConfigPath, true);
        await settings.update('SSH.path', join(ExtensionSettings._cygwinPath!, 'bin', 'ssh.exe'), true);

    }
}

export async function unsetRemoteSshSettings(): Promise<void> {
    logger.debug("unsetRemoteSshSettings()");
    const settings = vscode.workspace.getConfiguration('remote');
    await settings.update('SSH.configFile', undefined, true);
    await settings.update('SSH.path', undefined, true);
    return;
}