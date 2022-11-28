/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { devcloudName } from './constants';

export function checkAndInstallExtension(extName: string): boolean {
	const remoteSSHext = vscode.extensions.getExtension(extName);
	if (!remoteSSHext && !vscode.env.remoteName) {
		const goToInstall = 'Install';
		vscode.window.showInformationMessage(`You must install the Remote-SSH extension by Microsoft to use the ${devcloudName} Connector for Intel oneAPI Toolkits`, goToInstall)
			.then((selection) => {
				if (selection === goToInstall) {
					vscode.commands.executeCommand('workbench.extensions.installExtension', extName);
				}
			});
		return false;
	}
	return true;
}

export async function addDevCloudTerminalProfile(nodeName: string, shellPath: string | undefined) {
	let os = '';
	if (process.platform === 'win32') {
		os = 'windows';
	} else {
		if (process.platform === 'linux') {
			os = 'linux';
		} else {
			os = 'osx';
		}
	}
	const settings = vscode.workspace.getConfiguration('terminal');
	const terminalName = "DevCloudWork: ".concat(nodeName);
	// eslint-disable-next-line @typescript-eslint/naming-convention, no-var
	var devCloudProfile = { [terminalName]: { "overrideName": true, "path": `${shellPath}`, "args": ["-i", "-l", "-c", `ssh ${nodeName.concat(`.aidevcloud`)}`] } };
	await settings.update(`integrated.profiles.${os}`, devCloudProfile, true);
	return;
}

export async function removeDevCloudTerminalProfile() {
	let os = '';
	if (process.platform === 'win32') {
		os = 'windows';
	} else {
		if (process.platform === 'linux') {
			os = 'linux';
		} else {
			os = 'osx';
		}
	}
	const settings = vscode.workspace.getConfiguration('terminal');
	const profiles = vscode.workspace.getConfiguration(`terminal.integrated.profiles.${os}`);
	Object.entries(profiles).forEach(async profile => {
		if (profile[0].indexOf('DevCloud') !== -1) {
			await settings.update(`integrated.profiles.${os}`, undefined, true);
		}
	});
	return;
}
