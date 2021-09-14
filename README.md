# DevCloud Connector for Intel® oneAPI Toolkits

#### | [Repository][vsix-repo] | [Issues][vsix-issues] | [Documentation][vsix-docs] |

[vsix-repo]:   <https://github.com/intel/vscode-vscode-oneapi-devcloud-connector>
[vsix-issues]: <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connector/issues>
[vsix-docs]:   <https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connector#readme>


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

* Turn off your VPN (connecting via a VPN is not supported).


### Windows SSH Setup (Direct Internet access)

* Install VSCode 1.58.1 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* [Install
Cygwin](https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin)
into the C:\cygwin64 folder. Automated installation is recommended. Make sure
that ssh.exe and nc.exe are present in the /cygwin64/bin folder.

* Create a oneAPI DevCloud account and setup your SSH config file and ssh.exe
Cygwin client [for use with the VSCode Remote-SSH
extension.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

### Linux SSH Setup (Direct Internet access)

* Install VSCode 1.58.1 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* Create a oneAPI DevCloud account and [setup your SSH config file.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

### If you are behind an SSH proxy (Windows and Linux)

Modify ~/.ssh/config as below
```
Host devcloud.proxy
User <user>
Port 4022
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
ProxyCommand ssh -T devcloud-via-proxy

# If you must route outgoing SSH connection via a corporate proxy,
# replace PROXY_HOSTNAME and PORT below with the values provided by
# your network administrator.
Host devcloud-via-proxy
User guest
Hostname ssh.devcloud.intel.com
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
LocalForward 4022 c009:22
ProxyCommand nc -x <proxy_name>:<port> %h %p
################################################################################################

################################################################################################
# DevCloud VSCode config
################################################################################################
Host devcloud-vscode
UserKnownHostsFile /dev/null
StrictHostKeyChecking no
Hostname localhost
User <user>
Port 5022
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
################################################################################################

################################################################################################
# SSH Tunnel config
################################################################################################
Host *.aidevcloud
User <user>
IdentityFile ~/.ssh/devcloud-access-key-<user>.txt
ProxyCommand ssh -T devcloud.proxy nc %h %p
LocalForward 5022 localhost:22
LocalForward 5901 localhost:5901
################################################################################################

```
proxy_name and port  are, respectively, the hostname and port of the corporate proxy.

### If you copied ssh config file and key file from another machine

Set the correct restrictive permissions on it and on the SSH client config file. To do this, run the following commands in a terminal:

```
chmod 600 ~/.ssh/devcloud-access-key-<user>.txt
chmod 600 ~/.ssh/config
```

### Check Your Connection to the DevCloud Login Node

To be sure that your ssh setup is correct, open a terminal session (Cygwin
terminal on Windows; bash terminal on Linux) and run the `ssh devcloud`
command.


###	Install DevCloud Connector for Intel® oneAPI Toolkits from the Visual Studio Marketplace*
1.	Click the left menu icon for Extensions
2.	Search for DevCloud Connector for Intel® oneAPI Toolkits



## Use the Extension

1. Check the extension settings.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/e093b445-3cb6-4553-abe5-e083653c7ad4)

2. Set connection and Visual Studio Code session settings if needed.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/3be68326-903b-4c2c-9e29-bd873cf99c99)

3. Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
Type **DevCloud** and select `Intel DevCloud: Setup connection`

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/8e5a5794-bf84-4c67-b720-e2c9e9db45c0)

4. Two service terminals will be created with the names: `devcloudService1` and `devcloudService2`. It may take several seconds to create the terminals.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/4e17b31d-7f5b-44a2-a7a8-f54e2a0a20ae)


> NOTE: These are service terminals that are being used to facilite your
connection to the oneAPI DevCloud. Do not close them during your DevCloud
session; closing them will interrupt your SSH connection to the DevCloud.

5. The second terminal may ask you to add an SSH key fingerprint - type "yes".

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/7af4d365-5bac-4e5c-a8ea-2b10dee2e1e2)

> NOTE: Do not type anything else in the service terminals.

6. If the connection setup is successful, a corresponding message will appear:

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/d6dafcc7-d732-4770-950a-2c9aa4d725f0)

Connect to the compute node on DevCloud using the Remote-SSH
extension or by using the DevCloud terminal.

7. To run DevCloud terminal you should type Ctrl+Shift+P and choose "Intel DevCloud: New DevCloud Terminal"

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.oneapi-devcloud-connector/assets/40661523/9a02807d-8382-4674-969d-53d61e8e0312)

The DevCloud terminal can use any of the command line operations supported by Intel® oneAPI Toolkits. For example, to browse samples, enter `oneapi-cli`:
![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connectoror/assets/40661523/25a56873-8020-4d07-b7a7-9218796e49ef)


![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connectoror/assets/40661523/774e0d0c-83c5-4f8d-bef6-37ed0d64f307)


After running a sample, you can use PBS to check the status of your project:
![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connectoror/assets/40661523/fb197958-e590-4879-b1e7-21b64d5d345e)

8. Instead of using the command line, you can use the command palette to start the "Remote-SSH" extension and select the  `devcloud-vscode` option.

![image](https://github.com/intel-innersource/frameworks.ide.vscode.extensions.vscode-oneapi-devcloud-connector/assets/40661523/2911875a-cc86-452b-98a9-f189c223073b)

You should now be in your DevCloud home folder in an interactive computer node.

9. For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`


## End the Connection

To close your connection to the oneAPI DevCloud and kill your interactive session:

* Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
. Type **DevCloud** and select `Intel DevCloud: Close connection` or

* Close Visual Studio Code window with extension.




## Known Issues

