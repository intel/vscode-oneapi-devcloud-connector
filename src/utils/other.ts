/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as vscode from 'vscode';
import { devcloudName } from './constants';
import { Logger } from "./logger";

const logger = Logger.getInstance();

export function checkAndInstallExtension(extName: string): void {
	logger.debug(`checkAndInstallExtension(extName:${extName})`);
	const remoteSSHext = vscode.extensions.getExtension(extName);
	if (!remoteSSHext && !vscode.env.remoteName) {
		const goToInstall = 'Install';
		vscode.window.showInformationMessage(`You must install the Remote-SSH extension by Microsoft to use the ${devcloudName} Connector for Intel oneAPI Toolkits`, goToInstall)
			.then((selection) => {
				if (selection === goToInstall) {
					vscode.commands.executeCommand('workbench.extensions.installExtension', extName);
				}
			});
		logger.error(`You must install the Remote-SSH extension by Microsoft to use the ${devcloudName} Connector for Intel oneAPI Toolkits`);
		throw Error("Install the Remote-SSH extension by Microsoft. Then run Setup Connection command again");
	}
}

export async function addDevCloudTerminalProfile(nodeName: string, shellPath: string | undefined) {
	logger.debug(`addDevCloudTerminalProfile( nodeName:${nodeName}, shellPath:${shellPath})`);
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
	logger.debug("removeDevCloudTerminalProfile()");
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
