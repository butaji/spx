import SwiftUI

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: SPXColors.accent))
                .scaleEffect(1.2)

            Text("Restoring session...")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(SPXColors.fgSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(SPXColors.bg)
    }
}

#Preview {
    LoadingView()
}
