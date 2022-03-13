/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

'use strict';

import * as vscode from 'vscode';

export function checkAndInstallExtension(extName: string): boolean {
	const remoteSSHext = vscode.extensions.getExtension(extName);
	if (!remoteSSHext && !vscode.env.remoteName) {
		const goToInstall = 'Install';
		vscode.window.showInformationMessage('You must install the Remote-SSH extension by Microsoft to use the DevCloud Connector for Intel® oneAPI Toolkits', goToInstall)
			.then((selection) => {
				if (selection === goToInstall) {
					vscode.commands.executeCommand('workbench.extensions.installExtension', extName);
				}
			});
		return false;
	}
	return true;
}
