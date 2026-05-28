import SwiftUI

// MARK: - IconHeart

struct IconHeart: View {
    var filled: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: filled ? "heart.fill" : "heart")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconPlay

struct IconPlay: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "play.fill")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconPause

struct IconPause: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "pause.fill")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconPrev

struct IconPrev: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "backward.end.fill")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconNext

struct IconNext: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "forward.end.fill")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconVolume

struct IconVolume: View {
    var muted: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: muted ? "speaker.slash" : "speaker.wave.2")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconShuffle

struct IconShuffle: View {
    var active: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "shuffle")
            .font(.system(size: size, weight: .light))
            .foregroundColor(active ? Color.spxAccent : Color.spxTextPrimary)
    }
}

// MARK: - IconRepeat

struct IconRepeat: View {
    var mode: String = "off" // off, context, track
    var size: CGFloat = 20

    var body: some View {
        ZStack {
            Image(systemName: "repeat")
                .font(.system(size: size, weight: .light))

            if mode == "track" {
                Text("1")
                    .font(.system(size: size * 0.4, weight: .bold))
                    .foregroundColor(Color.spxAccent)
            }
        }
        .foregroundColor(mode != "off" ? Color.spxAccent : Color.spxTextPrimary)
    }
}

// MARK: - IconHome

struct IconHome: View {
    var active: Bool = false
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "house")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconSearch

struct IconSearch: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "magnifyingglass")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconClose

struct IconClose: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "xmark")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconTag

struct IconTag: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "tag")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconShare

struct IconShare: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "square.and.arrow.up")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconFlame

struct IconFlame: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "flame")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconChart

struct IconChart: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "chart.bar")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconMusic

struct IconMusic: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "music.note")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconQueue

struct IconQueue: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "list.bullet")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconDevice

struct IconDevice: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "laptopcomputer")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconEllipsis

struct IconEllipsis: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "ellipsis")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconGrid

struct IconGrid: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "square.grid.2x2")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconLink

struct IconLink: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "link")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconAdd

struct IconAdd: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "plus")
            .font(.system(size: size, weight: .light))
    }
}

// MARK: - IconPerson

struct IconPerson: View {
    var size: CGFloat = 20

    var body: some View {
        Image(systemName: "person")
            .font(.system(size: size, weight: .light))
    }
}
