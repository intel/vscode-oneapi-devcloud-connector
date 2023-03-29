/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import { Logger } from "./logger";

const logger = Logger.getInstance();
export class AbortControllerWrap {
    private static controller: AbortController;
    public static abort() {
        logger.debug("abort()");
        this.controller.abort();
    }
    public static refresh() {
        logger.debug("refresh()");
        this.controller = new AbortController();
    }
    public static signal() {
        return this.controller.signal;
    }
} 