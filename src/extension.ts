/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { DevConnect } from './devconnect';
import { checkAndInstallExtension, removeDevCloudTerminalProfile } from './utils/other';
import { ExtensionSettings } from './utils/extension_settings';
import { unsetRemoteSshSettings } from './utils/ssh_config';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	await removeDevCloudTerminalProfile();
	for (const t of vscode.window.terminals) {
		if ((t.name === 'devcloudService - do not close') || (t.name === 'HeadNode terminal') || (t.name === 'Install Cygwin') || (t.name.indexOf('DevCloudWork:') !== -1)) {
			t.dispose();
		}
	}
	await ExtensionSettings.refresh();
	const devcloud = DevConnect.getInstance();

	context.subscriptions.push(vscode.window.onDidCloseTerminal((terminal) => {
		if (terminal.name === 'devcloudService - do not close') {
			devcloud.terminalExitStatus = terminal.exitStatus?.code;
			if (devcloud.isConnected) {
				devcloud.closeConnection();
			}
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.setupConnection', async () => {
		await ExtensionSettings.refresh();
		if (!await ExtensionSettings.checkSettingsFormat()) {
			return;
		}
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
	const devcloud = DevConnect.getInstance();
	devcloud.closeConnection();
	await unsetRemoteSshSettings();
	return;
}
