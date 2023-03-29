/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */


import { existsSync } from 'fs';
import { join } from 'path';
import { ExtensionSettings } from './extension_settings';
import { Logger } from "./logger";

const logger = Logger.getInstance();

export class Shell {
    public static shellPath: string;
    public static async init(): Promise<void> {
        logger.debug("init()");
        if (process.platform === 'win32') {
            if (!ExtensionSettings._cygwinPath || !existsSync(ExtensionSettings._cygwinPath)) {
                logger.error("Shell.init() - failed: cygwin at the specified path in the extension settings does not exist");
                throw Error("Shell initialization failed. Cygwin at the specified path in the extension settings does not exist");
            }
            Shell.shellPath = join(ExtensionSettings._cygwinPath, `bin`, `bash.exe`);
        } else {
            Shell.shellPath = '/bin/bash';
        }
        if (!existsSync(Shell.shellPath)) {
            logger.error(`Shell.init() - failed: Failed to find a shell binary. Path:${Shell.shellPath}\n Install shell binary if it is not found`);
            throw Error(`Failed to find a shell binary. Path:${Shell.shellPath}\n Install shell binary if it is not found`);
        }
    }
}