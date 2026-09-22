import XCTest

extension PaymentUITests {
    func verifyPaidBackup() {
        tap(app.tabBars.buttons[ui("Settings", "Настройки")])
        tap(app.buttons[ui("Encrypted backup", "Зашифрованная копия")])
        enable(app.switches[ui("Allow sending an encrypted copy", "Разрешить отправку зашифрованной копии")])
        tap(app.buttons["backup-create"])
        XCTAssertTrue(app.staticTexts[ui("Downloaded and verified on this iPhone", "Скачана и проверена на этом iPhone")].waitForExistence(timeout: 20), app.debugDescription)
        capture("06-post-payment-backup")
        app.terminate()
    }

    func reopenPaidWallet(name: String) {
        app.terminate()
        app.launch()
        openPaidWallet(name: name)
    }

    func testTowerRestore() { openPaidWallet(name: walletName, expectIncomplete: true) }

    private func openPaidWallet(name: String, expectIncomplete: Bool = false) {
        XCTAssertTrue(app.buttons["brainvault-open"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["wallet-balance"].exists)
        capture("07-relaunched-locked")
        tap(app.buttons["brainvault-open"])
        let username = app.textFields["brainvault-name"]
        XCTAssertTrue(username.waitForExistence(timeout: 5))
        XCTAssertEqual(username.value as? String, "")
        username.tap()
        username.typeText(name)
        let password = app.secureTextFields["brainvault-password"]
        password.tap()
        password.typeText("Public test wallet 2026!")
        app.swipeUp()
        tap(app.buttons["brainvault-submit"])
        XCTAssertTrue(app.staticTexts["wallet-balance"].waitForExistence(timeout: 30), app.debugDescription)
        XCTAssertTrue(app.buttons["brainvault-submit"].waitForNonExistence(timeout: 5))
        XCTAssertEqual(app.staticTexts["token-USDC"].label, ui("98.999998", "98,999998"))
        capture("08-recovered-balance")
        tap(app.tabBars.buttons[ui("Activity", "История")])
        if expectIncomplete {
            XCTAssertTrue(app.staticTexts["history-incomplete"].waitForExistence(timeout: 10), app.debugDescription)
            XCTAssertFalse(app.staticTexts[ui("No activity on this page.", "На этой странице нет операций.")].exists)
            capture("09-history-incomplete-disclosed")
        }
        let sent = app.staticTexts.matching(identifier: ui("Sent", "Отправлено"))
        XCTAssertTrue(sent.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertEqual(sent.count, 1, "Reopening must not duplicate the payment")
        XCTAssertTrue(app.staticTexts[ui("Confirmed", "Подтверждено")].firstMatch.exists)
        XCTAssertTrue(app.staticTexts[ui("1.000001 USDC", "1,000001 USDC")].exists)
        capture("09-recovered-payment-history")
    }
}
