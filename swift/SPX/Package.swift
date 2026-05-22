// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SPX",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "SPX", targets: ["SPX"])
    ],
    dependencies: [],
    targets: [
        .executableTarget(
            name: "SPX",
            path: ".",
            exclude: ["Info.plist", "SPX.entitlements", "Tests"],
            swiftSettings: [
                .enableExperimentalFeature("StrictConcurrency")
            ]
        ),
        .testTarget(
            name: "SPXTests",
            dependencies: ["SPX"],
            path: "Tests"
        )
    ]
)
