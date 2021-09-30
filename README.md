# DevCloud Connector for Intel® oneAPI Toolkits

#### | [Repository][vsix-repo] | [Issues][vsix-issues] | [Documentation][vsix-docs] |

[vsix-repo]:   <https://github.com/intel/vscode-oneapi-devcloud-connector>
[vsix-issues]: <https://github.com/intel/vscode-oneapi-devcloud-connector/issues>
[vsix-docs]:   <https://github.com/intel/vscode-oneapi-devcloud-connector#readme>


#### | [oneAPI Code Samples][oneapi-samples] | [oneAPI VS Code Extensions][oneapi-extensions] | [Intel VS Code Extensions][intel-extensions] |

[oneapi-samples]:    <https://github.com/oneapi-src/oneAPI-samples>
[oneapi-extensions]: <https://marketplace.visualstudio.com/search?term=oneapi&target=VSCode>
[intel-extensions]:  <https://marketplace.visualstudio.com/publishers/intel-corporation>

***

This extension assists with configuring and establishing a Visual Studio Code* (VS Code) Remote-SSH
connection to the [Intel® DevCloud](https://devcloud.intel.com/oneapi/)
development environment.

The Intel® DevCloud cluster does not support VS Code Remote-SSH connections
into the cluster's "login node." However, by creating an SSH tunnel you can
establish a VS Code Remote-SSH session with a Intel® DevCloud "compute node."
This extension will help you locate and reserve a compute node and establish
an interactive VS Code Remote-SSH session with that compute node. You also can use 
"DevCloud Terminal" in this extension after establishing connection to "compute node" to work in command line.

***


## Prerequisites:

* Windows* 10 or Linux* Ubuntu* 18.04/20.04 (currently tested platforms).

* Turn off your VPN (connecting via a VPN is not supported).


### Windows SSH Setup (Direct Internet access)

* Install VS Code 1.58.1 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* [Install
Cygwin*](https://devcloud.intel.com/oneapi/documentation/connect-with-ssh-windows-cygwin)
into the C:\cygwin64 folder. Automated installation is recommended. Make sure
that ssh.exe and nc.exe are present in the /cygwin64/bin folder.

* Create a Intel® DevCloud account and setup your SSH config file and ssh.exe
Cygwin client [for use with the VS Code Remote-SSH
extension.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

### Linux SSH Setup (Direct Internet access)

* Install VS Code 1.58.1 or later and install the [Remote-SSH
extension.](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh)

* Create a Intel® DevCloud account and [setup your SSH config file.](https://devcloud.intel.com/oneapi/documentation/connect-with-vscode)

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

### Check Your Connection to the Intel® DevCloud Login Node

To be sure that your ssh setup is correct, open a terminal session (Cygwin
terminal on Windows; bash terminal on Linux) and run the `ssh devcloud`
command.


###	Install DevCloud Connector for Intel® oneAPI Toolkits from the Visual Studio Marketplace*
*	Click the left menu icon for Extensions
*	Search for DevCloud Connector for Intel® oneAPI Toolkits



## Use the Extension

* Check the extension settings.

![image](https://user-images.githubusercontent.com/40661523/135318348-dc953dad-da81-4b96-9d21-3f6ca28bf57d.png)


* Set connection and Visual Studio Code session settings if needed.

![image](https://user-images.githubusercontent.com/40661523/135393776-744c8743-fd12-4013-8302-a83967087bae.png)

* Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
Type **DevCloud** and select `Intel DevCloud: Setup connection`

![image](https://user-images.githubusercontent.com/40661523/135393974-f7185619-dd48-48e1-b8f1-95947133b101.png)

* Two service terminals will be created with the names: `devcloudService1` and `devcloudService2`. It may take several seconds to create the terminals.

![image](https://user-images.githubusercontent.com/40661523/135394093-f637eeb4-3ed8-4516-b2a7-22d77727f60b.png)


> NOTE: These are service terminals that are being used to facilite your
connection to the Intel® DevCloud. Do not close them during your DevCloud
session; closing them will interrupt your SSH connection to the DevCloud.

* The second terminal may ask you to add an SSH key fingerprint - type "yes".

![image](https://user-images.githubusercontent.com/40661523/135394167-f13a1d95-d2aa-4748-9593-a42cfcf6ada0.png)

> NOTE: Do not type anything else in the service terminals.

* If the connection setup is successful, a corresponding message will appear:

![image](https://user-images.githubusercontent.com/40661523/135394228-97ef8e55-69e8-4d23-9e7e-3188231c99d9.png)

Connect to the compute node on DevCloud using the Remote-SSH
extension or by using the DevCloud terminal.

* To run DevCloud terminal you should type Ctrl+Shift+P and choose "Intel DevCloud: New DevCloud Terminal"

![image](https://user-images.githubusercontent.com/40661523/135394337-85ca5e0a-9e82-477a-8e48-b468705e7ba4.png)

The DevCloud terminal can use any of the command line operations supported by Intel® oneAPI Toolkits. For example, to browse samples, enter `oneapi-cli`:

![image](https://user-images.githubusercontent.com/40661523/135394434-5f8abc51-1609-4042-87d3-db0b78d06bf5.png)

After running a sample, you can use PBS to check the status of your project:

![image](https://user-images.githubusercontent.com/40661523/135394472-c13c29d6-2a69-4362-84f9-3d56558c0feb.png)


* Instead of using the command line, you can use the command palette to start the "Remote-SSH" extension and select the  `devcloud-vscode` option.

![image](https://user-images.githubusercontent.com/40661523/135394536-41087ed3-ff34-415a-a704-2593abdc9675.png)

You should now be in your DevCloud home folder in an interactive computer node.

* For access to documentation type Ctrl+Shift+P and find command `Intel Devcloud: Get Help`


## End the Connection

To close your connection to the Intel® DevCloud and kill your interactive session:

* Press `Ctrl+Shift+P ( or View -> Command Palette... )` to open the Command Palette.
. Type **DevCloud** and select `Intel DevCloud: Close connection` or

* Close Visual Studio Code window with extension.

## License
This extension is released under the MIT License.

*Other names and brands may be claimed as the property of others.


## Known Issues

