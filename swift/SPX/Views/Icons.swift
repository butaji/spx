import SwiftUI

// MARK: - IconHeart

struct IconHeart: View {
    var filled: Bool = false
    var size: CGFloat = 20

    var body: some View {
        if filled {
            Image(systemName: "heart.fill")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        } else {
            Image(systemName: "heart")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
        }
    }
}

// MARK: - IconPlay

struct IconPlay: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "play.fill")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconPause

struct IconPause: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "pause.fill")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconPrev

struct IconPrev: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "backward.fill")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconNext

struct IconNext: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "forward.fill")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconVolume

struct IconVolume: View {
    var muted: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: muted ? "speaker.slash.fill" : "speaker.wave.2.fill")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconShuffle

struct IconShuffle: View {
    var active: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "shuffle")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .foregroundColor(active ? SPXColors.accent : SPXColors.fg)
    }
}

// MARK: - IconRepeat

struct IconRepeat: View {
    var mode: String = "off" // off, context, track
    var size: CGFloat = 20

    var body: some View {
        ZStack {
            Image(systemName: "repeat")
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)

            if mode == "track" {
                Text("1")
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundColor(SPXColors.accent)
            }
        }
        .foregroundColor(mode != "off" ? SPXColors.accent : SPXColors.fg)
    }
}

// MARK: - IconHome

struct IconHome: View {
    var active: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: active ? "house.fill" : "house")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconSearch

struct IconSearch: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "magnifyingglass")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconLibrary

struct IconLibrary: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "music.note.list")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconQueue

struct IconQueue: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "list.bullet")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconClose

struct IconClose: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "xmark")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconTag

struct IconTag: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "tag")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconShare

struct IconShare: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "square.and.arrow.up")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconFlame

struct IconFlame: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "flame")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}

// MARK: - IconChart

struct IconChart: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "chart.bar")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
    }
}
