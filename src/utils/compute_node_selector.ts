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
import { Logger } from "./logger";

const logger = Logger.getInstance();

const deviceClassesCount = 4;//number of device classes- core,xeon,fpga, gpu

class ComputeNodeSelectorError extends Error {
}

interface ComputeNode {
    name: string;
    properties: string;
}
export class ComputeNodeSelector {
    private static nodes: Set<ComputeNode> = new Set<ComputeNode>;
    private static deviceClasses: Set<string> = new Set<string>;
    private static selectedDeviceClass: string;
    private static selectedNode: string;

    public static async init(): Promise<void> {
        logger.debug("init()");
        this.reset();
        await ComputeNodeSelector.fetchFreeComputeNodes();
    }

    public static async selectComputeNode(): Promise<string> {
        logger.debug("selectComputeNode()");
        await ComputeNodeSelector.selectDeviceClass();
        await ComputeNodeSelector.selectComputeNodeFromDeviceClass();
        return this.selectedNode;
    }

    private static async fetchFreeComputeNodes(): Promise<void> {
        logger.debug("fetchFreeComputeNodes()");
        try {
            const pbsnodesOutput: string = await new Promise((resolve, _reject) => {
                exec(`${Shell.shellPath} -l -c "ssh devcloud${ExtensionSettings._proxy === true ? ".proxy" : ""} 'pbsnodes -s ${ExtensionSettings._cluster}' "`,
                    { signal: AbortControllerWrap.signal() },
                    (_error, stdout, _stderr) => {
                        if (_error) {
                            logger.fatal(`Failed to fetch free compute nodes. ${_error.message}`);
                        }
                        resolve(stdout);
                    });
            });
            if (pbsnodesOutput === "") {
                logger.error("fetchFreeComputeNodes() - failed: Failed to fetch free compute nodes. pbsnodes return empty string");
                throw new ComputeNodeSelectorError("Failed to fetch free compute nodes.");
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
                    if (property.indexOf(",fpga ") >= 0 || property.indexOf("fpga,") >= 0) { this.deviceClasses.add("fpga"); }
                    if (property.indexOf("gpu") >= 0) { this.deviceClasses.add("gpu"); }
                }
                if (this.deviceClasses.size === 0) {
                    logger.error("fetchFreeComputeNodes() - failed: No compute nodes in known device classes");
                    throw new ComputeNodeSelectorError("No compute nodes in known device classes");
                }
            }

            if (ComputeNodeSelector.nodes.size === 0) {
                logger.error("fetchFreeComputeNodes() - failed: Failed to parse pbsnodesOutput");
                throw new ComputeNodeSelectorError("Failed to fetch free compute nodes.");
            }
        } catch (e) {
            if (!(e instanceof Error)) {
                logger.fatal(`fetchFreeComputeNodes() - failed:\n    ${(e as Error).message}`);
            }
            throw e;
        }

    }

    private static async selectDeviceClass(): Promise<void> {
        logger.debug("selectDeviceClass()");
        let selectedDeviceClass = undefined;
        while (!selectedDeviceClass) {
            selectedDeviceClass = await vscode.window.showQuickPick(Array.from(ComputeNodeSelector.deviceClasses.keys()), { matchOnDescription: true, placeHolder: "Available device classes", title: "Select the device class" });
        }
        logger.info(`selectDeviceClass() - Selected device class - ${selectedDeviceClass}`);
        ComputeNodeSelector.selectedDeviceClass = selectedDeviceClass;

    }

    private static async selectComputeNodeFromDeviceClass(): Promise<void> {
        logger.debug("selectComputeNodeFromDeviceClass()");
        const allNodesFromDeviceClass: Set<string> = new Set<string>;
        for (const node of ComputeNodeSelector.nodes) {
            if (node.properties.indexOf(ComputeNodeSelector.selectedDeviceClass) >= 0) {
                allNodesFromDeviceClass.add(`${node.properties.replace(/:/g, ' ')}`);
            }
        }
        let selectedNode = undefined;
        while (!selectedNode) {
            const nodes = [`Any available ${ComputeNodeSelector.selectedDeviceClass}`].concat(Array.from(allNodesFromDeviceClass));
            selectedNode = (await vscode.window.showQuickPick(nodes, { matchOnDescription: true, placeHolder: "Select the compute node you want to use", title: "Available compute nodes" }));
        }
        if (selectedNode !== `Any available ${ComputeNodeSelector.selectedDeviceClass}`) {
            this.selectedNode = selectedNode.replace(/ /g, ':');
        } else {
            this.selectedNode = ComputeNodeSelector.selectedDeviceClass;
        }
        logger.info(`selectComputeNodeFromDeviceClass() - Selected compute node - ${this.selectedNode}`);

    }

    private static reset() {
        logger.debug("reset()");
        this.nodes.clear();
        this.deviceClasses.clear();
    }
}
