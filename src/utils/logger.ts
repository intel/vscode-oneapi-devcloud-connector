/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import * as log4js from 'log4js';
import { homedir } from 'os';
import { join } from 'path';

export class Logger {
    private static instance: log4js.Logger;
    private static logPath: string;
    public static getInstance() {
        if (!Logger.instance) {
            Logger.instance = log4js.getLogger();
            if (process.env.TMP) {
                this.logPath = join(process.env.TMP, "devcloudConnectorLogFile.txt");
            } else {
                this.logPath = join(homedir(), "devcloudConnectorLogFile.txt");
            }
            log4js.configure({
                appenders: {
                    app: {
                        type: "file",
                        filename: this.logPath,
                        layout: {
                            type: "pattern",
                            pattern: "[%d] [%p] [%f{1}:%l:%o]: %m"
                        }
                    },
                },
                categories: {
                    default: {
                        appenders: ["app"],
                        level: "all",
                        enableCallStack: true
                    }
                }
            });
        }
        return Logger.instance;
    }
    public static getLogPath() {
        return this.logPath;
    }
}