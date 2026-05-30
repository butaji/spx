import XCTest
@testable import SPX

final class SpotifyImageTests: XCTestCase {

    // MARK: - Full JSON Decoding Tests

    func testDecodingFullSpotifyImage() throws {
        let json = Data("""
        {
            "url": "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4",
            "height": 640,
            "width": 640
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4")
        XCTAssertEqual(image.height, 640)
        XCTAssertEqual(image.width, 640)
    }

    func testDecodingSpotifyImageWithAllFields() throws {
        let json = Data("""
        {
            "url": "https://example.com/image.jpg",
            "height": 1000,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/image.jpg")
        XCTAssertEqual(image.height, 1000)
        XCTAssertEqual(image.width, 500)
    }

    // MARK: - Minimal JSON Decoding Tests

    func testDecodingMinimalSpotifyImage() throws {
        let json = Data("""
        {
            "url": "https://example.com/minimal.jpg"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/minimal.jpg")
        XCTAssertNil(image.height)
        XCTAssertNil(image.width)
    }

    // MARK: - Null Handling Tests

    func testDecodingSpotifyImageWithNullDimensions() throws {
        let json = Data("""
        {
            "url": "https://example.com/nulls.jpg",
            "height": null,
            "width": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/nulls.jpg")
        XCTAssertNil(image.height)
        XCTAssertNil(image.width)
    }

    func testDecodingSpotifyImageWithNullHeight() throws {
        let json = Data("""
        {
            "url": "https://example.com/nullheight.jpg",
            "height": null,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/nullheight.jpg")
        XCTAssertNil(image.height)
        XCTAssertEqual(image.width, 500)
    }

    func testDecodingSpotifyImageWithNullWidth() throws {
        let json = Data("""
        {
            "url": "https://example.com/nullwidth.jpg",
            "height": 300,
            "width": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/nullwidth.jpg")
        XCTAssertEqual(image.height, 300)
        XCTAssertNil(image.width)
    }

    // MARK: - Dimension Value Tests

    func testDecodingSpotifyImageWithZeroDimensions() throws {
        let json = Data("""
        {
            "url": "https://example.com/zero.jpg",
            "height": 0,
            "width": 0
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.height, 0)
        XCTAssertEqual(image.width, 0)
    }

    func testDecodingSpotifyImageWithLargeDimensions() throws {
        let json = Data("""
        {
            "url": "https://example.com/large.jpg",
            "height": 99999,
            "width": 88888
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.height, 99999)
        XCTAssertEqual(image.width, 88888)
    }

    func testDecodingSpotifyImageWithSquareDimensions() throws {
        let json = Data("""
        {
            "url": "https://example.com/square.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.height, image.width)
        XCTAssertEqual(image.height, 500)
    }

    func testDecodingSpotifyImageWithRectangularDimensions() throws {
        let json = Data("""
        {
            "url": "https://example.com/rect.jpg",
            "height": 300,
            "width": 600
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.height, 300)
        XCTAssertEqual(image.width, 600)
        XCTAssertNotEqual(image.height, image.width)
    }

    // MARK: - URL Format Tests

    func testDecodingSpotifyImageWithSpotifyUrl() throws {
        let json = Data("""
        {
            "url": "https://i.scdn.co/image/ab67616d00001e02abc19b5051a2c5e3c1d28bb4",
            "height": 640,
            "width": 640
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertTrue(image.url.hasPrefix("https://i.scdn.co/image/"))
    }

    func testDecodingSpotifyImageWithHttpUrl() throws {
        let json = Data("""
        {
            "url": "http://example.com/image.jpg",
            "height": 100,
            "width": 200
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "http://example.com/image.jpg")
    }

    func testDecodingSpotifyImageWithDataUrl() throws {
        let json = Data("""
        {
            "url": "data:image/png;base64,abc123",
            "height": 64,
            "width": 64
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertTrue(image.url.hasPrefix("data:"))
    }

    // MARK: - Equality Tests

    func testSpotifyImageEquality() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/equal.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/equal.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        XCTAssertEqual(image1, image2)
    }

    func testSpotifyImageInequalityByUrl() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/image1.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/image2.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        XCTAssertNotEqual(image1, image2)
    }

    func testSpotifyImageInequalityByHeight() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/same.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/same.jpg",
            "height": 600,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        XCTAssertNotEqual(image1, image2)
    }

    func testSpotifyImageInequalityByWidth() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/same.jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/same.jpg",
            "height": 500,
            "width": 600
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        XCTAssertNotEqual(image1, image2)
    }

    // MARK: - Hashable Tests

    func testSpotifyImageHashable() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/hash.jpg",
            "height": 300,
            "width": 300
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/hash.jpg",
            "height": 300,
            "width": 300
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        var hashSet = Set<SpotifyImage>()
        hashSet.insert(image1)
        hashSet.insert(image2)

        XCTAssertEqual(hashSet.count, 1)
    }

    func testSpotifyImageHashableDifferentUrls() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/hash1.jpg"
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/hash2.jpg"
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        var hashSet = Set<SpotifyImage>()
        hashSet.insert(image1)
        hashSet.insert(image2)

        XCTAssertEqual(hashSet.count, 2)
    }

    func testSpotifyImageHashableInDictionary() throws {
        let json = Data("""
        {
            "url": "https://example.com/dict.jpg",
            "height": 100,
            "width": 100
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        var dict = [SpotifyImage: String]()
        dict[image] = "testValue"

        XCTAssertEqual(dict[image], "testValue")
    }

    func testSpotifyImageHashableWithNullDimensions() throws {
        let json1 = Data("""
        {
            "url": "https://example.com/nullhash.jpg",
            "height": null,
            "width": null
        }
        """.utf8)

        let json2 = Data("""
        {
            "url": "https://example.com/nullhash.jpg",
            "height": null,
            "width": null
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image1 = try decoder.decode(SpotifyImage.self, from: json1)
        let image2 = try decoder.decode(SpotifyImage.self, from: json2)

        XCTAssertEqual(image1, image2)
        XCTAssertEqual(image1.hashValue, image2.hashValue)
    }

    // MARK: - Array Decoding Tests

    func testDecodingSpotifyImageArray() throws {
        let json = Data("""
        [
            {"url": "https://example.com/img1.jpg", "height": 640, "width": 640},
            {"url": "https://example.com/img2.jpg", "height": 320, "width": 320},
            {"url": "https://example.com/img3.jpg", "height": 160, "width": 160}
        ]
        """.utf8)

        let decoder = JSONDecoder()
        let images = try decoder.decode([SpotifyImage].self, from: json)

        XCTAssertEqual(images.count, 3)
        XCTAssertEqual(images[0].url, "https://example.com/img1.jpg")
        XCTAssertEqual(images[1].url, "https://example.com/img2.jpg")
        XCTAssertEqual(images[2].url, "https://example.com/img3.jpg")
        XCTAssertEqual(images[0].height, 640)
        XCTAssertEqual(images[1].height, 320)
        XCTAssertEqual(images[2].height, 160)
    }

    func testDecodingEmptySpotifyImageArray() throws {
        let json = Data("""
        []
        """.utf8)

        let decoder = JSONDecoder()
        let images = try decoder.decode([SpotifyImage].self, from: json)

        XCTAssertTrue(images.isEmpty)
    }

    func testDecodingSpotifyImageArrayWithMixedDimensions() throws {
        let json = Data("""
        [
            {"url": "https://example.com/full.jpg", "height": 500, "width": 500},
            {"url": "https://example.com/noheight.jpg", "width": 300},
            {"url": "https://example.com/nowidth.jpg", "height": 400},
            {"url": "https://example.com/minimal.jpg"}
        ]
        """.utf8)

        let decoder = JSONDecoder()
        let images = try decoder.decode([SpotifyImage].self, from: json)

        XCTAssertEqual(images.count, 4)
        XCTAssertEqual(images[0].height, 500)
        XCTAssertEqual(images[1].height, nil)
        XCTAssertEqual(images[2].height, 400)
        XCTAssertEqual(images[3].height, nil)
    }

    // MARK: - Special Character URL Tests

    func testDecodingSpotifyImageWithSpecialCharactersInUrl() throws {
        let json = Data("""
        {
            "url": "https://example.com/image with spaces.jpg",
            "height": 100,
            "width": 100
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertEqual(image.url, "https://example.com/image with spaces.jpg")
    }

    func testDecodingSpotifyImageWithQueryParamsInUrl() throws {
        let json = Data("""
        {
            "url": "https://example.com/image.jpg?size=large&format=jpg",
            "height": 500,
            "width": 500
        }
        """.utf8)

        let decoder = JSONDecoder()
        let image = try decoder.decode(SpotifyImage.self, from: json)

        XCTAssertTrue(image.url.contains("?"))
        XCTAssertTrue(image.url.contains("size=large"))
    }
}
