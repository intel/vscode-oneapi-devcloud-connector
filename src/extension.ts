import * as vscode from 'vscode';
import { DevConnect } from './devconnect';

export function activate(context: vscode.ExtensionContext): void {
	const devcloud = new DevConnect();

	devcloud.connection_timeout = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<number>('connection_timeout');
	devcloud.sshClientPath = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<string>('ssh_client');
	devcloud.sshConfigPath = vscode.workspace.getConfiguration("intel-corporation.oneapi-devcloud-connect").get<string>('ssh_config');

	// Updating parameters when they are changed in Setting.json
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.connection_timeout")) {
			devcloud.connection_timeout = vscode.workspace.getConfiguration().get<number>("intel-corporation.oneapi-devcloud-connect.connection_timeout");
		}
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.ssh_client")) {
			devcloud.sshClientPath = vscode.workspace.getConfiguration().get<string>("intel-corporation.oneapi-devcloud-connect.ssh_client");
		}
		if (e.affectsConfiguration("intel-corporation.oneapi-devcloud-connect.ssh_config")) {
			devcloud.sshConfigPath = vscode.workspace.getConfiguration().get<string>("intel-corporation.oneapi-devcloud-connect.ssh_config");
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.setupConnection', () => devcloud.setupConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('intel-corporation.oneapi-devcloud-connect.closeConnection', ()  => devcloud.closeConnection()));
}

export function deactivate(): void { return; }
