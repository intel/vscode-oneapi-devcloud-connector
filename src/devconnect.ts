/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

'use strict';

import * as vscode from 'vscode';
import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { posix, join } from 'path';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private devCloudTerminal!: vscode.Terminal;
    private firstLog!: string;
    private secondLog!: string;
    private userName!: string;
    private nodeName!: string;
    private jobID!: string;
    private cygwinFolderPath!: string;
    private shellPath: string | undefined;

    private _isConnected!: boolean;


    private _proxy: boolean | undefined;
    private _connectionTimeout: number | undefined;
    private _jobTimeout: string | undefined;
    private _cygwinPath: string | undefined;

    public set isConnected(isConnected: boolean) {
        this._isConnected = isConnected;
    }

    public set proxy(proxy: boolean | undefined) {
        if (proxy === undefined) {
            this._proxy = undefined;
        } else {
            this._proxy = proxy;
        }
    }

    public set connectionTimeout(timeout: number | undefined) {
        if (timeout === undefined || timeout < 0) {
            this._connectionTimeout = 30000;
        } else {
            this._connectionTimeout = timeout * 1000;
        }
    }

    public set jobTimeout(timeout: string | undefined) {
        if (timeout === undefined || timeout?.length === 0) {
            this._jobTimeout = undefined;
        } else {
            this._jobTimeout = timeout;
        }
    }

    public set cygwinPath(sshPath: string | undefined) {
        if (sshPath?.length === 0 || sshPath === undefined) {
            this._cygwinPath = undefined;
        } else {
            this._cygwinPath = posix.normalize(sshPath.replace(`\r`, "")).split(/[\\\/]/g).join(posix.sep);
        }
    }

    public async setupConnection(): Promise<void> {
        if (this._isConnected) {
            vscode.window.showErrorMessage(`You have already connected to DevCloud`, { modal: true });
            return;
        }
        if (!await this.init()) {
            return;
        }
        if (!await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Connecting to head node...",
            cancellable: true
        }, async (_progress, token) => {
            token.onCancellationRequested(() => {
                this.firstTerminal.dispose();
                return false;
            });
            if (!await this.connectToHeadNode()) {
                this.firstTerminal.dispose();
                return false;
            }
            return true;
        })) {
            return;
        }
        if (! await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Connecting to compute node...",
            cancellable: true
        }, async (_progress, token) => {
            token.onCancellationRequested(() => {
                this.firstTerminal.dispose();
                this.secondTerminal.dispose();
                return false;
            }); if (!await this.connectToSpecificNode()) {
                this.firstTerminal.dispose();
                this.secondTerminal.dispose();
                return false;
            }
            return true;
        })) {
            return;
        }
        this.removeTmpFiles();
        return;
    }

    public async closeConnection(): Promise<void> {
        this.firstTerminal?.dispose();
        this.secondTerminal?.dispose();

        this._isConnected = false;
        vscode.window.showInformationMessage('Connection to devcloud closed');
        return;
    }

    public async createDevCloudTerminal(): Promise<void> {
        this.createNodeTerminal();
        return;
    }

    public getHelp(): void {
        const devCloudHelp = `DevCloud Help`;
        vscode.window.showInformationMessage(`Click for more Info`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }


    private async init(): Promise<boolean> {
        if (!await (this.setShell())) {
            return false;
        }
        if (!this.createTmpFiles()) {
            return false;
        }
        const sshConfig = await this.getSshConfig();
        if (!sshConfig) {
            vscode.window.showErrorMessage('Сould not find ssh config file');
            return false;
        }
        if (!await this.getUserNameFromConfig(sshConfig)) {
            return false;
        }
        return true;
    }

    private async setShell(): Promise<boolean> {
        if (process.platform === 'win32') {
            if (!await this.checkCygwinPath()) {
                return false;
            }
            this.shellPath = join(this.cygwinFolderPath, `bin`, `bash.exe`);
        } else {
            this.shellPath = '/bin/bash';
        }
        if (!existsSync(this.shellPath)) {
            vscode.window.showErrorMessage(`Failed to find a shell binary. Path:${this.shellPath}`, { modal: true });
            return false;
        }
        return true;
    }

    private async checkCygwinPath(): Promise<boolean> {
        if (!this._cygwinPath || !existsSync(this._cygwinPath)) {
            vscode.window.showErrorMessage(`Path to the cygwin folder specified in settings is invalid.`, { modal: true });
            return false;
        }
        this.cygwinFolderPath = this._cygwinPath;
        return true;
    }

    private async connectToHeadNode(): Promise<boolean> {
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.firstLog}"` : undefined;
        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal during the work! Do not type here!';

        this.firstTerminal = vscode.window.createTerminal({ name: `devcloudService1`, shellPath: this.shellPath, shellArgs: firsrtShellArgs, message: message });

        if (process.platform !== 'win32') {
            this.firstTerminal.sendText(`ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.firstLog}`);
        }

        if (!await this.checkConnection(this.firstLog, this.firstTerminal)) {
            vscode.window.showErrorMessage("Failed to connect to head node. Possible fixes:\n\n\
* Check your VPN status. Turn it off\n\
* Check your proxy setting in extension settings\n\
* Try to increase connection timeout in extension settings", { modal: true });
            return false;
        }

        const qsubOptions = `qsub -I ${this._jobTimeout !== undefined ? `-l walltime=${this._jobTimeout}` : ``}`;
        this.firstTerminal.sendText(qsubOptions);
        this.firstTerminal.sendText(`qstat -f`);

        if (!await this.getJobID(this.firstLog)) {
            await vscode.window.showErrorMessage("There is already a job in the qsub queue. The extension will not be able to work until they complete.", { modal: true });
            return false;
        }
        return true;
    }

    private async connectToSpecificNode(): Promise<boolean> {
        if (!await this.getNodeName()) {
            return false;
        }
        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal during the work!';
        const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}"` : undefined;
        this.secondTerminal = vscode.window.createTerminal({ name: `devcloudService2`, shellPath: this.shellPath, shellArgs: secondShellArgs, message: message });

        if (process.platform !== 'win32') {
            this.secondTerminal.sendText(`ssh ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}`);
        }
        this.secondTerminal.show();
        if (!await this.checkConnection(this.secondLog, this.secondTerminal)) {
            vscode.window.showErrorMessage("Failed to create tunnel to compute node", { modal: true });
            return false;
        }
        vscode.window.showInformationMessage(`Ready to use Remote-SSH and connect with the devcloud-vscode ssh target.\nReady to start New DevCloud terminal\nDO NOT close the "devcloudService" terminals while connected to DevCloud using the VS Code Remote-SSH extension or DevCloud terminal`, { modal: true });
        this._isConnected = true;
        return true;
    }

    private async createNodeTerminal(): Promise<boolean> {
        if (this._isConnected) {
            const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)}"` : undefined;
            this.devCloudTerminal = vscode.window.createTerminal({ name: `DevClWorkTerminal`, shellPath: this.shellPath, shellArgs: secondShellArgs });

            if (process.platform !== 'win32') {
                this.devCloudTerminal.sendText(`ssh ${this.nodeName?.concat(`.aidevcloud`)}`);
            }
        }
        else {
            this.devCloudTerminal = vscode.window.createTerminal({ shellPath: this.shellPath });
        }
        this.devCloudTerminal.show();

        return true;
    }

    private async getNodeName(): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const log = this.getLog(this.firstLog);
                if (log) {
                    const idx1 = log.indexOf(`Job Id: ${this.jobID}`);
                    if (idx1 !== -1) {
                        const jobQstat = log.substring(idx1);
                        const matchHostRecord = 'exec_host = ';
                        const idx2 = jobQstat.indexOf(matchHostRecord);
                        const hostRecord = jobQstat.substring(idx2 + matchHostRecord.length);
                        const idx3 = hostRecord.indexOf('/');
                        this.nodeName = hostRecord.substring(0, idx3);
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, this._connectionTimeout);
        });
    }

    private getLog(path: string): string | undefined {
        let res = undefined;
        try {
            if (process.platform === 'win32') {
                res = readFileSync(join(this.cygwinFolderPath, path)).toString();
            }
            else {
                res = readFileSync(path).toString();
            }
            return res;
        }
        catch (err) {
            return res;
        }
    }

    private createTmpFiles(): boolean {
        if (!this.createLogFiles()) {
            vscode.window.showErrorMessage("Failed to create Log Files", { modal: true });
            return false;
        }
        return true;
    }

    private createLogFiles(): boolean {
        try {
            this.firstLog = execSync(`${this.shellPath} -i -l -c "mktemp /tmp/devcloud.log1.XXXXXX.txt"`).toString().replace('\n', '');
            const ind = this.firstLog.indexOf(`/tmp/devcloud.log1`);
            const val = this.firstLog.substr(ind + 0);
            this.firstLog = val;

            this.secondLog = execSync(`${this.shellPath} -i -l -c "mktemp /tmp/devcloud.log2.XXXXXX.txt"`).toString().replace('\n', '');
            const ind2 = this.secondLog.indexOf(`/tmp/devcloud.log2`);
            const val2 = this.secondLog.substr(ind2 + 0);
            this.secondLog = val2;

            return true;
        }
        catch (err) {
            return false;
        }
    }

    public removeTmpFiles(): boolean {
        if (!this.removeLogFiles()) {
            return false;
        }
        return true;
    }

    private removeLogFiles(): boolean {
        try {
            execSync(`${this.shellPath} -i -l -c "rm ${this.firstLog}"`);
            execSync(`${this.shellPath} -i -l -c "rm ${this.secondLog}"`);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    private async checkConnection(pathToLog: string, terminal: vscode.Terminal): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern = terminal === this.firstTerminal ? `${this.userName}@` : `@${this.nodeName}`;
                const log = this.getLog(pathToLog);
                if (log) {
                    const ind = log.match(checkPattern);
                    if (ind !== undefined) {
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, this._connectionTimeout);
        });
    }

    private async getJobID(pathToLog: string): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const log = this.getLog(pathToLog);
                if (log) {
                    const res = log.match(/qsub:\s+job\s+\S+\s+ready/gi);
                    if (res !== null) {
                        const idx1 = 4 + res[0].indexOf('job ');
                        const idx2 = res[0].indexOf(' ready');
                        this.jobID = res[0].substring(idx1, idx2);
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, this._connectionTimeout);
        });
    }
    private async getUserNameFromConfig(config: string): Promise<boolean> {
        const idx1 = config.indexOf(`Host devcloud`);
        if (idx1 < 0) {
            vscode.window.showErrorMessage(`ssh config doesn't contain devcloud host`, { modal: true });
            return false;
        }
        const idx2 = config.indexOf(`User`, idx1);
        const idx3 = config.indexOf('\n', idx2);

        this.userName = config.substring(idx2, idx3).replace('User', '').trim();
        return true;
    }

    private async getSshConfig(): Promise<string | undefined> {
        let path: string;
        if (process.platform === 'win32') {
            path = join(this.cygwinFolderPath, `home`, `${process.env.USERNAME}`, `.ssh`, `config`);
        } else {
            path = join(`${process.env.HOME}`, `.ssh`, `config`);
        }
        if (!existsSync(path)) {
            return undefined;
        }
        return readFileSync(path).toString();
    }
}
