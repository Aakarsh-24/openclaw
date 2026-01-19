import XCTest
@testable import ClawdbotChatUI

/// Tests for envelope stripping functionality in chat messages
final class ChatEnvelopeStrippingTests: XCTestCase {

    func testStripWebChatEnvelopeWithElapsedTime() {
        let text = "[WebChat agent:main:main +2m 2026-01-19 09:29 UTC] hello world"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "hello world")
    }

    func testStripTelegramEnvelopeWithElapsedTime() {
        let text = "[Telegram User (@userid) id:1516306909 +30s 2026-01-19 19:29 NZDT] test message"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "test message")
    }

    func testStripEnvelopeWithoutElapsedTime() {
        let text = "[WhatsApp +1234567890 2026-01-19 05:19 PST] hi there"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "hi there")
    }

    func testMultiLineMessage() {
        let text = "[WebChat agent:main:main +5m 2026-01-19 05:19 EST] first line\nsecond line"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "first line\nsecond line")
    }

    func testNoEnvelopePresent() {
        let text = "just a regular message"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "just a regular message")
    }

    func testEmptyString() {
        let text = ""
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "")
    }

    func testComplexSenderInfo() {
        let text = "[Signal John Doe (+1-555-0100) id:abc123 +1h 2026-01-19 05:19 GMT] meeting tomorrow?"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "meeting tomorrow?")
    }

    func testSpecialCharactersInFromField() {
        let text = "[iMessage Group: Work Team id:group-456 +45s 2026-01-19 05:19 JST] project update"
        let stripped = stripEnvelope(text)
        XCTAssertEqual(stripped, "project update")
    }
}
