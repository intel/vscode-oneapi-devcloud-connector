'use strict';

import * as vscode from 'vscode';
import { DevConnect } from './devconnect';

export function activate(context: vscode.ExtensionContext): void {
	const devcloud = new DevConnect();
	
	devcloud.isConnected = false;
	devcloud.proxy = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<boolean>("proxy");
	devcloud.connectionTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<number>('connection_timeout');
	devcloud.jobTimeout = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('session_timeout');
	devcloud.cygwinPath = vscode.workspace.getConfiguration("intel-corporation.vscode-oneapi-devcloud-connector").get<string>('cygwin_path');

	// Updating parameters when they are changed in Setting.json
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration("intel-corporation.vscode-oneapi-devcloud-connector.proxy")) {
			devcloud.proxy = vscode.workspace.getConfiguration().get<boolean>("intel-corporation.vscode-oneapi-devcloud-connector.proxy");
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
	}));

	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.setupConnection', () => devcloud.setupConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.closeConnection', () => devcloud.closeConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.vscode-oneapi-devcloud-connector.devcloudTerminal', () => devcloud.createDevCloudTerminal()));
	
}

export function deactivate(): void { return; }
