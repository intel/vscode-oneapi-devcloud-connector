import * as vscode from 'vscode';
import { DevConnect } from './devconnect';

export function activate(context: vscode.ExtensionContext): void {
	const devcloud = new DevConnect();
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.help', () => devcloud.getHelp()));
	context.subscriptions.push(vscode.commands.registerCommand('devcloud.setupConnect', () => devcloud.setupConnect()));
	context.subscriptions.push();
}
export function deactivate(): void { return; }

