/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */


export class AbortControllerWrap {
    private static controller: AbortController;
    public static abort() {
        this.controller.abort();
    }
    public static refresh() {
        this.controller = new AbortController();
    }
    public static signal() {
        return this.controller.signal;
    }
} 