import SwiftUI

// MARK: - Auth View
struct AuthView: View {
    @Environment(AppState.self) private var appState
    let onConnect: () -> Void

    @State private var isAppeared = false
    @State private var pulseAnimation = false

    var body: some View {
        ZStack {
            // Animated mesh gradient background
            MeshGradientBackground()

            VStack(spacing: 0) {
                Spacer()

                // Main card with frosted glass effect
                VStack(spacing: 20) {
                    // Logo with pulsing glow
                    AnimatedLogoView(pulseAnimation: pulseAnimation)
                        .opacity(isAppeared ? 1 : 0)
                        .offset(y: isAppeared ? 0 : -20)

                    // Title
                    Text("SPX")
                        .font(.system(size: 56, weight: .heavy, design: .rounded))
                        .foregroundColor(Color.spxTextPrimary)
                        .tracking(8)
                        .opacity(isAppeared ? 1 : 0)
                        .offset(y: isAppeared ? 0 : -20)

                    // Subtitle
                    HStack(spacing: 8) {
                        Text("Spotify")
                            .foregroundColor(Color.spxAccent)
                            .fontWeight(.bold)

                        Text("Remote Control")
                            .foregroundColor(Color.spxTextSecondary)
                            .fontWeight(.medium)
                    }
                    .font(.system(size: 16))
                    .opacity(isAppeared ? 1 : 0)
                    .offset(y: isAppeared ? 0 : -20)

                    // Description
                    Text("Control your Spotify playback from a beautiful desktop app")
                        .font(.system(size: 14))
                        .foregroundColor(Color.spxTextTertiary)
                        .multilineTextAlignment(.center)
                        .lineSpacing(5)
                        .opacity(isAppeared ? 1 : 0)
                        .offset(y: isAppeared ? 0 : -20)

                    // Error state
                    if let error = appState.appError {
                        AnimatedErrorView(error: error)
                            .transition(.asymmetric(
                                insertion: .move(edge: .top).combined(with: .opacity),
                                removal: .opacity
                            ))
                    }

                    // Connect Button
                    ConnectButton(
                        isLoading: appState.isAuthLoading,
                        action: {
                            appState.appError = nil
                            onConnect()
                        }
                    )
                    .opacity(isAppeared ? 1 : 0)
                    .offset(y: isAppeared ? 0 : 20)

                    if appState.isAuthLoading {
                        Button(action: {
                            appState.cancelAuth()
                        }) {
                            Text("Cancel")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(Color.spxTextTertiary)
                        }
                        .buttonStyle(.plain)
                        .focusable(false)
                        .opacity(isAppeared ? 1 : 0)
                        .accessibilityLabel("Cancel")
                        .accessibilityIdentifier("cancel-auth-button")
                    }

                    Text("Requires a Spotify Premium account")
                        .font(.system(size: 11))
                        .foregroundColor(Color.spxTextTertiary)
                        .multilineTextAlignment(.center)
                        .opacity(isAppeared ? 0.6 : 0)
                }
                .padding(.vertical, 44)
                .padding(.horizontal, 44)
                .frame(maxWidth: 420)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.15),
                                    Color.white.opacity(0.05)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
                .shadow(
                    color: Color.black.opacity(0.2),
                    radius: 20,
                    x: 0,
                    y: 8
                )
                .shadow(
                    color: Color.spxAccent.opacity(0.05),
                    radius: 40,
                    x: 0,
                    y: 0
                )

                Spacer()
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8).delay(0.1)) {
                isAppeared = true
            }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulseAnimation = true
            }
        }
    }
}

// MARK: - Animated Logo View
struct AnimatedLogoView: View {
    let pulseAnimation: Bool

    var body: some View {
        ZStack {
            // Pulsing glow ring
            Circle()
                .stroke(Color.spxAccent.opacity(0.3), lineWidth: 2)
                .frame(width: 120, height: 120)
                .scaleEffect(pulseAnimation ? 1.15 : 1.0)
                .opacity(pulseAnimation ? 0.4 : 0.8)

            // Inner glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [Color.spxAccent.opacity(0.2), Color.clear],
                        center: .center,
                        startRadius: 0,
                        endRadius: 50
                    )
                )
                .frame(width: 100, height: 100)
                .opacity(0.6)

            // Logo circle background
            Circle()
                .fill(Color.spxAccent.opacity(0.15))
                .frame(width: 80, height: 80)

            // Spotify icon
            SpotifyIconView()
                .frame(width: 40, height: 40)
        }
    }
}

// MARK: - Spotify Icon View (Custom Shape)
struct SpotifyIconView: View {
    var body: some View {
        ZStack {
            // Green circle background
            Circle()
                .fill(Color.spxAccent)
                .frame(width: 40, height: 40)

            // Three curved lines (simplified Spotify logo)
            Path { path in
                // Center dot
                path.addEllipse(in: CGRect(x: 16, y: 14, width: 8, height: 12))
            }
            .fill(Color.white)

            // Left arc
            Path { path in
                path.move(to: CGPoint(x: 12, y: 12))
                path.addQuadCurve(
                    to: CGPoint(x: 12, y: 28),
                    control: CGPoint(x: 6, y: 20)
                )
            }
            .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))

            // Right arc
            Path { path in
                path.move(to: CGPoint(x: 28, y: 12))
                path.addQuadCurve(
                    to: CGPoint(x: 28, y: 28),
                    control: CGPoint(x: 34, y: 20)
                )
            }
            .stroke(Color.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
        }
    }
}

// MARK: - Mesh Gradient Background
struct MeshGradientBackground: View {
    @State private var phase: CGFloat = 0

    var body: some View {
        ZStack {
            // Base gradient
            Color.spxBase
                .ignoresSafeArea()

            // Animated orbs
            GeometryReader { geometry in
                ZStack {
                    // Primary accent orb
                    AnimatedOrb(
                        size: 500,
                        color: Color.spxAccent,
                        opacity: 0.12,
                        position: CGPoint(
                            x: geometry.size.width * 0.3,
                            y: geometry.size.height * 0.2
                        ),
                        phase: phase,
                        speed: 0.3
                    )

                    // Secondary purple orb
                    AnimatedOrb(
                        size: 400,
                        color: Color.spxAccent,
                        opacity: 0.06,
                        position: CGPoint(
                            x: geometry.size.width * 0.75,
                            y: geometry.size.height * 0.7
                        ),
                        phase: phase + 1.5,
                        speed: 0.2
                    )

                    // Tertiary accent
                    AnimatedOrb(
                        size: 350,
                        color: Color.spxAccent,
                        opacity: 0.08,
                        position: CGPoint(
                            x: geometry.size.width * 0.8,
                            y: geometry.size.height * 0.2
                        ),
                        phase: phase + 3.0,
                        speed: 0.25
                    )

                    // Subtle blue
                    AnimatedOrb(
                        size: 300,
                        color: Color.spxAccent,
                        opacity: 0.04,
                        position: CGPoint(
                            x: geometry.size.width * 0.15,
                            y: geometry.size.height * 0.75
                        ),
                        phase: phase + 4.5,
                        speed: 0.15
                    )
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }
}

// MARK: - Animated Orb
struct AnimatedOrb: View {
    let size: CGFloat
    let color: Color
    let opacity: Double
    let position: CGPoint
    let phase: CGFloat
    let speed: Double

    var body: some View {
        let offset = sin(phase) * 30

        Circle()
            .fill(
                RadialGradient(
                    colors: [color.opacity(opacity), Color.clear],
                    center: .center,
                    startRadius: 0,
                    endRadius: size / 2
                )
            )
            .frame(width: size, height: size)
            .blur(radius: 60)
            .offset(
                x: position.x + offset,
                y: position.y + cos(phase) * 20
            )
    }
}

// MARK: - Animated Error View
struct AnimatedErrorView: View {
    let error: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 16))
                .foregroundColor(Color.spxAccent.opacity(0.8))

            VStack(alignment: .leading, spacing: 4) {
                Text("Connection Error")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color.spxAccent.opacity(0.9))

                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(Color.spxTextTertiary)
                    .lineSpacing(2)
            }

            Spacer()
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.spxAccent.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.spxAccent.opacity(0.15), lineWidth: 1)
        )
    }
}

// MARK: - Connect Button
struct ConnectButton: View {
    let isLoading: Bool
    let action: () -> Void

    @State private var isHovered = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if isLoading {
                    ProgressView()
                        .tint(.black.opacity(0.7))
                        .scaleEffect(0.75)

                    Text("Connecting...")
                        .font(.system(size: 14, weight: .semibold))
                } else {
                    // Spotify mini icon
                    Circle()
                        .fill(Color.black.opacity(0.6))
                        .frame(width: 18, height: 18)
                        .overlay(
                            SpotifyIconView()
                                .scaleEffect(0.45)
                        )

                    Text("Connect with Spotify")
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            .foregroundColor(.black)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.spxAccent,
                                Color.spxAccent.opacity(0.9)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.white.opacity(0.2), lineWidth: 1)
            )
            .scaleEffect(isHovered ? 1.02 : 1.0)
            .brightness(isHovered ? 0.05 : 0)
        }
        .buttonStyle(.plain)
        .focusable(false)
        .disabled(isLoading)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.2)) {
                isHovered = hovering
            }
        }
        .accessibilityLabel("Connect with Spotify")
        .accessibilityIdentifier("connect-spotify-button")
    }
}

// MARK: - Loading Auth View (Placeholder)
struct LoadingAuthView: View {
    @State private var pulseAnimation = false
    @State private var isAppeared = false

    var body: some View {
        ZStack {
            Color.spxBase
                .ignoresSafeArea()

            MeshGradientBackground()

            VStack(spacing: 32) {
                // Animated Logo
                AnimatedLogoView(pulseAnimation: pulseAnimation)
                    .opacity(isAppeared ? 1 : 0)
                    .scaleEffect(isAppeared ? 1 : 0.8)

                // Equalizer Animation
                EqualizerView()
                    .opacity(isAppeared ? 1 : 0)

                // Title
                Text("SPX")
                    .font(.system(size: 42, weight: .heavy, design: .rounded))
                    .foregroundColor(Color.spxTextPrimary)
                    .tracking(6)
                    .opacity(isAppeared ? 1 : 0)

                // Status
                HStack(spacing: 4) {
                    Text("Loading")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(Color.spxTextTertiary)

                    LoadingDotsView()
                }
                .opacity(isAppeared ? 1 : 0)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.6)) {
                isAppeared = true
            }
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulseAnimation = true
            }
        }
    }
}

// MARK: - Equalizer View
struct EqualizerView: View {
    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<5, id: \.self) { index in
                EqualizerBar(delay: Double(index) * 0.15)
            }
        }
        .frame(height: 28)
    }
}

struct EqualizerBar: View {
    let delay: Double
    @State private var height: CGFloat = 8

    var body: some View {
        RoundedRectangle(cornerRadius: 2)
            .fill(Color.spxAccent)
            .frame(width: 3, height: height)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 0.6)
                    .repeatForever(autoreverses: true)
                    .delay(delay)
                ) {
                    height = CGFloat.random(in: 8...28)
                }
            }
    }
}

// MARK: - Loading Dots View
struct LoadingDotsView: View {
    @State private var dotCount = 0

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .fill(Color.spxTextTertiary)
                    .frame(width: 4, height: 4)
                    .opacity(index < dotCount ? 1 : 0.3)
            }
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                dotCount = (dotCount + 1) % 4
            }
        }
    }
}

// MARK: - Error Auth View
struct ErrorAuthView: View {
    let error: String
    let onRetry: () -> Void

    @State private var isAppeared = false
    @State private var pulseAnimation = false

    var body: some View {
        ZStack {
            Color.spxBase
                .ignoresSafeArea()

            MeshGradientBackground()

            VStack(spacing: 24) {
                // Error Icon with pulse
                ZStack {
                    // Glow ring
                    Circle()
                        .stroke(Color.spxAccent.opacity(0.3), lineWidth: 2)
                        .frame(width: 120, height: 120)
                        .scaleEffect(pulseAnimation ? 1.1 : 1.0)
                        .opacity(pulseAnimation ? 0.5 : 0.8)

                    // Background circle
                    Circle()
                        .fill(Color.spxAccent.opacity(0.1))
                        .frame(width: 100, height: 100)

                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 40))
                        .foregroundColor(Color.spxAccent.opacity(0.9))
                }
                .opacity(isAppeared ? 1 : 0)
                .scaleEffect(isAppeared ? 1 : 0.8)

                // Title
                Text("Connection Failed")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundColor(Color.spxTextPrimary)
                    .opacity(isAppeared ? 1 : 0)

                // Error Message
                Text(error)
                    .font(.system(size: 14))
                    .foregroundColor(Color.spxTextSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
                    .opacity(isAppeared ? 1 : 0)

                // Retry Button
                Button(action: onRetry) {
                    HStack(spacing: 8) {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 13, weight: .medium))

                        Text("Try Again")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundColor(.black)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color.spxAccent)
                    )
                }
                .buttonStyle(.plain)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 10)
                .accessibilityLabel("Try Again")
                .accessibilityIdentifier("retry-auth-button")
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5)) {
                isAppeared = true
            }
            withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                pulseAnimation = true
            }
        }
    }
}
