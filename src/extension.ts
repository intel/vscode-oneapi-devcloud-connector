'use strict';

import * as vscode from 'vscode';
import { DevConnect } from './devconnect';

export function activate(context: vscode.ExtensionContext): void {
	const devcloud = new DevConnect();
	
	devcloud.isConnected = false;
	devcloud.proxy = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<boolean>("proxy");
	devcloud.connectionTimeout = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<number>('connection_timeout');
	devcloud.jobTimeout = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<string>('job_timeout');
	devcloud.cygwinPath = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<string>('cygwin_path');

	// Updating parameters when they are changed in Setting.json
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.proxy")) {
			devcloud.proxy = vscode.workspace.getConfiguration().get<boolean>("intel-corporation.oneapi-devcloud-connect.proxy");
		}
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.connection_timeout")) {
			devcloud.connectionTimeout = vscode.workspace.getConfiguration().get<number>("intel-corporation.oneapi-devcloud-connect.connection_timeout");
		}
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.job_timeout")) {
			devcloud.jobTimeout = vscode.workspace.getConfiguration().get<string>("intel-corporation.oneapi-devcloud-connect.job_timeout");
		}
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.cygwin_path")) {
			devcloud.cygwinPath = vscode.workspace.getConfiguration().get<string>("intel-corporation.oneapi-devcloud-connect.cygwin_path");
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.setupConnection', () => devcloud.setupConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.closeConnection', () => devcloud.closeConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.devcloudTerminal', () => devcloud.createDevCloudTerminal()));
	
}

export function deactivate(): void { return; }
