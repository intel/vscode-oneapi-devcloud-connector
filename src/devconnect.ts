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
import { Logger } from './utils/logger';


const logger = Logger.getInstance();

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
        this.sshConfigUtils = new SshConfigUtils();
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
        logger.info("setupConnection()");
        try {
            if (this.isConnected) {
                throw Error(`You have already connected to ${devcloudName}.\nTo close current connection type Ctrl+Shift+P and choose "${devcloudName}: Close connection"`);
            }
            this.checkPlatform();
            AbortControllerWrap.refresh();
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
                    logger.debug("setupConnection() - canceled");
                    return false;
                });
                _progress.report({ message: "Initialization ..." });
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.init();
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
                        throw Error(`Failed to verify fingerprints:\n${e.message}`);
                    }
                }

                _progress.report({ message: "Connecting to compute node ..." });
                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    await ComputeNodeSelector.init();
                } catch (e) {
                    if (this.isCancelled === true) {
                        this.isCancelled = false;
                        return false;
                    }
                    const errorMessage = `Failed to create tunnel to compute node.\n\
                ${e} \n\
                Possible fixes:\n\
                * Check your proxy in the extension settings.\n\
                * Check your internet connection.\n\
                * Increase connection timeout in the extension settings.\n\
                ${ExtensionSettings._cluster === 'v-qsvr-nda' ? '* Make sure you have access to NDA DevCloud' : ''}`;

                    vscode.window.showErrorMessage(errorMessage, { modal: true });
                    logger.error("setupConnection() - failed");
                    return false;
                }

                try {
                    await this.connectToComputeNode();
                }
                catch (e) {
                    if (this.tunnelJobID !== "") {
                        this.killJob(this.tunnelJobID);
                    }

                    this.serviceTerminal?.dispose();

                    if (this.isCancelled === true) {
                        this.isCancelled = false;
                        logger.debug("setupConnection() - canceled");
                        return false;
                    }

                    const errorMessage = `Failed to create tunnel to compute node. Possible fixes:\n\
                * Check your proxy in the extension settings.\n\
                * Check your internet connection.\n\
                * Increase connection timeout in the extension settings.\n\
                ${ExtensionSettings._cluster === 'v-qsvr-nda' ? '* Make sure you have access to NDA DevCloud' : ''}`;
                    vscode.window.showErrorMessage(errorMessage, { modal: true });
                    logger.error("setupConnection() - failed");
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
                logger.debug("setupConnection() - closed by timeout");
            }
            return;
        }
        catch (e) {
            logger.error("setupConnection() - failed");
            vscode.window.showErrorMessage((e as Error).message, { modal: true });
            return;
        }
    }

    public async closeConnection(): Promise<void> {
        logger.info("closeConnection()");
        try {
            this.checkPlatform();
            if (!this.isConnected) {
                logger.info("closeConnection() - no active connection");
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
        } catch (e) {
            logger.error("closeConnection() - failed");
            vscode.window.showErrorMessage(`Failed to close connection to ${devcloudName}:\n    ${(e as Error).message}`, { modal: true });
        }
    }

    public async createDevCloudTerminal(): Promise<void> {
        logger.info("createDevCloudTerminal()");
        try {
            this.checkPlatform();
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
                throw Error(`There is no active connection to ${devcloudName}`);
            }
        } catch (e) {
            logger.error("createDevCloudTerminal() - failed");
            vscode.window.showErrorMessage(`Failed to create ${devcloudName} terminal:\n    ${(e as Error).message}`, { modal: true });
        }
    }

    public getHelp(): void {
        logger.info("getHelp()");
        const devCloudHelp = `${devcloudName} Help`;
        vscode.window.showInformationMessage(`Click here for more information.`, devCloudHelp).then(selection => {
            if (selection) {
                vscode.env.openExternal(vscode.Uri.parse(`https://devcloud.intel.com/oneapi/get_started/`));
            }
        });
    }

    public openLogFile(): void {
        const pathUri = vscode.Uri.file(Logger.getLogPath());
        vscode.window.showTextDocument(pathUri);
        return;
    }

    private async init(): Promise<void> {
        logger.debug("DevConnect.init()");
        this.setSessionTime();
        await Shell.init();
        await this.sshConfigUtils.init();
        await this.getUserNameFromConfig();
        this.createLogFiles();
    }

    private async getFingerprint(): Promise<boolean> {
        logger.debug("getFingerprint()");
        const firsrtShellArgs = process.platform === 'win32' ? `-i -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}"` : undefined;
        const message = 'Please wait...';

        this.fingerprintTerminal = vscode.window.createTerminal({ name: `HeadNode terminal`, shellPath: Shell.shellPath, shellArgs: firsrtShellArgs, message: message });
        this.fingerprintTerminal.show();
        if (process.platform !== 'win32') {
            this.fingerprintTerminal.sendText(`ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} > ${this.fingerprintLog}`);
        }
        try {
            await this.checkConnection(this.fingerprintLog, "head");
        } catch (e) {
            if (this.isCancelled === true) {
                this.isCancelled = false;
                logger.debug("getFingerprint() - canceled");
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
            logger.error("getFingerprint() - failed");
            return false;
        }
        return true;
    }

    private async connectToComputeNode(): Promise<void> {
        logger.debug("connectToComputeNode()");
        try {
            await this.setupTunnel();
            const message = `DEVCLOUD SERVICE TERMINAL. Do not close this terminal while working in the ${devcloudName}. Do not type anything in this terminal.`;
            const shellArgs = process.platform === 'win32' ? `-i -l -c "ssh -o StrictHostKeyChecking=no ${this.nodeName.concat(`.aidevcloud`)} > ${this.computeNodeLog}"` : undefined;
            this.serviceTerminal = vscode.window.createTerminal({ name: `devcloudService - do not close`, shellPath: Shell.shellPath, shellArgs: shellArgs, message: message });
            if (process.platform !== 'win32') {
                this.serviceTerminal.sendText(`ssh -o StrictHostKeyChecking=no ${this.nodeName.concat(`.aidevcloud`)} > ${this.computeNodeLog}`);
            }
            await this.checkConnection(this.computeNodeLog, "compute");
        }
        catch (e) {
            if (this.isCancelled === true) {
                this.isCancelled = false;
                logger.debug("connectToComputeNode() - canceled");
                return;
            }
            logger.error("connectToComputeNode() - failed");
            throw Error(`Connection to compute node failed:\n   ${(e as Error).message}`);
        }
    }

    private async setupTunnel(): Promise<void> {
        logger.debug("setupTunnel()");
        try {
            let qstat: QstatInfo = await this.getActiveTunnelNodeInfo();
            if (qstat.jobID !== "--") {
                this.killJob(qstat.jobID);
            }
            await this.submitNonInteractiveJob();

            qstat = await new Promise(resolve => {
                const timerQstat = setInterval(async () => {
                    const tmp = await this.getActiveTunnelNodeInfo();
                    if (tmp.nodeName !== "--") {
                        clearInterval(timerQstat);
                        resolve(tmp);
                    }
                    return;
                }, 2000);
                setTimeout(() => {
                    clearInterval(timerQstat);
                    resolve({ jobID: "--", nodeName: "--" });
                }, 30000);
            });

            if (qstat.nodeName === "--") {
                throw Error('The created job for the tunnel has been queued');
            }
            this.nodeName = qstat.nodeName;
        } catch (e) {
            logger.error("setupTunnel() - failed.");
            throw Error(`Failed to setup tunnel:\n    ${(e as Error).message}`);
        }
    }

    private killJob(jobID: string): void {
        logger.debug(`killJob( jobID:${jobID} )`);
        try {
            exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} qdel ${jobID}.${ExtensionSettings._cluster}.aidevcloud"`);
        }
        catch (e) {
            logger.error(`Failed to kill job:\n    ${(e as Error).message}`);
        }
    }

    private async submitNonInteractiveJob(): Promise<void> {
        logger.debug("submitNonInteractiveJob()");
        const computeNodeProperties = await ComputeNodeSelector.selectComputeNode();
        return await new Promise((resolve) => {
            exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} 'echo \\#\\!/bin/bash > ~/tmp/vscodeTunnelJob.sh && echo sleep 99999 >> ~/tmp/vscodeTunnelJob.sh && qsub -q batch@${ExtensionSettings._cluster} -l nodes=1:${computeNodeProperties}:ppn=2 ${ExtensionSettings._jobTimeout !== undefined ? ` -l walltime=${ExtensionSettings._jobTimeout}` : ``} -N vscodeTunnelJob -d . ~/tmp/vscodeTunnelJob.sh' "`,
                { signal: AbortControllerWrap.signal() },
                (_error, stdout, _stderr) => {
                    if (_error) {
                        logger.fatal(`Failed to submit non interactive job:\n\    ${_error.message}`);
                    }
                    const matchJobID = stdout.match(/(\d*).v-qsvr-(1|nda|fpga).aidevcloud/i);
                    if (!matchJobID) {
                        logger.error("submitNonInteractiveJob() - failed");
                        throw Error("Failed to submit non interactive job");
                    } else {
                        this.tunnelJobID = matchJobID[1];
                        resolve();
                    }
                });
        });
    }

    private async getActiveTunnelNodeInfo(): Promise<QstatInfo> {
        logger.debug("getActiveTunnelNodeInfo()");
        const qstat: string = await new Promise((resolve, _reject) => {
            exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} qstat -s batch@${ExtensionSettings._cluster} -n -1"`,
                { signal: AbortControllerWrap.signal() },
                (_error, stdout, _stderr) => {
                    if (_error) {
                        logger.fatal(`Failed to fetch free compute nodes:\n\    ${_error.message}`);
                    }
                    resolve(stdout);
                });
        }); if (qstat === "") {
            logger.debug("getActiveTunnelNodeInfo() - no tunnel job in queue");
            return ({ jobID: "--", nodeName: "--" } as QstatInfo);
        }
        const tunnelJobMatch = qstat.match(/(\d*).v-qsvr-(1|nda|fpga).\w*\s*u\d*\s*batch\s*vscodeTunnelJob\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d*)\s*((--)|\d{2}:\d{2}:\d{2})\s*\w\s*((--)|\d{2}:\d{2}:\d{2})\s*((--)|s\d{3}-n\d{3})/i);
        const res: QstatInfo = tunnelJobMatch !== null ? { jobID: tunnelJobMatch[1], nodeName: tunnelJobMatch[15] } : { jobID: "--", nodeName: "--" };
        logger.debug(`getActiveTunnelNodeInfo() - returned jobID:${res.jobID} nodeName:${res.nodeName}`);
        return res;
    }

    private getTerminalLog(path: string): string {
        logger.debug(`getTerminalLog( path:${path} )`);
        let res = "";
        try {
            if (process.platform === 'win32' && ExtensionSettings._cygwinPath) {
                res = readFileSync(join(ExtensionSettings._cygwinPath, path)).toString();
            }
            else {
                res = readFileSync(path).toString();
            }
            return res;
        }
        catch (e) {
            logger.error(`getTerminalLog( path:${path} ) - failed:\n    ${(e as Error).message}`);
            return res;
        }
    }

    private createLogFiles(): void {
        logger.debug("createLogFiles()");
        try {
            this.computeNodeLog = execSync(`${Shell.shellPath} -l -c "mktemp /tmp/devcloud.computeNodeLog.XXXXXX.txt"`).toString().replace('\n', '');
            const ind2 = this.computeNodeLog.indexOf(`/tmp/devcloud.computeNodeLog`);
            const val2 = this.computeNodeLog.substring(ind2);
            this.computeNodeLog = val2;

            this.fingerprintLog = execSync(`${Shell.shellPath} -l -c "mktemp /tmp/devcloud.fingerprintLog.XXXXXX.txt"`).toString().replace('\n', '');
            const ind3 = this.fingerprintLog.indexOf(`/tmp/devcloud.fingerprintLog`);
            const val3 = this.fingerprintLog.substring(ind3);
            this.fingerprintLog = val3;
        }
        catch (e) {
            logger.error(`createLogFiles() - failed:\n    ${(e as Error).message}`);
            throw Error(`Failed to create log files:\n    ${(e as Error).message}`);
        }
    }

    private removeLogFiles(): boolean {
        logger.debug("removeLogFiles()");
        try {
            execSync(`${Shell.shellPath} -l -c "rm ${this.computeNodeLog}"`);
            execSync(`${Shell.shellPath} -l -c "rm ${this.fingerprintLog}"`);
            return true;
        }
        catch (e) {
            logger.debug(`removeLogFiles() - failed:\n    ${(e as Error).message}`);
            return false;
        }
    }

    private async checkConnection(pathToLog: string, node: "compute" | "head"): Promise<void> {
        logger.debug(`checkConnection( pathToLog:${pathToLog}, node:${node} )`);
        return new Promise(resolve => {
            const timerId = setInterval(async () => {
                const checkPattern = (node === "head") ? `${this.userName}@` : `@${this.nodeName}`;
                const log = this.getTerminalLog(pathToLog);
                if (log) {
                    const ind = log.match(checkPattern);
                    if (ind !== undefined) {
                        clearInterval(timerId);
                        resolve();
                    }
                }
                if (node === "head") {
                    if (this._terminalExitStatus === 255) {
                        clearInterval(timerId);
                        logger.error(`checkConnection( pathToLog:${pathToLog}, node:${node} ) - failed:\n    Service terminal closed with error code 255`);
                        resolve();
                    }
                }
                if (this.isCancelled === true) {
                    clearInterval(timerId);
                    logger.error(`checkConnection( pathToLog:${pathToLog}, node:${node} ) - failed:\n    The connection has been closed.`);
                    resolve();
                }

            }, 1000);
            setTimeout(() => {
                clearInterval(timerId);
                resolve();
            }, ExtensionSettings._connectionTimeout);
        });
    }

    private async walltimeCheck(initTime: number): Promise<boolean> {
        logger.debug(`walltimeCheck( initTime:${initTime} )`);
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

    private async getUserNameFromConfig(): Promise<void> {
        logger.debug("getUserNameFromConfig()");
        try {
            const config = await this.sshConfigUtils.readSshConfig();
            const idx1 = config.indexOf(`Host devcloud`);
            if (idx1 < 0) {
                throw Error(`Your SSH config file does not contain a "devcloud" host alias. Confirm that you have downloaded and configured your SSH config file for use with the ${devcloudName}. For detailed instructions, see: https://devcloud.intel.com/oneapi/documentation/connect-with-vscode/ `);
            }
            const idx2 = config.indexOf(`User`, idx1);
            const idx3 = config.indexOf('\n', idx2);
            this.userName = config.substring(idx2, idx3).replace('User', '').trim();
        }
        catch (e) {
            logger.error(`getUserNameFromConfig() - failed :\n    ${(e as Error).message}`);
            throw e;
        }
    }

    private setSessionTime(): void {
        logger.debug("setSessionTime()");
        const splited = ExtensionSettings._jobTimeout?.split(`:`);
        const hh = Number(splited![0]);
        const mm = Number(splited![1]);
        const ss = Number(splited![2]);
        this.sessionTime = (hh * 3600 + mm * 60 + ss) * 1000;
        if (this.sessionTime < (3 * Number(ExtensionSettings._connectionTimeout))) {
            logger.error(`setSessionTime() failed - Session timeout must be more than ${3 * Number(ExtensionSettings._connectionTimeout) / 1000} sec. connectionTimeout=${ExtensionSettings._connectionTimeout}`);
            throw Error(`Session timeout must be more than ${3 * Number(ExtensionSettings._connectionTimeout) / 1000} sec`);
        }
    }

    private disposeWorkTerminals() {
        logger.debug("disposeWorkTerminals()");
        for (const t of vscode.window.terminals) {
            if (t.name.indexOf('DevCloudWork:') !== -1) {
                t.dispose();
            }
        }
        return;
    }

    private checkPlatform(): void {
        logger.debug("checkPlatform()");
        if ((process.platform !== 'win32') && (process.platform !== 'linux')) {
            throw Error(`Failed to activate the '${devcloudName} Connector for Intel oneAPI Toolkits' extension. The extension is only supported on Linux and Windows.`);
        }
    }
}
