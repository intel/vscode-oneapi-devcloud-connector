import * as vscode from 'vscode';
import { DevConnect } from './devconnect';

export function activate(context: vscode.ExtensionContext): void {
	const devcloud = new DevConnect();
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.setupConnection', () => devcloud.setupConnection()));
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.closeConnection', ()  => devcloud.closeConnection()));
}

export function deactivate(): void { return; }
