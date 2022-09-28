/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

'use strict';

import * as vscode from 'vscode';
import { unsetRemoteSshSettings } from './utils/ssh_config';
import { DevConnect } from './devconnect';
import { checkAndInstallExtension, removeDevCloudTerminalProfile } from './utils/other';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	await removeDevCloudTerminalProfile();
	for (const t of vscode.window.terminals) {
		if ((t.name === 'devcloudService1 - do not close') || (t.name === 'devcloudService2 - do not close') ||
			(t.name === 'HeadNode terminal') || (t.name === 'Install Cygwin') || (t.name.indexOf('DevCloudWork:') !== -1)) {
			t.dispose();
		}
	}
	const devcloud = new DevConnect();
	devcloud.proxy = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<boolean>("proxy");
	devcloud.proxyServer = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>("proxy_server");
	devcloud.connectionTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<number>('connection_timeout');
	devcloud.jobTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('session_timeout');
	devcloud.cygwinPath = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('cygwin_path');
	devcloud.nodeDevice = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('node_device');

	// Updating parameters when they are changed in Setting.json
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.proxy")) {
			devcloud.proxy = vscode.workspace.getConfiguration().get<boolean>("intel-corporation.vscode-oneapi-devcloud-connector.proxy");
		}
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.proxy_server")) {
			devcloud.proxyServer = vscode.workspace.getConfiguration().get<string>("intel-corporation.vscode-oneapi-devcloud-connector.proxy_server");
		}
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.connection_timeout")) {
			devcloud.connectionTimeout = vscode.workspace.getConfiguration().get<number>("intel-corporation.vscode-oneapi-devcloud-connector.connection_timeout");
		}
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.session_timeout")) {
			devcloud.jobTimeout = vscode.workspace.getConfiguration().get<string>("intel-corporation.vscode-oneapi-devcloud-connector.session_timeout");
		}
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.cygwin_path")) {
			devcloud.cygwinPath = vscode.workspace.getConfiguration().get<string>("intel-corporation.vscode-oneapi-devcloud-connector.cygwin_path");
		}
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.node_device")) {
			devcloud.nodeDevice = vscode.workspace.getConfiguration().get<string>("intel-corporation.vscode-oneapi-devcloud-connector.node_device");
		}
	}));
	context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
		if (terminal.name === 'devcloudService1 - do not close') {
			devcloud.terminalExitStatus = terminal.exitStatus?.code;
		}
		if (terminal.name === 'HeadNode terminal') {
			devcloud.fterminalExitStatus = terminal.exitStatus?.code;
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.setupConnection', () => {
		if (!checkAndInstallExtension('ms-vscode-remote.remote-ssh')) {
			return;
		}
		devcloud.setupConnection();
	}
	));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.closeConnection', () => devcloud.closeConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.devcloudTerminal', () => devcloud.createDevCloudTerminal()));

}

export async function deactivate(): Promise<void> {
	if (process.platform === 'win32') {
		await unsetRemoteSshSettings();
	}
	return;
}
