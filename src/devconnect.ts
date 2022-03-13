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
import { SshConfigUtils } from './utils/ssh_config';
import { tmpdir } from 'os';

export class DevConnect {
    private firstTerminal!: vscode.Terminal;
    private secondTerminal!: vscode.Terminal;
    private devCloudTerminal!: vscode.Terminal;
    private fingerprintTerminal!: vscode.Terminal;
    private qstatTerminal!: vscode.Terminal;
    private firstLog!: string;
    private secondLog!: string;
    private fingerprintLog!: string;
    private userName!: string;
    private nodeName!: string;
    private jobID!: string;

    private _shellPath: string | undefined;
    private _sshConfigUtils!: SshConfigUtils;
    private _isConnected!: boolean;
    private _proxy: boolean | undefined;
    private _proxyServer: string | undefined;
    private _connectionTimeout: number | undefined;
    private _jobTimeout: string | undefined;
    private _cygwinPath: string | undefined;
    private _nodeDevice: string | undefined;
    private _terminalExitStatus: number | undefined;
    private _fterminalExitStatus: number | undefined;
    private _sessionTime: number | undefined;
    private _isCancelled: boolean | undefined;


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

    public set proxyServer(proxyServer: string | undefined) {
        if (proxyServer === undefined || proxyServer?.length === 0) {
            this._proxyServer = undefined;
        } else {
            this._proxyServer = proxyServer;
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

    public set nodeDevice(device: string | undefined) {
        if (device === undefined || device?.length === 0) {
            this._nodeDevice = undefined;
        } else {
            this._nodeDevice = device;
        }
    }

    public set terminalExitStatus(terminalExitStatus: number | undefined) {
        this._terminalExitStatus = terminalExitStatus;
    }

    public set fterminalExitStatus(fterminalExitStatus: number | undefined) {
        this._fterminalExitStatus = fterminalExitStatus;
    }

    public async setupConnection(): Promise<void> {

        this._isCancelled = false;

        if (this._isConnected) {

            vscode.window.showErrorMessage(`You have already connected to DevCloud.\nTo close current connection type Ctrl+Shift+P and choose "Intel DevCloud: Close connection"`, { modal: true });
            return;
        }

        if (!await this.init()) {
            return;
        }
        if (!await this._sshConfigUtils.checkKnownHosts()) {
            vscode.window.showInformationMessage("To create ssh fingerprint, type 'yes' in the terminal below", { modal: true });
            if (!await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "SSH fingerprint verification...",
                cancellable: true
            }, async (_progress, token) => {
                token.onCancellationRequested(() => {
                    this.fingerprintTerminal?.dispose();
                    return false;
                });
                if (!await this.getFingerprint()) {
                    this.fingerprintTerminal?.dispose();
                    return false;
                }
                return true;
            })) {
                this.fingerprintTerminal?.dispose();
                return;
            }
           
            execSync(`${this._shellPath} -i -l -c "rm ${this.fingerprintLog}"`);
            this.fingerprintTerminal?.dispose();
        }

        if (!await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Connecting to head node...",
            cancellable: true
        }, async (_progress, token) => {
            token.onCancellationRequested(() => {
                this.firstTerminal?.dispose();
                return false;
            });
            if (!await this.connectToHeadNode()) {
                this.firstTerminal?.dispose();
                return false;
            }
            if (!await this.createInteractiveJob()) {
                this.firstTerminal?.dispose();
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
                this._isCancelled = true;
                this.firstTerminal?.dispose();
                this.secondTerminal?.dispose();
                return false;
            }); if (!await this.connectToSpecificNode()) {
                this.firstTerminal?.dispose();
                this.secondTerminal?.dispose();
                return false;
            }
            return true;
        })) {
            return;
        }
        vscode.commands.executeCommand('opensshremotes.openEmptyWindow', { host: "devcloud-vscode" });
        this.removeTmpFiles();

        const initTime = new Date().getTime();
        if(! await this.walltimeCheck(initTime)){
            if(this._isConnected === false){
                return;
            }
            vscode.window.showInformationMessage('The session time out. Connection will be closed.',{modal:true});
            this.closeConnection();
        }

        return;
    }

    public async closeConnection(): Promise<void> {
        if (!this._isConnected) {
            vscode.window.showInformationMessage('There is no active connection to DevCloud');
        }
        else {
            vscode.window.showInformationMessage('Connection to DevCloud closed.');
        }
        this.firstTerminal?.dispose();
        this.secondTerminal?.dispose();
        this.devCloudTerminal?.dispose();
        this.fingerprintTerminal?.dispose();
        this.qstatTerminal?.dispose();

        this._isConnected = false;
        return;
    }

    public async createDevCloudTerminal(): Promise<void> {
        this.createNodeTerminal();
        return;
    }

    public getHelp(): void {
        const devCloudHelp = `DevCloud Help`;
        vscode.window.showInformationMessage(`Click here for more information.`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }

    private async init(): Promise<boolean> {
        if (!this.checkJobTimeoutFormat(this._jobTimeout)) {
            return false;
        }
        if(!await this.installCygwin()){
            return false;
        }
        if (!await (this.setShell())) {
            return false;
        }
        if (this._shellPath) {
            if (this._proxy && !this._proxyServer) {
                vscode.window.showErrorMessage("You have the Proxy option enabled in the settings, but the Proxy_server is not specified");
                return false;
            }
            this._sshConfigUtils = this._proxy ? new SshConfigUtils(this._cygwinPath, this._shellPath, this._proxyServer) :
                new SshConfigUtils(this._cygwinPath, this._shellPath, undefined);
            if (!await this._sshConfigUtils.createSshConfig()) {
                return false;
            }
        }
        if (!this.createTmpFiles()) {
            return false;
        }
        const sshConfig = await this._sshConfigUtils.readSshConfig();
        if (!sshConfig) {

            vscode.window.showErrorMessage('Could not find the SSH configuration file.');

            return false;
        }
        if (!await this.getUserNameFromConfig(sshConfig)) {
            return false;
        }
        return true;
    }

    private async getFingerprint(): Promise<boolean> {
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}"` : undefined;
        const message = 'Please wait...';

        this.fingerprintTerminal = vscode.window.createTerminal({ name: `HeadNode terminal`, shellPath: this._shellPath, shellArgs: firsrtShellArgs, message: message });
        this.fingerprintTerminal.show();
        if (process.platform !== 'win32') {
            this.fingerprintTerminal.sendText(`ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}`);
        }
        if (!await this.checkConnection(this.fingerprintLog, this.fingerprintTerminal)) {
            const message = "Failed to create an ssh fingerprint. Possible fixes:\n\
    * Check your VPN status. Disconnect from any active VPN connections.\n\
    * Check your proxy in the extension settings.\n\
    * Check your Internet connection.\n\
    * Try to increase connection timeout in the extension settings.";
            vscode.window.showErrorMessage(message, { modal: true });
            this._fterminalExitStatus = 0;
            return false;
        }
        return true;
    }

    private async connectToHeadNode(): Promise<boolean> {
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.firstLog}"` : undefined;
        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal while working in the DevCloud. Do not type anything in this terminal.';

        this.firstTerminal = vscode.window.createTerminal({ name: `devcloudService1 - do not close`, shellPath: this._shellPath, shellArgs: firsrtShellArgs, message: message });

        if (process.platform !== 'win32') {
            this.firstTerminal.sendText(`ssh devcloud${this._proxy === true ? ".proxy" : ""} > ${this.firstLog}`);
        }

        if (!await this.checkConnection(this.firstLog, this.firstTerminal)) {
               const message = "Failed to connect to head node. Possible fixes:\n\
    * Check your VPN status. Disconnect from any active VPN connections.\n\
    * Check your proxy in the extension settings.\n\
    * Check your Internet connection.\n\
    * Try to increase connection timeout in the extension settings.";
            
            vscode.window.showErrorMessage(message, { modal: true });
            this._terminalExitStatus = 0;

            return false;
        }
        return true;
    }

    private async connectToSpecificNode(): Promise<boolean> {
        if (!await this.getNodeName()) {
            return false;
        }

        const message = 'DEVCLOUD SERVICE TERMINAL. Do not close this terminal while working in the DevCloud. Do not type anything in this terminal';
        const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh -o StrictHostKeyChecking=no ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}"` : undefined;
        this.secondTerminal = vscode.window.createTerminal({ name: `devcloudService2 - do not close`, shellPath: this._shellPath, shellArgs: secondShellArgs, message: message });


        if (process.platform !== 'win32') {
            this.secondTerminal.sendText(`ssh -o StrictHostKeyChecking=no ${this.nodeName?.concat(`.aidevcloud`)} > ${this.secondLog}`);
        }

        if (!await this.checkConnection(this.secondLog, this.secondTerminal)) {
            if(this._isCancelled === true){
                this._isCancelled = false;
                return false;
            }
            vscode.window.showErrorMessage("Failed to create tunnel to compute node. Possible fixes:\n\n\
    * Increase connection timeout in the extension settings.\n\
    * Try to choose another device in the extension settings.", { modal: true });
            return false;
        }
        this._isConnected = true;
        return true;
    }

    private async createNodeTerminal(): Promise<boolean> {
        if (this._isConnected) {
            const message = 'Please wait...';
            const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh ${this.nodeName?.concat(`.aidevcloud`)}"` : undefined;
            this.devCloudTerminal = vscode.window.createTerminal({ name: `DevCloudWork: ${this.nodeName}`, shellPath: this._shellPath, shellArgs: secondShellArgs, message: message });

            if (process.platform !== 'win32') {
                this.devCloudTerminal.sendText(`ssh ${this.nodeName?.concat(`.aidevcloud`)}`);
            }
        }
        else {
            vscode.window.showErrorMessage('There is no active connection to DevCloud');
        }
        this.devCloudTerminal.show();

        return true;
    }

    private async createInteractiveJob(): Promise<boolean> {
        const qsubOptions = `qsub -I -l nodes=1:${this._nodeDevice}:ppn=2 ${this._jobTimeout !== undefined ? `-l walltime=${this._jobTimeout}` : ``} -N vscode`;
       this.firstTerminal.sendText(`\n`);  //Do not remove, this is bug fix
        this.firstTerminal.sendText(qsubOptions);
        this.firstTerminal.sendText(`\n`); //Do not remove, this is bug fix
        this.firstTerminal.sendText(`qstat -f`); 

        if (!await this.getJobID(this.firstLog)) {
            vscode.window.showErrorMessage("Failed to create interactive job. Possible reasons:\n\n\
* There is no free node with requested device. Try to choose another device in the extension settings\n\
* The job in PBS queue. CHECK status of your jobs in the terminal below\n", { modal: true });
            //TODO: prompt qstat
            await this.qstat();
            return false;
        }
        return true;
    }

    private async qstat(): Promise<void> {
        const args = process.platform === 'win32' ? `-i -l -c "ssh devcloud${this._proxy === true ? ".proxy" : ""}` : undefined;
        this.qstatTerminal = vscode.window.createTerminal({ name: `qstat `, shellPath: this._shellPath, shellArgs: args });
        if (process.platform !== 'win32') {
            this.qstatTerminal.sendText(`ssh devcloud${this._proxy === true ? ".proxy" : ""}`);
        }
        this.qstatTerminal.sendText('qstat -a');
        this.qstatTerminal.show();
    }

    private async setShell(): Promise<boolean> {
        if (process.platform === 'win32') {
            if (!this._cygwinPath || !existsSync(this._cygwinPath)) {
                return false;
            }
            this._shellPath = join(this._cygwinPath, `bin`, `bash.exe`);
        } else {
            this._shellPath = '/bin/bash';
        }
        if (!existsSync(this._shellPath)) {
            vscode.window.showErrorMessage(`Failed to find a shell binary. Path:${this._shellPath}\n Install shell binary if it is not found.`, { modal: true });
            return false;
        }

        return true;
    }

    private async installCygwin(): Promise<boolean> {
        if ((process.platform === 'win32') && (!this._cygwinPath || !existsSync(this._cygwinPath))) {
            const message = "Path to the Cygwin folder specified in the extension settings is invalid.\n\
Specify correct path or install Cygwin. Then run Setup Connection command again.\n\n\
To install Cygwin?";
            const selection = await vscode.window.showErrorMessage(message, { modal: true }, 'Yes', 'No');
            if (selection === 'Yes') {
                const path = join(tmpdir(), 'install_cygwin.bat');
                execSync(`powershell -Command "[System.Net.ServicePointManager]::SecurityProtocol ='Tls12';Invoke-WebRequest https://devcloud.intel.com/oneapi/static/assets/install_cygwin.bat -OutFile ${path}"`);
                const installTerminal = vscode.window.createTerminal({ name: `Install Cygwin` });
                installTerminal.show();
                installTerminal.sendText(path);                
            }
            if (selection === 'No'){
                return false;
            }
        }
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
            if (process.platform === 'win32' && this._cygwinPath) {
                res = readFileSync(join(this._cygwinPath, path)).toString();
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
            vscode.window.showErrorMessage("Failed to create log files.", { modal: true });
            return false;
        }
        return true;
    }

    private createLogFiles(): boolean {
        try {
            this.firstLog = execSync(`${this._shellPath} -i -l -c "mktemp /tmp/devcloud.log1.XXXXXX.txt"`).toString().replace('\n', '');
            const ind = this.firstLog.indexOf(`/tmp/devcloud.log1`);
            const val = this.firstLog.substr(ind + 0);
            this.firstLog = val;

            this.secondLog = execSync(`${this._shellPath} -i -l -c "mktemp /tmp/devcloud.log2.XXXXXX.txt"`).toString().replace('\n', '');
            const ind2 = this.secondLog.indexOf(`/tmp/devcloud.log2`);
            const val2 = this.secondLog.substr(ind2 + 0);
            this.secondLog = val2;

            this.fingerprintLog = execSync(`${this._shellPath} -i -l -c "mktemp /tmp/devcloud.fingerprintLog.XXXXXX.txt"`).toString().replace('\n', '');
            const ind3 = this.fingerprintLog.indexOf(`/tmp/devcloud.fingerprintLog`);
            const val3 = this.fingerprintLog.substr(ind3 + 0);
            this.fingerprintLog = val3;

            return true;
        }
        catch (err) {
            return false;
        }
    }

    private removeTmpFiles(): boolean {
        if (!this.removeLogFiles()) {
            return false;
        }
        return true;
    }

    private removeLogFiles(): boolean {
        try {
            execSync(`${this._shellPath} -i -l -c "rm ${this.firstLog}"`);
            execSync(`${this._shellPath} -i -l -c "rm ${this.secondLog}"`);
            execSync(`${this._shellPath} -i -l -c "rm ${this.fingerprintLog}"`);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    private async checkConnection(pathToLog: string, terminal: vscode.Terminal): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern = (terminal === this.firstTerminal || terminal === this.fingerprintTerminal) ? `${this.userName}@` : `@${this.nodeName}`;
                const log = this.getLog(pathToLog);
                if (log) {
                    const ind = log.match(checkPattern);
                    if (ind !== undefined) {
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
                if (terminal === this.firstTerminal) {
                    if (this._terminalExitStatus === 255) {
                        resolve(false);
                    }
                }
                if (terminal === this.fingerprintTerminal) {
                    if (this._fterminalExitStatus === 255) {
                        resolve(false);
                    }                        
                }
                if(this._isCancelled === true){
                    this.secondTerminal?.dispose();
                    resolve(false);
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

    private async walltimeCheck(initTime: number): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
            const currentTime = new Date().getTime();
            const currentSessionTime = (currentTime - initTime);
            const st1 = (Number(this._sessionTime) - 2*Number(this._connectionTimeout));
            if(this._isConnected === false){
                clearInterval(timerId);
                resolve(false);
            }
            if(currentSessionTime > st1){
                clearInterval(timerId);
                resolve(false);
            }
            }, 1000);
            
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, this._sessionTime);
        });
    }
    private async getUserNameFromConfig(config: string): Promise<boolean> {
        const idx1 = config.indexOf(`Host devcloud`);
        if (idx1 < 0) {
            vscode.window.showErrorMessage(`Your SSH config file does not contain a "devcloud" host alias. Confirm that you have downloaded and configured your SSH config file for use with the Intel oneAPI DevCloud. For detailed instructions, see: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/ `, { modal: true });
            return false;
        }
        const idx2 = config.indexOf(`User`, idx1);
        const idx3 = config.indexOf('\n', idx2);

        this.userName = config.substring(idx2, idx3).replace('User', '').trim();
        return true;
    }

    private checkJobTimeoutFormat(value: string | undefined): boolean {
        if (value === undefined) {
            return true;
        }
        const splited = value.split(':');
        if (splited.length !== 3) {
            vscode.window.showErrorMessage("Invalid session timeout format. Use the following format: hh:mm:ss");
            return false;
        }
        const hh = Number(splited[0]);
        const mm = Number(splited[1]);
        const ss = Number(splited[2]);
        if (isNaN(hh) || isNaN(mm) || isNaN(ss)) {
            vscode.window.showErrorMessage("Invalid session timeout value. hh,mm,ss must be positive integers");
            return false;
        }
        if (hh < 0 || mm < 0 || ss < 0 || hh > 24 || mm > 59 || ss > 59) {
            vscode.window.showErrorMessage("Invalid session timeout value. hh,mm,ss must be positive integers, where \
            ss and mm take values from 0 to 59, and hh from 0 to 24");
            return false;
        }
        if (hh === 24 && mm !== 0 && ss !== 0) {
            vscode.window.showErrorMessage("Invalid session timeout value. Max time is 24h, so the only valid entry for\
             hh = 24 is 24:00:00");
            return false;
        }
        this._sessionTime = (hh*3600 + mm*60 + ss)*1000;
        if(this._sessionTime < (3*Number(this._connectionTimeout))){
            vscode.window.showErrorMessage(`Session timeout must be more than ${3*Number(this._connectionTimeout)/1000} sec`);
            return false;
        }
        return true;
    }
}
