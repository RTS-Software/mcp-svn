
# SVN MCP Server

A full-featured MCP (Model Context Protocol) server for integration with Subversion (SVN), designed to allow AI agents to efficiently manage SVN repositories.

## 🎯 Features

- ✅ **Basic repository operations**: info, status, log, diff, checkout, update
- ✅ **File management**: add, commit, delete, revert
- ✅ **Maintenance tools**: cleanup
- 🔄 **Branch management**: (In development)
- 🔄 **Advanced operations**: merge, switch, properties (In development)
- 🔄 **Analysis tools**: blame, conflict detection (In development)
- 🔄 **Batch operations**: (In development)

## 📋 Requirements

- **Node.js** >= 18.0.0 (https://nodejs.org/en/download)
- **Subversion (SVN)** installed and available in PATH
- **TypeScript** (for development) (npm i typescript)

### 🔍 Detect SVN Installation

#### Check if SVN is installed

```bash
# Basic command to check SVN
svn --version

# Check full path of the executable
where svn        # Windows
which svn        # Linux/Mac

# Check full SVN client
svn --version --verbose
```

#### Expected output if SVN is correctly installed:

```
svn, version 1.14.x (r1876290)
   compiled Apr 13 2023, 17:22:07 on x86_64-pc-mingw32

Copyright (C) 2023 The Apache Software Foundation.
This software consists of contributions made by many people;
see the NOTICE file for more information.
Subversion is open source software, see http://subversion.apache.org/
```

#### ❌ Common errors if SVN is NOT installed:

```bash
# Windows
'svn' is not recognized as an internal or external command

# Linux/Mac  
svn: command not found
bash: svn: command not found
```

#### 🛠️ Advanced diagnostics

```bash
# Check system PATH
echo $PATH                    # Linux/Mac
echo %PATH%                   # Windows CMD
$env:PATH                     # Windows PowerShell

# Search for SVN executables on the system
find / -name "svn" 2>/dev/null           # Linux
Get-ChildItem -Path C:\ -Name "svn.exe" -Recurse -ErrorAction SilentlyContinue  # Windows PowerShell

# Check specific client version
svn --version | head -1       # Get only the first line with the version
```

### 💾 Install SVN on Windows

#### Option 1: Package managers

```bash
# Using Chocolatey (Recommended)
choco install subversion

# Using winget
winget install CollabNet.Subversion

# Using Scoop
scoop install subversion
```

#### Option 2: Official installers

1. **TortoiseSVN** (includes command line client):
   ```
   https://tortoisesvn.net/downloads.html
   ✅ Includes GUI and CLI client
   ✅ Windows Explorer integration
   ```

2. **SlikSVN** (command line only):
   ```
   https://sliksvn.com/download/
   ✅ Lightweight (CLI only)
   ✅ Ideal for automation
   ```

3. **CollabNet Subversion**:
   ```
   https://www.collab.net/downloads/subversion
   ✅ Enterprise version
   ✅ Commercial support available
   ```

#### Option 3: Visual Studio or Git for Windows

```bash
# If you have Git for Windows installed, it may include SVN
git svn --version

# Visual Studio may also include SVN
# Go to: Visual Studio Installer > Modify > Individual Components > Subversion
```

### 🐧 Install SVN on Linux

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install subversion

# CentOS/RHEL/Fedora
sudo yum install subversion        # CentOS 7
sudo dnf install subversion        # CentOS 8/Fedora

# Arch Linux
sudo pacman -S subversion

# Alpine Linux
sudo apk add subversion
```

### 🍎 Install SVN on macOS

```bash
# Homebrew (Recommended)
brew install subversion

# MacPorts
sudo port install subversion

# From Xcode Command Line Tools (may be included)
xcode-select --install
```

### 🔧 Configure SVN after installation

#### Check global configuration

```bash
# View current configuration
svn config --list

# Set global user
svn config --global auth:username your_user

# Set default editor
svn config --global editor "code --wait"     # VS Code
svn config --global editor "notepad"         # Windows Notepad
svn config --global editor "nano"            # Linux/Mac nano
```

#### Check repository access

```bash
# Test connection to repository (without checkout)
svn list https://svn.example.com/repo/trunk

# Test with specific credentials
svn list https://svn.example.com/repo/trunk --username user --password password
```

## 🚀 Installation

### From NPM

```bash
npm install -g @grec0/mcp-svn
```

### Local Development

```bash
git clone https://github.com/gcorroto/mcp-svn.git
cd mcp-svn
npm install
npm run build
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SVN_PATH` | Path to SVN executable | `svn` |
| `SVN_WORKING_DIRECTORY` | Working directory | `process.cwd()` |
| `SVN_USERNAME` | Username for authentication | - |
| `SVN_PASSWORD` | Password for authentication | - |
| `SVN_TIMEOUT` | Timeout in milliseconds | `30000` |

### Example MCP configuration

```json
{
  "mcpServers": {
    "svn": {
      "command": "npx",
      "args": ["@grec0/mcp-svn"],
      "env": {
        "SVN_PATH": "svn",
        "SVN_WORKING_DIRECTORY": "/path/to/working/copy",
        "SVN_USERNAME": "your_user",
        "SVN_PASSWORD": "your_password"
      }
    }
  }
}
```

## 🛠️ Available Tools

### Basic Operations

#### `svn_health_check`
Check the health status of the SVN system and working copy.

```
svn_health_check()
```

#### `svn_info`
Get detailed information about the working copy or a specific file.

```
svn_info(path?: string)
```

#### `svn_status` 
View the status of files in the working copy.

```
svn_status(path?: string, showAll?: boolean)
```

#### `svn_log`
View the commit history of the repository.

```
svn_log(path?: string, limit?: number, revision?: string)
```

#### `svn_diff`
View differences between file versions.

```
svn_diff(path?: string, oldRevision?: string, newRevision?: string)
```

### Repository Operations

#### `svn_checkout`
Checkout an SVN repository.

```
svn_checkout(
  url: string,
  path?: string,
  revision?: number | "HEAD",
  depth?: "empty" | "files" | "immediates" | "infinity",
  force?: boolean,
  ignoreExternals?: boolean
)
```

#### `svn_update`
Update the working copy from the repository.

```
svn_update(
  path?: string,
  revision?: number | "HEAD" | "BASE" | "COMMITTED" | "PREV",
  force?: boolean,
  ignoreExternals?: boolean,
  acceptConflicts?: "postpone" | "base" | "mine-conflict" | "theirs-conflict" | "mine-full" | "theirs-full"
)
```

### File Management

#### `svn_add`
Add files to version control.

```
svn_add(
  paths: string | string[],
  force?: boolean,
  noIgnore?: boolean,
  parents?: boolean,
  autoProps?: boolean,
  noAutoProps?: boolean
)
```

#### `svn_commit`
Commit changes to the repository.

```
svn_commit(
  message: string,
  paths?: string[],
  file?: string,
  force?: boolean,
  keepLocks?: boolean,
  noUnlock?: boolean
)
```

#### `svn_delete`
Delete files from version control.

```
svn_delete(
  paths: string | string[],
  message?: string,
  force?: boolean,
  keepLocal?: boolean
)
```

#### `svn_revert`
Revert local changes in files.

```
svn_revert(paths: string | string[])
```

### Maintenance Tools

#### `svn_cleanup`
Clean up the working copy from interrupted operations.

```
svn_cleanup(path?: string)
```

## 📖 Usage Examples

### Check system status

```javascript
// Check that SVN is available and the working copy is valid
const healthCheck = await svn_health_check();
```

### Get repository information

```javascript
// General information about the working copy
const info = await svn_info();

// Information about a specific file
const fileInfo = await svn_info("src/main.js");
```

### View file status

```javascript
// Status of all files
const status = await svn_status();

// Status with remote information
const fullStatus = await svn_status(null, true);
```

### Checkout a repository

```javascript
const checkout = await svn_checkout(
  "https://svn.example.com/repo/trunk",
  "local-copy",
  "HEAD",
  "infinity",
  false,
  false
);
```

### Commit changes

```javascript
// Add files
await svn_add(["src/new-file.js", "docs/readme.md"], { parents: true });

// Commit
await svn_commit(
  "Add new feature and documentation",
  ["src/new-file.js", "docs/readme.md"]
);
```

## 🧪 Testing

```bash
# Run tests
npm test

# Tests with coverage
npm run test -- --coverage

# Tests in watch mode
npm run test -- --watch
```

## 🏗️ Development

### Available scripts

```bash
# Compile TypeScript
npm run build

# Development mode
npm run dev

# Watch mode
npm run watch

# MCP Inspector
npm run inspector

# Tests
npm test

# Publish new version
npm run release:patch
npm run release:minor
npm run release:major
```

### Project structure

```
svn-mcp/
├── package.json
├── tsconfig.json
├── jest.config.js
├── index.ts
├── common/
│   ├── types.ts      # TypeScript types
│   ├── utils.ts      # SVN utilities
│   └── version.ts    # Package version
├── tools/
│   └── svn-service.ts # Main SVN service
├── tests/
│   └── integration.test.ts # Integration tests
└── README.md
```

## 📊 Development Status

See the file [SVN_MCP_IMPLEMENTATION.md](./SVN_MCP_IMPLEMENTATION.md) for the full implementation checklist.

**Current progress:** Stage 1 completed (Basic Operations) ✅

**Next stages:**
- Branch management
- Advanced operations (merge, switch)
- Analysis tools
- Batch operations

## 🐛 Troubleshooting

### SVN not found

```
Error: SVN is not available in the system PATH
```

**Solution:** Install SVN and make sure it is in the system PATH.

### Not a working copy

```
Error: Failed to get SVN info: svn: warning: W155007: '.' is not a working copy
```

**Solution:** Navigate to a directory that is an SVN working copy or perform a checkout first.

### Authentication problems

```
Error: svn: E170001: Authentication failed
```

**Solution:** Set the environment variables `SVN_USERNAME` and `SVN_PASSWORD`.

### Timeout on long operations

```
Error: Command timeout after 30000ms
```

**Solution:** Increase the value of `SVN_TIMEOUT`.

## 📄 License

MIT License - see [LICENSE](LICENSE) for more details.

## 🤝 Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/gcorroto/mcp-svn/issues)
- **Documentation:** [Project Wiki](https://github.com/gcorroto/mcp-svn/wiki)
- **Email:** support@grec0.dev