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
import { Logger } from './utils/logger';

const logger = Logger.getInstance();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	logger.info("===========================");
	logger.info("Activate extension ");

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
		try {
            await ExtensionSettings.refresh();
            await ExtensionSettings.checkSettingsFormat();
            checkAndInstallExtension('ms-vscode-remote.remote-ssh');
			devcloud.setupConnection();
		}
		catch (e) {
			vscode.window.showErrorMessage((e as Error).message, { modal: true });
		}
	}
	));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.closeConnection', () => devcloud.closeConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.devcloudTerminal', () => devcloud.createDevCloudTerminal()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.openLogFile', () => devcloud.openLogFile()));
}

export async function deactivate(): Promise<void> {
	logger.info("Deactivate extension ");
	logger.info("===========================");
	const devcloud = DevConnect.getInstance();
	devcloud.closeConnection();
	await unsetRemoteSshSettings();
	return;
}
