#!/usr/bin/env bash
#
# OpenClaw 中文版安装脚本 (Unofficial Fork)
# 
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/RogerPu/OpenClawCN/main/scripts/install-cn.sh | bash
#
# 环境变量:
#   INSTALL_METHOD      Install method: "npm" or "git" (默认: "git")
#   OPENCLAW_VERSION    Version to install (默认: "latest")
#   GIT_DIR             Directory for git checkout (默认: ~/.openclaw/source)
#   NO_ONBOARD          Set to "1" to skip onboarding
#   DRY_RUN             Set to "1" to print what would happen
#

set -euo pipefail

# ANSI 颜色配置
if [[ -t 1 ]]; then
    RESET='\033[0m'
    BOLD='\033[1m'
    DIM='\033[2m'
    RED='\033[31m'
    GREEN='\033[32m'
    YELLOW='\033[33m'
    BLUE='\033[34m'
    CYAN='\033[36m'
else
    RESET=''
    BOLD=''
    DIM=''
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
fi

# 图标与前缀
INFO="${BLUE}${BOLD}i${RESET} "
WARN="${YELLOW}${BOLD}!${RESET} "
ERROR="${RED}${BOLD}x${RESET} "
SUCCESS="${GREEN}${BOLD}✓${RESET} "
MUTED="${DIM}"

# 配置变量
INSTALL_METHOD="${INSTALL_METHOD:-git}" # 默认使用 git 方式安装
OPENCLAW_VERSION="${OPENCLAW_VERSION:-latest}"
GIT_REPO_URL="https://github.com/RogerPu/OpenClawCN.git" # 指向您的 fork 仓库
GIT_DIR="${GIT_DIR:-$HOME/.openclawcn/source}"
GIT_UPDATE="${GIT_UPDATE:-1}"
NO_ONBOARD="${NO_ONBOARD:-0}"
DRY_RUN="${DRY_RUN:-0}"
HELP="${HELP:-0}"
USE_BETA="${USE_BETA:-0}"

# 打印帮助信息
print_usage() {
    cat <<EOF
OpenClaw 中文版安装脚本

用法:
  curl -fsSL ... | bash -s -- [options]

选项:
  --install-method <npm|git>  安装方式 (默认: git)
  --version <ver>             指定安装版本 (默认: latest)
  --git-dir <path>            Git 源码目录 (默认: ~/.openclawcn/source)
  --no-onboard                跳过初始引导
  --dry-run                   仅打印执行计划
  --help                      显示帮助信息

环境变量:
  INSTALL_METHOD, OPENCLAW_VERSION, GIT_DIR, NO_ONBOARD, DRY_RUN
EOF
}

# 参数解析
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --install-method)
                INSTALL_METHOD="$2"
                shift 2
                ;;
            --version)
                OPENCLAW_VERSION="$2"
                shift 2
                ;;
            --git-dir)
                GIT_DIR="$2"
                shift 2
                ;;
            --no-onboard)
                NO_ONBOARD="1"
                shift
                ;;
            --dry-run)
                DRY_RUN="1"
                shift
                ;;
            --help)
                HELP="1"
                shift
                ;;
            *)
                echo -e "${ERROR}未知选项: $1"
                exit 1
                ;;
        esac
    done
}

# 检查系统依赖
check_cmd() {
    command -v "$1" >/dev/null 2>&1
}

# 辅助函数：以 root 权限运行命令
run_root() {
    if [[ $EUID -eq 0 ]]; then
        "$@"
    elif check_cmd sudo; then
        sudo "$@"
    else
        echo -e "${ERROR}需要 root 权限执行此操作，但未检测到 sudo。请以 root 用户运行脚本或安装 sudo。"
        exit 1
    fi
}

ensure_node() {
    # 尝试加载 nvm (如果用户安装了但没在 PATH 中)
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    if check_cmd node; then
        local ver
        ver=$(node -v | cut -d. -f1 | tr -d 'v')
        if [[ "$ver" -ge 18 ]]; then
            return 0
        fi
        echo -e "${WARN}Node.js 版本过低 (检测到 v${ver})，需要 v18+"
    fi

    echo -e "${INFO}未检测到 Node.js v18+，正在尝试自动安装..."

    # macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
         if check_cmd brew; then
             echo -e "${INFO}使用 Homebrew 安装 Node.js..."
             brew install node
             return 0
         fi
         # 尝试安装 nvm
         echo -e "${INFO}尝试安装 nvm..."
         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
         export NVM_DIR="$HOME/.nvm"
         [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
         if check_cmd nvm; then
             nvm install 20
             nvm alias default 20
             return 0
         fi
    
    # Linux
    elif [[ -f /etc/debian_version ]]; then
        echo -e "${INFO}检测到 Debian/Ubuntu，使用 NodeSource 安装 Node.js v20..."
        if ! check_cmd curl; then 
            run_root apt-get update && run_root apt-get install -y curl
        fi
        curl -fsSL https://deb.nodesource.com/setup_20.x | run_root bash -
        run_root apt-get install -y nodejs build-essential
        return 0
    elif [[ -f /etc/redhat-release ]]; then
        echo -e "${INFO}检测到 CentOS/RedHat，使用 NodeSource 安装 Node.js v20..."
        if ! check_cmd curl; then 
            if check_cmd dnf; then run_root dnf install -y curl; else run_root yum install -y curl; fi
        fi
        curl -fsSL https://rpm.nodesource.com/setup_20.x | run_root bash -
        if check_cmd dnf; then
            run_root dnf install -y nodejs
            # 尝试安装构建工具，失败不阻断
            run_root dnf groupinstall -y "Development Tools" || true
        else
            run_root yum install -y nodejs
            run_root yum groupinstall -y "Development Tools" || true
        fi
        return 0
    elif [[ -f /etc/alpine-release ]]; then
        echo -e "${INFO}检测到 Alpine，安装 Node.js..."
        run_root apk add nodejs npm make g++
        return 0
    fi
    
    echo -e "${ERROR}无法自动安装 Node.js，请手动安装 v18+ 后重试。"
    exit 1
}

ensure_pnpm() {
    if check_cmd pnpm; then
        return 0
    fi
    
    echo -e "${INFO}正在安装 pnpm..."
    if check_cmd corepack; then
        corepack enable
        corepack prepare pnpm@latest --activate
        return 0
    fi
    
    npm install -g pnpm
}

ensure_git() {
    if check_cmd git; then
        return 0
    fi
    
    echo -e "${INFO}未检测到 Git，正在尝试自动安装..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        if check_cmd brew; then
            echo -e "${INFO}使用 Homebrew 安装 Git..."
            brew install git
            return 0
        elif check_cmd xcode-select; then
            echo -e "${INFO}触发 Xcode 命令行工具安装..."
            xcode-select --install || true
            # xcode-select 只是触发弹窗，通常需要用户手动完成，或者脚本暂停等待
            echo -e "${WARN}请在弹出的窗口中完成安装后，再次运行此脚本。"
            exit 1
        fi
    elif [[ -f /etc/debian_version ]]; then
        echo -e "${INFO}使用 apt 安装 Git..."
        sudo apt-get update && sudo apt-get install -y git
        return 0
    elif [[ -f /etc/redhat-release ]]; then
        echo -e "${INFO}使用 yum/dnf 安装 Git..."
        if check_cmd dnf; then
            sudo dnf install -y git
        else
            sudo yum install -y git
        fi
        return 0
    elif [[ -f /etc/alpine-release ]]; then
        echo -e "${INFO}使用 apk 安装 Git..."
        sudo apk add git
        return 0
    fi

    echo -e "${ERROR}无法自动安装 Git，请手动安装后重试。"
    exit 1
}

# 配置用户 PATH
ensure_path() {
    local bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    
    # 检查 PATH 是否包含
    if [[ ":$PATH:" != *":$bin_dir:"* ]]; then
        echo -e "${WARN}您的 PATH 环境变量未包含 $bin_dir"
        echo -e "请将以下内容添加到您的 shell 配置文件 (~/.zshrc 或 ~/.bashrc):"
        echo -e "  export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
}

# 从 Git 安装
install_from_git() {
    echo -e "${INFO}正在从源码安装 OpenClaw 中文版..."
    echo -e "  仓库: ${CYAN}${GIT_REPO_URL}${RESET}"
    echo -e "  目录: ${CYAN}${GIT_DIR}${RESET}"
    
    if [[ -d "$GIT_DIR" ]]; then
        echo -e "${INFO}更新已有代码..."
        if [[ -z "$(git -C "$GIT_DIR" status --porcelain 2>/dev/null || true)" ]]; then
            git -C "$GIT_DIR" pull --rebase || true
        else
             echo -e "${WARN}本地代码有修改，跳过 git pull"
        fi
    else
        git clone "$GIT_REPO_URL" "$GIT_DIR"
    fi

    echo -e "${INFO}安装依赖..."
    # 忽略 libvips 警告，加速安装
    SHARP_IGNORE_GLOBAL_LIBVIPS=1 pnpm -C "$GIT_DIR" install

    echo -e "${INFO}构建项目..."
    pnpm -C "$GIT_DIR" ui:build
    pnpm -C "$GIT_DIR" build

    # 创建启动脚本
    local bin_path="$HOME/.local/bin/openclaw"
    mkdir -p "$(dirname "$bin_path")"
    
    cat > "$bin_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec node "${GIT_DIR}/dist/entry.js" "\$@"
EOF
    chmod +x "$bin_path"
    
    echo -e "${SUCCESS}OpenClaw 中文版已安装到: ${BOLD}${bin_path}${RESET}"
}

# 主函数
main() {
    if [[ "$HELP" == "1" ]]; then
        print_usage
        return 0
    fi

    if [[ "$DRY_RUN" == "1" ]]; then
        echo -e "${INFO}Dry Run 模式，不执行实际操作"
        return 0
    fi

    echo -e "${BOLD}🦞 OpenClaw 中文版安装程序${RESET}"
    echo -e "${DIM}================================${RESET}"

    ensure_git
    ensure_node
    ensure_pnpm
    ensure_path

    if [[ "$INSTALL_METHOD" == "git" ]]; then
        install_from_git
    else
        echo -e "${ERROR}暂不支持 npm 安装方式，请使用 --install-method git"
        exit 1
    fi

    echo ""
    echo -e "${SUCCESS}${BOLD}安装完成！${RESET}"
    echo -e "您现在可以运行 ${BOLD}openclaw${RESET} 命令来启动。"
    echo -e "首次运行推荐执行: ${BOLD}openclaw onboard${RESET}"
    echo ""
}

# 执行
parse_args "$@"
main
