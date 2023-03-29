/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { join, posix } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { isIP } from 'net';
import { devcloudName } from './constants';
import { Logger } from "./logger";

const logger = Logger.getInstance();
export class ExtensionSettings {
    public static _proxy: boolean | undefined;
    public static _proxyServer: string | undefined;
    public static _jobTimeout: string | undefined;
    public static _connectionTimeout: number | undefined;
    public static _cygwinPath: string | undefined;
    public static _cluster: string | undefined;
    public static _clusterFullName: string;

    public static async refresh(): Promise<void> {
        logger.debug("refresh()");
        this._clusterFullName = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>("choose_cluster") ?? `Public ${devcloudName}`;
        switch (this._clusterFullName) {
            case `Public ${devcloudName}`:
                this._cluster = "v-qsvr-1";
                break;
            case `NDA ${devcloudName}`:
                this._cluster = "v-qsvr-nda";
                break;
            case `FPGA ${devcloudName}`:
                this._cluster = "v-qsvr-fpga";
                break;
        }

        this._proxy = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<boolean>("proxy");
        this._proxyServer = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>("proxy_server");
        if (this._proxyServer?.length === 0) {
            this._proxyServer = undefined;
        }
        this._connectionTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<number>('connection_timeout');
        if (this._connectionTimeout === undefined || this._connectionTimeout < 0) {
            logger.warn("The Session Timeout value specified in the extension settings is incorrect.\n The default value of 30 seconds will be used");
            vscode.window.showWarningMessage("The Session Timeout value specified in the extension settings is incorrect.\n The default value of 30 seconds will be used");
            this._connectionTimeout = 30000;
        } else {
            this._connectionTimeout *= 1000;
        }
        this._jobTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('session_timeout');
        this._jobTimeout = this._jobTimeout?.replace(/\s/g, "");
        this._cygwinPath = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('cygwin_path');
        if (this._cygwinPath?.length === 0 || this._cygwinPath === undefined) {
            this._cygwinPath = undefined;
        } else {
            this._cygwinPath = posix.normalize(this._cygwinPath.replace(`\r`, "")).split(/[\\\/]/g).join(posix.sep);
        }
        logger.info(`\n\
        Extension settings:\n\
        proxy:${this._proxy}\n\
        proxyServer:${this._proxyServer}\n\
        jobTimeout: ${this._jobTimeout}\n\
        connectionTimeout: ${this._connectionTimeout}\n\
        cygwinPath: ${this._cygwinPath}\n\
        cluster: ${this._cluster}\n\
        clusterFullName:${this._clusterFullName}`);
    }

    public static async checkSettingsFormat(): Promise<void> {
        logger.debug("checkSettingsFormat()");
        this.checkProxyServer();
        this.checkJobTimeout();
        await this.checkCygwinPath();
    }

    private static checkProxyServer(): void {
        logger.debug("checkProxyServer()");
        if (this._proxy === true) {
            if (this._proxyServer !== undefined && this._proxyServer.length !== 0) {
                try {
                    new URL(this._proxyServer);
                }
                catch (_) {
                    const separatedProxy = this._proxyServer.split(':');
                    if (separatedProxy.length === 2) {
                        const ip = separatedProxy[0];
                        const port = separatedProxy[1];
                        if (isIP(ip) && !isNaN(Number(port))) {
                            return;
                        }
                    }
                    logger.error("checkProxyServer() - failed: the proxy server value is invalid");
                    throw Error("The proxy server value is invalid");
                }
            } else {
                logger.error("checkProxyServer() - failed: the Proxy option enabled in the settings, but the Proxy_server is not specified");
                throw Error("You have the Proxy option enabled in the settings, but the Proxy_server is not specified");
            }
        }
    }

    private static checkJobTimeout(): void {
        logger.debug("checkJobTimeout()");
        if (this._jobTimeout === undefined) {
            return;
        }
        const splited = this._jobTimeout.split(':');
        if (splited.length !== 3) {
            logger.error("checkJobTimeout() - failed: Invalid session timeout format. Use the following format: hh:mm:ss");
            throw Error("Invalid session timeout format. Use the following format: hh:mm:ss");
        }
        const hh = Number(splited[0]);
        const mm = Number(splited[1]);
        const ss = Number(splited[2]);
        if (isNaN(hh) || isNaN(mm) || isNaN(ss)) {
            logger.error("checkJobTimeout() - failed: Invalid session timeout value. hh,mm,ss must be positive integers");
            throw Error("Invalid session timeout value. hh,mm,ss must be positive integers");

        }
        if (hh < 0 || mm < 0 || ss < 0 || hh > 24 || mm > 59 || ss > 59) {
            logger.error("checkJobTimeout() - failed: Invalid session timeout value. hh,mm,ss must be positive integers, where ss and mm take values from 0 to 59, and hh from 0 to 24");
            throw Error("Invalid session timeout value. hh,mm,ss must be positive integers, where ss and mm take values from 0 to 59, and hh from 0 to 24");

        }
        if (hh === 24 && (mm !== 0 || ss !== 0)) {
            logger.error("checkJobTimeout() - failed: Invalid session timeout value. Max time is 24h, so the only valid entry for hh = 24 is 24:00:00");
            throw Error("Invalid session timeout value. Max time is 24h, so the only valid entry for hh = 24 is 24:00:00");
        }
    }

    private static async checkCygwinPath(): Promise<void> {
        logger.debug("checkCygwinPath()");
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
            else {
                logger.error("checkCygwinPath() - failed: cygwin installation rejected");
                throw Error("Install Cygwin. Then run Setup Connection command again");
            }
        }
    }
}
