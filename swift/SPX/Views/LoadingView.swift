import SwiftUI

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color.spxAccent))
                .scaleEffect(1.2)

            Text("Restoring session...")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color.spxTextSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.spxBase)
        .accessibilityIdentifier("loading-view")
    }
}

#Preview {
    LoadingView()
}
