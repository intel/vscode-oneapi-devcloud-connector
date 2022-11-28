/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */


import { existsSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { ExtensionSettings } from './extension_settings';


export class Shell {
    public static shellPath: string;
    public static async init(): Promise<boolean> {
        if (process.platform === 'win32') {
            if (!ExtensionSettings._cygwinPath || !existsSync(ExtensionSettings._cygwinPath)) {
                return false;
            }
            Shell.shellPath = join(ExtensionSettings._cygwinPath, `bin`, `bash.exe`);
        } else {
            Shell.shellPath = '/bin/bash';
        }
        if (!existsSync(Shell.shellPath)) {
            vscode.window.showErrorMessage(`Failed to find a shell binary. Path:${Shell.shellPath}\n Install shell binary if it is not found.`, { modal: true });
            return false;
        }
        return true;
    }
}