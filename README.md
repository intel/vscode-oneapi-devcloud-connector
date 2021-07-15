# VSCode extension for connection to Intel oneAPI DevCloud.

#### | [Repository][vsix-repo] | [Issues][vsix-issues] | [Documentation][vsix-docs] |

[vsix-repo]:   <https://github.com/intel/vscode-oneapi-devcloud-connect>
[vsix-issues]: <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/issues>
[vsix-docs]:   <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect#readme>


#### | [oneAPI Code Samples][oneapi-samples] | [oneAPI VSCode Extensions][oneapi-samples] | [Intel VSCode Extensions][intel-extensions] |

[oneapi-samples]:    <https://github.com/oneapi-src/oneAPI-samples>
[oneapi-extensions]: <https://marketplace.visualstudio.com/search?term=oneapi&target=VSCode>
[intel-extensions]:  <https://marketplace.visualstudio.com/publishers/intel-corporation>

***

This extension assists with configuring and establishing a VSCode Remote-SSH
connection to the [oneAPI DevCloud](https://devcloud.intel.com/oneapi/)
development environment.

The oneAPI DevCloud cluster does not support VSCode Remote-SSH connections
into the cluster's "login node." However, by creating an SSH tunnel you can
establish a VSCode Remote-SSH session with a oneAPI DevCloud "compute node."
This extension will help you locate and reserve a compute node and establish
an interactive VSCode Remote-SSH session with that compute node.

Without this extension you must perform a [series of manual
steps][manual-remote-ssh] to create the SSH tunnel and an interactive VSCode
Remote-SSH connection to a oneAPI DevCloud compute node.

[manual-remote-ssh]: <https://devcloud.intel.com/oneapi/documentation/connect-with-vscode>

***


## Prerequisites:

* Windows 10 or Linux Ubuntu 18 (currently tested platforms).

* Direct Internet access (proxy not supported at this time).

* Connecting via a VPN is not supported (turn off you VPN).


### Windows SSH Setup

* Install VSCode 1.56 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* [Install
Cygwin](https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin)
into the C:\cygwin64 folder. Automated installation is recommended. Make sure
that ssh.exe and nc.exe are present in the /cygwin64/bin folder.

* Create a oneAPI DevCloud account and setup your SSH config file and ssh.exe
Cygwin client [for use with the VSCode Remote-SSH
extension.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)


### Linux SSH Setup

* Install VSCode 1.56 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* Create a oneAPI DevCloud account and [setup your SSH config file.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)


### Check connection to DevCloud login node

To be sure that your ssh setup is correct, open terminal (Cygwin terminal on Windows / bash terminal on Linux) and run "ssh devcloud" command.

### Install the DevCloud connection extension from VSIX

Download vsix file from latest release: https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/releases

Install vsix:

* Click the left menu icon for Extensions (1)
* Click button "..." (2)
* Click "Install from VSIX..." button (3)

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/f173026a-33b4-44bc-b9b0-702ffc9d33e3)


## Start work with extension.

1. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
2. Type **Intel DevCloud** and select `Intel DevCloud: Setup connection`

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/22faa42a-cb5c-43ab-b37e-f7ad63f37e6c)

3. Command will ask “Are you connecting via proxy?”

Select “No”. Connection via proxy is not available currently.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/3c45a5b8-7cbc-45d3-880d-2fd7c1feba08)


4. Next, two service terminals will be created with interval of several seconds: devcloudService1 and devcloudService2

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/d2bf8f12-3fd7-41ae-b262-2247ace75f26)

>NOTE: These are sevrice terminals. Do not close them during the work - this will interrupt the connection to DevCloud!

5. The second terminal may ask to add SSH key fingerprint - type "yes"
![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/0bde8ba6-90e0-42b2-a750-c047c11c75d0)

>NOTE: Do not type anything else in the terminals.

6. If the connection setup is successful, a corresponding message will appear and then you can  connect to the compute node on DevCloud via the vscode ssh extension.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/11194224-0d41-4a1d-b440-dbc5291caf1e)


7. To do this, open "Remote-SSH" extension and push "devcloud-vscode" button.

![image](../assets/40661523/2911875a-cc86-452b-98a9-f189c223073b)

Now you are in your DevCloud home folder.

8. For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`


## End work and close connection

To close connection to DevCloud and kill your interactive session you should:
1. Close VSCode window on Devcloud (created by Remote-SSH)
2. Close both service terminals:
![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connect/assets/40661523/329e8f4f-1bb1-4ee8-9a3b-fd06ba436311)


## Known issues

* Connection via proxy is not available currently.
* Do not create two or more connections at the same time. This case is not supported at this time.
* If you have any alive PBS jobs on Devcloud (run or in queue), the extension will not connect to Devcloud.
