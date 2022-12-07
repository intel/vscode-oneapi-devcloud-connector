/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 *
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { exec, execSync } from 'child_process';
import { join } from 'path';
import { SshConfigUtils } from './utils/ssh_config';
import { addDevCloudTerminalProfile, removeDevCloudTerminalProfile } from './utils/other';
import { devcloudName } from './utils/constants';
import { ExtensionSettings } from './utils/extension_settings';
import { Shell } from './utils/shell';
import { ComputeNodeSelector } from './utils/compute_node_selector';
import { AbortControllerWrap } from './utils/abort_controller_wrap';


interface QstatInfo {
    jobID: string,
    nodeName: string
}
export class DevConnect {
    public isConnected: boolean;
    public isCancelled: boolean;

    private static instance: DevConnect;

    private serviceTerminal!: vscode.Terminal;
    private fingerprintTerminal!: vscode.Terminal;
    private _terminalExitStatus: number | undefined;
    private computeNodeLog!: string;
    private fingerprintLog!: string;

    private userName!: string;
    private nodeName!: string;
    private tunnelJobID: string;
    private sshConfigUtils!: SshConfigUtils;
    private sessionTime: number | undefined;

    private statusBarItem: vscode.StatusBarItem;

    public static getInstance() {
        if (!this.instance) {
            this.instance = new DevConnect();
        }
        return this.instance;

    }
    private constructor() {
        this.tunnelJobID = "";
        this.isConnected = false;
        this.isCancelled = false;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.statusBarItem.text = `Not connected to ${devcloudName}`;
        this.statusBarItem.tooltip = `${devcloudName} connection status`;
        if ((process.platform === 'win32') || (process.platform === 'linux')) {
            this.statusBarItem.show();
        }
    }

    public set terminalExitStatus(terminalExitStatus: number | undefined) {
        this._terminalExitStatus = terminalExitStatus;
    }

    public async setupConnection(): Promise<void> {
        if (!this.checkPlatform()) {
            return;
        }
        AbortControllerWrap.refresh();
        if (this.isConnected) {
            vscode.window.showErrorMessage(`You have already connected to ${devcloudName}.\nTo close current connection type Ctrl+Shift+P and choose "${devcloudName}: Close connection"`, { modal: true });
            return;
        }
        await ExtensionSettings.refresh();
        if (ExtensionSettings._clusterFullName === `NDA ${devcloudName}`) {
            vscode.window.showWarningMessage(`You are trying to connect to NDA ${devcloudName}. Make sure you have access.`);
        }

        if (!await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${ExtensionSettings._clusterFullName}`,
            cancellable: true
        }, async (_progress, token) => {
            token.onCancellationRequested(async () => {
                this.isCancelled = true;
                this.fingerprintTerminal?.dispose();
                this.serviceTerminal?.dispose();
                AbortControllerWrap.abort();
                return false;
            });
            _progress.report({ message: "Initialization ..." });
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (!await this.init()) {
                return false;
            }
            try {
                if (!await this.sshConfigUtils.checkKnownHosts()) {
                    _progress.report({ message: "SSH fingerprint verification ..." });
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    vscode.window.showInformationMessage("To create ssh fingerprint, type 'yes' in the terminal below", { modal: true });
                    if (!await this.getFingerprint()) {
                        this.fingerprintTerminal?.dispose();
                        return false;
                    }
                }
            } catch (e) {
                if (e instanceof Error) {
                    vscode.window.showErrorMessage(`Failed to verify fingerprints:\n${e.message}`, { modal: true });
                    return false;
                }
            }

            _progress.report({ message: "Connecting to compute node ..." });
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (!await ComputeNodeSelector.init()) {
                if (this.isCancelled === true) {
                    this.isCancelled = false;
                    return false;
                }
                const errorMessage = `Failed to create tunnel to compute node. Possible fixes:\n\
                * Check your proxy in the extension settings.\n\
                * Check your internet connection.\n\
                * Increase connection timeout in the extension settings.\n\
                ${ExtensionSettings._cluster === 'v-qsvr-nda' ? '* Make sure you have access to NDA DevCloud' : ''}`;
                vscode.window.showErrorMessage(errorMessage, { modal: true });
                return false;
            }

            if (!await this.connectToComputeNode()) {
                if (this.tunnelJobID !== "") {
                    this.killJob(this.tunnelJobID);
                }

                this.serviceTerminal?.dispose();

                if (this.isCancelled === true) {
                    this.isCancelled = false;
                    return false;
                }

                const errorMessage = `Failed to create tunnel to compute node. Possible fixes:\n\
                * Check your proxy in the extension settings.\n\
                * Check your internet connection.\n\
                * Increase connection timeout in the extension settings.\n\
                ${ExtensionSettings._cluster === 'v-qsvr-nda' ? '* Make sure you have access to NDA DevCloud' : ''}`;
                vscode.window.showErrorMessage(errorMessage, { modal: true });
                return false;
            }

            this.isConnected = true;
            await addDevCloudTerminalProfile(this.nodeName, Shell.shellPath);
            this.statusBarItem.text = `Connected to ${ExtensionSettings._clusterFullName}`;
            return true;
        })) {
            return;
        }

        if (!vscode.env.remoteName) {
            vscode.commands.executeCommand('opensshremotes.openEmptyWindow', { host: "devcloud-vscode" });
        }
        this.removeLogFiles();

        const initTime = new Date().getTime();
        if (! await this.walltimeCheck(initTime)) {
            if (this.isConnected === false) {
                return;
            }
            vscode.window.showInformationMessage('The session time out. Connection will be closed.', { modal: true });
            this.closeConnection();
        }
        return;
    }

    public async closeConnection(): Promise<void> {
        if (!this.checkPlatform()) {
            return;
        }
        if (!this.isConnected) {
            vscode.window.showInformationMessage(`There is no active connection to ${devcloudName}`);
            return;
        }
        else {
            this.killJob(this.tunnelJobID);
            this.serviceTerminal?.dispose();
            this.fingerprintTerminal?.dispose();
            this.disposeWorkTerminals();

            this.isConnected = false;
            await removeDevCloudTerminalProfile();
            this.statusBarItem.text = `Not connected to ${devcloudName}`;

            vscode.window.showInformationMessage(`Connection to ${devcloudName} closed.`);
            return;
        }
    }

    public async createDevCloudTerminal(): Promise<void> {
        if (!this.checkPlatform()) {
            return;
        }
        this.createNodeTerminal();
        return;
    }

    public getHelp(): void {
        const devCloudHelp = `${devcloudName} Help`;
        vscode.window.showInformationMessage(`Click here for more information.`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }

    private async init(): Promise<boolean> {
        if (!this.setSessionTime()) {
            return false;
        }
        if (!await Shell.init()) {
            return false;
        }
        if (!await (this.setSshConfigUtils())) {
            return false;
        }
        if (!this.createLogFiles()) {
            return false;
        }
        if (!await this.getUserNameFromConfig()) {
            return false;
        }
        return true;
    }

    private async setSshConfigUtils(): Promise<boolean> {
        this.sshConfigUtils = new SshConfigUtils();
        if (!await this.sshConfigUtils.createSshConfig()) {
            return false;
        }
        return true;
    }

    private async getFingerprint(): Promise<boolean> {
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}"` : undefined;
        const message = 'Please wait...';

        this.fingerprintTerminal = vscode.window.createTerminal({ name: `HeadNode terminal`, shellPath: Shell.shellPath, shellArgs: firsrtShellArgs, message: message });
        this.fingerprintTerminal.show();
        if (process.platform !== 'win32') {
            this.fingerprintTerminal.sendText(`ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}`);
        }
        if (!await this.checkConnection(this.fingerprintLog, "head")) {
            if (this.isCancelled === true) {
                this.isCancelled = false;
                return false;
            }
            const message = "Failed to create an ssh fingerprint. Possible fixes:\n\
            * Check your proxy in the extension settings.\n\
            * Check your Internet connection.\n\
            * Try to increase connection timeout in the extension settings.";
            vscode.window.showErrorMessage(message, { modal: true }, "Open Terminal log").then(async selection => {
                if (selection) {
                    const path = process.platform === 'win32' && ExtensionSettings._cygwinPath ? join(ExtensionSettings._cygwinPath, this.fingerprintLog) : this.fingerprintLog;
                    const logfile = await vscode.workspace.openTextDocument(path);
                    await vscode.window.showTextDocument(logfile);
                }
            });
            return false;
        }
        return true;
    }

    private async connectToComputeNode(): Promise<boolean> {
        if (!await this.setupTunnel()) {
            return false;
        }
        const message = `DEVCLOUD SERVICE TERMINAL. Do not close this terminal while working in the ${devcloudName}. Do not type anything in this terminal.`;
        const shellArgs = process.platform === 'win32' ? `-i -l -c "ssh -o StrictHostKeyChecking=no ${this.nodeName.concat(`.aidevcloud`)} > ${this.computeNodeLog}"` : undefined;
        this.serviceTerminal = vscode.window.createTerminal({ name: `devcloudService - do not close`, shellPath: Shell.shellPath, shellArgs: shellArgs, message: message });
        if (process.platform !== 'win32') {
            this.serviceTerminal.sendText(`ssh -o StrictHostKeyChecking=no ${this.nodeName.concat(`.aidevcloud`)} > ${this.computeNodeLog}`);
        }
        if (!await this.checkConnection(this.computeNodeLog, "compute")) {
            return false;
        }
        return true;
    }

    private async setupTunnel(): Promise<boolean> {

        let qstat: QstatInfo = await this.getActiveTunnelNodeInfo();
        if (qstat.jobID !== "--") {
            this.killJob(qstat.jobID);
        }
        if (!await this.submitNonInteractiveJob()) {
            console.error("submitNonInteractiveJob failed");
            return false;
        }
        qstat = await this.getActiveTunnelNodeInfo();
        if (qstat.nodeName === "--") {
            console.error("getActiveTunnelNodeInfo failed. job in queue");
            return false;
        }

        this.nodeName = qstat.nodeName;
        return true;
    }

    private killJob(jobID: string): boolean {
        exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} qdel ${jobID}.${ExtensionSettings._cluster}.aidevcloud"`);
        return true;
    }

    private async submitNonInteractiveJob(): Promise<boolean> {
        try {
            const computeNodeProperties = await ComputeNodeSelector.selectComputeNode();
            return await new Promise((resolve, _reject) => {
                exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} 'echo \\#\\!/bin/bash > ~/tmp/vscodeTunnelJob.sh && echo sleep 99999 >> ~/tmp/vscodeTunnelJob.sh && qsub -q batch@${ExtensionSettings._cluster} -l nodes=1:${computeNodeProperties}:ppn=2 ${ExtensionSettings._jobTimeout !== undefined ? ` -l walltime=${ExtensionSettings._jobTimeout}` : ``} -N vscodeTunnelJob -d . ~/tmp/vscodeTunnelJob.sh' "`,
                    { signal: AbortControllerWrap.signal() },
                    (_error, stdout, _stderr) => {
                        const matchJobID = stdout.match(/(\d*).v-qsvr-(1|nda|fpga).aidevcloud/i);
                        if (!matchJobID) {
                            resolve(false);
                        } else {
                            this.tunnelJobID = matchJobID[1];
                            resolve(true);
                        }
                    });
            });
        }
        catch (e) {
            console.error(e);
            return false;
        }
    }

    private async getActiveTunnelNodeInfo(): Promise<QstatInfo> {
        try {
            const qstat: string = await new Promise((resolve, _reject) => {
                exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} qstat -s batch@${ExtensionSettings._cluster} -n -1"`,
                    { signal: AbortControllerWrap.signal() },
                    (_error, stdout, _stderr) => {
                        resolve(stdout);
                    });
            }); if (qstat === "") {
                return ({ jobID: "--", nodeName: "--" });
            }
            const tunnelJobMatch = qstat.match(/(\d*).v-qsvr-(1|nda|fpga).\w*\s*u\d*\s*batch\s*vscodeTunnelJob\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d{2}:\d{2}:\d{2})\s*\w\s*((--)|\d{2}:\d{2}:\d{2})\s*((--)|s\d{3}-n\d{3})/i);
            return tunnelJobMatch !== null ? { jobID: tunnelJobMatch[1], nodeName: tunnelJobMatch[15] } : { jobID: "--", nodeName: "--" };
        }
        catch (e) {
            console.error(e);
            return { jobID: "--", nodeName: "--" };
        }
    }

    private async createNodeTerminal(): Promise<boolean> {
        if (this.isConnected) {
            const message = 'Please wait...';
            const secondShellArgs = process.platform === 'win32' ? `-i -l -c "ssh ${this.nodeName.concat(`.aidevcloud`)}"` : undefined;
            const devCloudTerminal = vscode.window.createTerminal({ name: `DevCloudWork: ${this.nodeName}`, shellPath: Shell.shellPath, shellArgs: secondShellArgs, message: message });
            if (process.platform !== 'win32') {
                devCloudTerminal.sendText(`ssh ${this.nodeName.concat(`.aidevcloud`)}`);
            }
            devCloudTerminal.show();
        }
        else {
            vscode.window.showErrorMessage(`There is no active connection to ${devcloudName}`);
            return false;
        }

        return true;
    }

    private getLog(path: string): string | undefined {
        let res = undefined;
        try {
            if (process.platform === 'win32' && ExtensionSettings._cygwinPath) {
                res = readFileSync(join(ExtensionSettings._cygwinPath, path)).toString();
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

    private createLogFiles(): boolean {
        try {
            this.computeNodeLog = execSync(`${Shell.shellPath} -l -c "mktemp /tmp/devcloud.computeNodeLog.XXXXXX.txt"`).toString().replace('\n', '');
            const ind2 = this.computeNodeLog.indexOf(`/tmp/devcloud.computeNodeLog`);
            const val2 = this.computeNodeLog.substring(ind2);
            this.computeNodeLog = val2;

            this.fingerprintLog = execSync(`${Shell.shellPath} -l -c "mktemp /tmp/devcloud.fingerprintLog.XXXXXX.txt"`).toString().replace('\n', '');
            const ind3 = this.fingerprintLog.indexOf(`/tmp/devcloud.fingerprintLog`);
            const val3 = this.fingerprintLog.substring(ind3);
            this.fingerprintLog = val3;

            return true;
        }
        catch (err) {
            vscode.window.showErrorMessage("Failed to create log files.", { modal: true });
            return false;
        }
    }

    private removeLogFiles(): boolean {
        try {
            execSync(`${Shell.shellPath} -l -c "rm ${this.computeNodeLog}"`);
            execSync(`${Shell.shellPath} -l -c "rm ${this.fingerprintLog}"`);
            return true;
        }
        catch (err) {
            return false;
        }
    }

    private async checkConnection(pathToLog: string, node: "compute" | "head"): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern = (node === "head") ? `${this.userName}@` : `@${this.nodeName}`;
                const log = this.getLog(pathToLog);
                if (log) {
                    const ind = log.match(checkPattern);
                    if (ind !== undefined) {
                        clearInterval(timerId);
                        resolve(true);
                    }
                }
                if (node === "head") {
                    if (this._terminalExitStatus === 255) {
                        resolve(false);
                    }
                }
                if (this.isCancelled === true) {
                    resolve(false);
                }

            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, ExtensionSettings._connectionTimeout);
        });
    }

    private async walltimeCheck(initTime: number): Promise<boolean> {
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const currentTime = new Date().getTime();
                const currentSessionTime = (currentTime - initTime);
                const st1 = (Number(this.sessionTime) - 2 * Number(ExtensionSettings._connectionTimeout));
                if (this.isConnected === false) {
                    clearInterval(timerId);
                    resolve(false);
                }
                if (currentSessionTime > st1) {
                    clearInterval(timerId);
                    resolve(false);
                }
            }, 1000);

            setTimeout(() => {
                clearInterval(timerId);
                resolve(false);
            }, this.sessionTime);
        });
    }

    private async getUserNameFromConfig(): Promise<boolean> {
        const config = await this.sshConfigUtils.readSshConfig();
        if (!config) {
            vscode.window.showErrorMessage('Could not find the SSH configuration file.');
            return false;
        }
        const idx1 = config.indexOf(`Host devcloud`);
        if (idx1 < 0) {
            vscode.window.showErrorMessage(`Your SSH config file does not contain a "devcloud" host alias. Confirm that you have downloaded and configured your SSH config file for use with the ${devcloudName}. For detailed instructions, see: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/ `, { modal: true });
            return false;
        }
        const idx2 = config.indexOf(`User`, idx1);
        const idx3 = config.indexOf('\n', idx2);

        this.userName = config.substring(idx2, idx3).replace('User', '').trim();
        return true;
    }

    private setSessionTime(): boolean {
        const splited = ExtensionSettings._jobTimeout?.split(`:`);
        if (!splited) {
            return false;
        }
        const hh = Number(splited[0]);
        const mm = Number(splited[1]);
        const ss = Number(splited[2]);
        this.sessionTime = (hh * 3600 + mm * 60 + ss) * 1000;
        if (this.sessionTime < (3 * Number(ExtensionSettings._connectionTimeout))) {
            vscode.window.showErrorMessage(`Session timeout must be more than ${3 * Number(ExtensionSettings._connectionTimeout) / 1000} sec`);
            return false;
        }
        return true;
    }

    private disposeWorkTerminals() {
        for (const t of vscode.window.terminals) {
            if (t.name.indexOf('DevCloudWork:') !== -1) {
                t.dispose();
            }
        }
        return;
    }

    private checkPlatform(): boolean {
        if ((process.platform !== 'win32') && (process.platform !== 'linux')) {
            vscode.window.showErrorMessage(`Failed to activate the '${devcloudName} Connector for Intel oneAPI Toolkits' extension. The extension is only supported on Linux and Windows.`, { modal: true });
            return false;
        }
        return true;
    }
}
