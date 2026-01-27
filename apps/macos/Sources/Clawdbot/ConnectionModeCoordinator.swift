import Foundation
import OSLog

@MainActor
final class ConnectionModeCoordinator {
    static let shared = ConnectionModeCoordinator()

    private let logger = Logger(subsystem: "com.clawdbot", category: "connection")
    private var lastMode: AppState.ConnectionMode?
    private var applyTask: Task<Void, Never>?

    /// Apply the requested connection mode by starting/stopping local gateway,
    /// managing the control-channel SSH tunnel, and cleaning up chat windows/panels.
    /// This spawns a background task to avoid blocking the UI during gateway startup.
    /// Cancels any in-flight mode transition to prevent concurrent state changes.
    func apply(mode: AppState.ConnectionMode, paused: Bool) {
        // Cancel previous mode transition if still running
        applyTask?.cancel()

        applyTask = Task.detached(priority: .userInitiated) { [weak self] in
            await self?.applyAsync(mode: mode, paused: paused)
        }
    }

    private func applyAsync(mode: AppState.ConnectionMode, paused: Bool) async {
        // Check for cancellation before starting work
        guard !Task.isCancelled else { return }

        let lastMode = await MainActor.run { self.lastMode }
        if let lastMode, lastMode != mode {
            await MainActor.run {
                GatewayProcessManager.shared.clearLastFailure()
                NodesStore.shared.lastError = nil
            }
        }
        await MainActor.run { self.lastMode = mode }

        // Check for cancellation before mode-specific logic
        guard !Task.isCancelled else { return }

        switch mode {
        case .unconfigured:
            _ = await NodeServiceManager.stop()
            guard !Task.isCancelled else { return }
            await MainActor.run { NodesStore.shared.lastError = nil }
            await RemoteTunnelManager.shared.stopAll()
            guard !Task.isCancelled else { return }
            await MainActor.run {
                WebChatManager.shared.resetTunnels()
                GatewayProcessManager.shared.stop()
            }
            await GatewayConnection.shared.shutdown()
            guard !Task.isCancelled else { return }
            await ControlChannel.shared.disconnect()
            guard !Task.isCancelled else { return }
            Task.detached { await PortGuardian.shared.sweep(mode: .unconfigured) }

        case .local:
            _ = await NodeServiceManager.stop()
            guard !Task.isCancelled else { return }
            await MainActor.run { NodesStore.shared.lastError = nil }
            await RemoteTunnelManager.shared.stopAll()
            guard !Task.isCancelled else { return }
            await MainActor.run { WebChatManager.shared.resetTunnels() }
            let shouldStart = GatewayAutostartPolicy.shouldStartGateway(mode: .local, paused: paused)
            if shouldStart {
                guard !Task.isCancelled else { return }
                await MainActor.run { GatewayProcessManager.shared.setActive(true) }
                if GatewayAutostartPolicy.shouldEnsureLaunchAgent(
                    mode: .local,
                    paused: paused)
                {
                    Task { await GatewayProcessManager.shared.ensureLaunchAgentEnabledIfNeeded() }
                }
                // Note: GatewayProcessManager.startIfNeeded() includes its own readiness polling
                // via enableLaunchdGateway() (which waits up to 6 seconds for the gateway to accept
                // connections), so no additional wait is needed here.
            } else {
                await MainActor.run { GatewayProcessManager.shared.stop() }
            }
            guard !Task.isCancelled else { return }
            do {
                try await ControlChannel.shared.configure(mode: .local)
            } catch {
                // Control channel will mark itself degraded; nothing else to do here.
                self.logger.error(
                    "control channel local configure failed: \(error.localizedDescription, privacy: .public)")
            }
            guard !Task.isCancelled else { return }
            Task.detached { await PortGuardian.shared.sweep(mode: .local) }

        case .remote:
            // Never run a local gateway in remote mode.
            await MainActor.run { GatewayProcessManager.shared.stop() }
            guard !Task.isCancelled else { return }
            await MainActor.run { WebChatManager.shared.resetTunnels() }

            do {
                await MainActor.run { NodesStore.shared.lastError = nil }
                guard !Task.isCancelled else { return }
                if let error = await NodeServiceManager.start() {
                    await MainActor.run { NodesStore.shared.lastError = "Node service start failed: \(error)" }
                }
                guard !Task.isCancelled else { return }
                _ = try await GatewayEndpointStore.shared.ensureRemoteControlTunnel()
                guard !Task.isCancelled else { return }
                let settings = CommandResolver.connectionSettings()
                try await ControlChannel.shared.configure(mode: .remote(
                    target: settings.target,
                    identity: settings.identity))
            } catch {
                self.logger.error("remote tunnel/configure failed: \(error.localizedDescription, privacy: .public)")
            }
            guard !Task.isCancelled else { return }

            Task.detached { await PortGuardian.shared.sweep(mode: .remote) }
        }
    }
}
