/**
 * Copyright (c) Intel Corporation
 * Licensed under the MIT License. See the project root LICENSE
 * 
 * SPDX-License-Identifier: MIT
 */

import { exec } from 'child_process';
import * as vscode from 'vscode';
import { AbortControllerWrap } from './abort_controller_wrap';
import { ExtensionSettings } from './extension_settings';
import { Shell } from './shell';

const deviceClassesCount = 4;//number of device classes- core,xeon,fpga, gpu

interface ComputeNode {
    name: string;
    properties: string;
}
export class ComputeNodeSelector {
    private static nodes: Set<ComputeNode> = new Set<ComputeNode>;
    private static deviceClasses: Set<string> = new Set<string>;
    private static selectedDeviceClass: string;
    private static selectedNode: string;

    public static async init(): Promise<boolean> {
        this.reset();
        if (!await ComputeNodeSelector.getFreeComputeNodes()) {
            return false;
        }
        return true;
    }

    public static async selectComputeNode(): Promise<string> {
        if (!await ComputeNodeSelector.selectDeviceClass() ||
            !await ComputeNodeSelector.selectComputeNodeFromDeviceClass()) {
            return '';
        }
        return this.selectedNode;
    }

    private static async getFreeComputeNodes(): Promise<boolean> {
        try {
            const pbsnodesOutput: string = await new Promise((resolve, _reject) => {
                exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} 'pbsnodes -s ${ExtensionSettings._cluster}' "`,
                    { signal: AbortControllerWrap.signal() },
                    (_error, stdout, _stderr) => {
                        resolve(stdout);
                    });
            });

            if (pbsnodesOutput === "") {
                console.error("getNodes failed. pbsnodes return empty string");
                return false;
            }
            const stateAndProperties = pbsnodesOutput.matchAll(/(s\d{3}-n\d{3})\n\s*state\s=\s(.*)\n\s*power_state = \w*\n\s*np = \d\n\s*properties = (.*)/ig);

            for (const [_, name, state, property] of stateAndProperties) {
                if (state !== "free") {
                    continue;
                }
                ComputeNodeSelector.nodes.add({ name: name, properties: property.replace(/,/gi, ':') });
                if (this.deviceClasses.size !== deviceClassesCount) {
                    if (property.indexOf("core") >= 0) { this.deviceClasses.add("core"); }
                    if (property.indexOf("xeon") >= 0) { this.deviceClasses.add("xeon"); }
                    if (property.indexOf("fpga") >= 0) { this.deviceClasses.add("fpga"); }
                    if (property.indexOf("gpu") >= 0) { this.deviceClasses.add("gpu"); }
                }
            }

            if (ComputeNodeSelector.nodes.size === 0) {
                console.error("getNodes failed. Failed to parse pbsnodesOutput");
                return false;
            }
            return true;
        }
        catch (e) {
            console.error(e);
            return false;
        }
    }

    private static async selectDeviceClass(): Promise<boolean> {
        let selectedDeviceClass = undefined;
        if (this.deviceClasses.size === 0) {
            return false;
        }
        while (!selectedDeviceClass) {
            selectedDeviceClass = await vscode.window.showQuickPick(Array.from(ComputeNodeSelector.deviceClasses.keys()), { matchOnDescription: true, placeHolder: "Available device classes", title: "Select the device class" });
        }
        if (!selectedDeviceClass) {
            return false;
        }
        ComputeNodeSelector.selectedDeviceClass = selectedDeviceClass;
        return true;
    }

    private static async selectComputeNodeFromDeviceClass(): Promise<boolean> {
        const allNodesFromDeviceClass: Set<string> = new Set<string>;
        for (const node of ComputeNodeSelector.nodes) {
            if (node.properties.indexOf(ComputeNodeSelector.selectedDeviceClass) >= 0) {
                allNodesFromDeviceClass.add(`${node.properties}`);
            }
        }
        if (allNodesFromDeviceClass.size === 0) {
        }
        let selectedNode = undefined;
        while (!selectedNode) {
            selectedNode = await vscode.window.showQuickPick(Array.from(allNodesFromDeviceClass), { matchOnDescription: true, placeHolder: "Select the compute node you want to use", title: "Available compute nodes" });
        }
        if (!selectedNode) {
            return false;
        }
        this.selectedNode = selectedNode;
        return true;
    }

    private static reset() {
        this.nodes.clear();
        this.deviceClasses.clear();
    }
}
