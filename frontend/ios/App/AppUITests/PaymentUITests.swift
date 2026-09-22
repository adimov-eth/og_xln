import XCTest

final class PaymentUITests: XCTestCase {
    let app = XCUIApplication()
    let walletName = ProcessInfo.processInfo.environment["XLN_UI_WALLET_NAME"] ?? "ios-" + UUID().uuidString.lowercased()
    private var russian: Bool { ProcessInfo.processInfo.environment["XLN_UI_LANGUAGE"] == "ru" }
    private var numberLocale: Locale { Locale(identifier: russian ? "ru_RU" : "en_US_POSIX") }
    func ui(_ english: String, _ russian: String) -> String { self.russian ? russian : english }
    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launchArguments = ["-AppleLanguages", russian ? "(ru)" : "(en)",
                               "-AppleLocale", russian ? "ru_RU" : "en_US"]
        app.launch()
    }

    func testSecurePasswordEntry() {
        tap(app.buttons["brainvault-create"])
        let password = app.secureTextFields["brainvault-password"]
        password.tap()
        password.typeText("a")
        password.typeText("b")
        password.typeText("Public test wallet 2026!")
        tap(app.buttons["Show password"])
        XCTAssertEqual(app.textFields["brainvault-password"].value as? String, "abPublic test wallet 2026!")
        let name = app.textFields["brainvault-name"]
        name.tap()
        name.typeText("input-regression")
        app.swipeUp()
        tap(app.buttons["brainvault-submit"])
        let confirmation = app.secureTextFields["brainvault-confirmation"]
        XCTAssertTrue(confirmation.waitForExistence(timeout: 5))
        confirmation.tap()
        confirmation.typeText("mismatch")
        XCTAssertFalse(app.buttons["brainvault-submit"].isEnabled)
        tap(app.buttons["Back"])
        tap(app.buttons["Show password"])
        XCTAssertEqual(app.textFields["brainvault-password"].value as? String, "abPublic test wallet 2026!")
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.secureTextFields["brainvault-password"].waitForExistence(timeout: 5))
        XCTAssertEqual(app.secureTextFields["brainvault-password"].value as? String, "Your password")
    }

    func testOnboardingAccessibility() throws {
        continueAfterFailure = true
        XCTAssertTrue(app.buttons["brainvault-create"].waitForExistence(timeout: 10))
        capture("ux-welcome")
        try app.performAccessibilityAudit()
        tap(app.buttons["brainvault-create"])
        XCTAssertTrue(app.textFields["brainvault-name"].waitForExistence(timeout: 5))
        capture("ux-create-wallet")
        try app.performAccessibilityAudit()
    }

    func testLargestTextEnglish() { checkLargestText(language: "en", locale: "en_US") }
    func testLargestTextRussian() { checkLargestText(language: "ru", locale: "ru_RU") }

    private func checkLargestText(language: String, locale: String) {
        app.terminate()
        app.launchArguments = ["-AppleLanguages", "(\(language))", "-AppleLocale", locale,
                               "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryL"]
        app.launch()
        let title = app.staticTexts["welcome-title"]
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        let normalHeight = title.frame.height
        app.terminate()
        app.launchArguments[app.launchArguments.count - 1] = "UICTContentSizeCategoryAccessibilityXXXL"
        app.launch()
        XCTAssertTrue(title.waitForExistence(timeout: 10))
        XCTAssertGreaterThan(title.frame.height, normalHeight * 1.3, "Large text must actually be active")
        capture("ux-\(language)-largest-welcome")
        reveal(app.buttons["brainvault-create"])
        capture("ux-\(language)-largest-actions")
        tap(app.buttons["brainvault-create"])
        let name = app.textFields["brainvault-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        capture("ux-\(language)-largest-create")
        reveal(name)
        name.tap()
        name.typeText("layout-check")
        let password = app.secureTextFields["brainvault-password"]
        reveal(password)
        password.tap()
        password.typeText("Public layout check 2026!")
        reveal(app.buttons["brainvault-submit"])
        XCTAssertTrue(app.buttons["brainvault-submit"].isEnabled)
        capture("ux-\(language)-largest-continue")
        tap(app.buttons["brainvault-submit"])
        XCTAssertTrue(app.secureTextFields["brainvault-confirmation"].waitForExistence(timeout: 5))
    }

    private func reveal(_ element: XCUIElement) {
        for _ in 0..<8 {
            if !element.exists { app.swipeUp(); continue }
            if element.isHittable { return }
            let viewport = app.windows.firstMatch.frame
            let frame = element.frame
            if frame.midY < viewport.midY { app.swipeDown() }
            else { app.swipeUp() }
        }
        XCTAssertTrue(element.isHittable, "Required control must remain reachable: \(element)")
    }

    func testCustodyInvoicePayment() throws { try checkPayment(backup: false) }
    func testPaymentBackup() throws { try checkPayment(backup: true) }
    private func checkPayment(backup: Bool) throws {
        let invoice = try XCTUnwrap(ProcessInfo.processInfo.environment["XLN_UI_INVOICE"])
        try createWallet()
        try fundWallet()
        tap(app.buttons["wallet-send"])
        if !backup {
            tap(app.buttons[ui("Scan QR code", "Сканировать QR-код")])
            XCTAssertTrue(app.staticTexts[ui("Camera unavailable", "Камера недоступна")].waitForExistence(timeout: 10))
            XCTAssertFalse(app.buttons[ui("Open Settings", "Открыть настройки")].exists)
            capture("02-camera-unavailable")
            try app.performAccessibilityAudit()
            tap(app.buttons["scanner-use-link"])
        }
        let recipient = app.textFields["operation-recipient"]
        XCTAssertTrue(recipient.waitForExistence(timeout: 10))
        recipient.tap()
        recipient.typeText(invoice)
        app.swipeUp()
        tap(app.buttons[ui("Read payment request", "Прочитать платёжный запрос")])
        tap(app.buttons["review-operation"])
        let maximum = app.staticTexts["review-maximum"]
        XCTAssertTrue(maximum.waitForExistence(timeout: 15))
        XCTAssertTrue(maximum.isHittable, "Review must start with the payment amounts visible")
        XCTAssertTrue(app.staticTexts[ui("They receive", "Получателю")].waitForExistence(timeout: 15))
        XCTAssertTrue(app.staticTexts[ui("1.000002 USDC", "1,000002 USDC")].exists)
        XCTAssertTrue(app.staticTexts[ui("They receive, 1.000001 USDC", "Получателю, 1,000001 USDC")].exists)
        XCTAssertTrue(app.staticTexts[ui("Maximum fee, 0.000001 USDC", "Комиссия не более, 0,000001 USDC")].exists)
        capture("03-payment-review")
        if !backup { try app.performAccessibilityAudit() }
        app.swipeUp()
        reveal(app.buttons["confirm-operation"])
        tap(app.buttons["confirm-operation"])
        tap(app.buttons[ui("Done", "Готово")], timeout: 20)
        let balance = app.staticTexts["token-USDC"]
        let paid = NSPredicate(format: "label == %@", ui("98.999998", "98,999998"))
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: paid, evaluatedWith: balance)], timeout: 20), .completed)
        capture("04-payment-debited")
        tap(app.tabBars.buttons[ui("Activity", "История")])
        XCTAssertTrue(app.staticTexts[ui("Sent", "Отправлено")].firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts[ui("Confirmed", "Подтверждено")].firstMatch.waitForExistence(timeout: 5))
        capture("05-payment-activity")
        if backup { verifyPaidBackup(); return }
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.buttons["brainvault-open"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["wallet-balance"].exists)
        capture("06-background-locked")
        reopenPaidWallet(name: walletName)
    }
    func testMarketSwap() throws { try checkSwap(fromOrderbook: false) }
    func testOrderbookLimitBuy() throws { try checkSwap(fromOrderbook: true) }

    private func checkSwap(fromOrderbook: Bool) throws {
        try createWallet()
        try fundWallet()
        if fromOrderbook {
            tap(app.tabBars.buttons[ui("Market", "Рынок")])
            let ask = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "market-buy-")).firstMatch
            XCTAssertTrue(ask.waitForExistence(timeout: 15))
            let ticks = try XCTUnwrap(Decimal(string: String(ask.identifier.dropFirst("market-buy-".count))))
            capture("03-live-orderbook")
            tap(ask)
            let price = app.textFields["order-price"]
            XCTAssertTrue(price.waitForExistence(timeout: 5))
            let displayedPrice = try XCTUnwrap(price.value as? String)
            XCTAssertEqual(Decimal(string: displayedPrice, locale: numberLocale), ticks / 10_000)
        } else { tap(app.buttons["wallet-swap"]) }
        let amount = app.textFields["operation-amount"]
        XCTAssertTrue(amount.waitForExistence(timeout: 5))
        amount.tap()
        amount.typeText(fromOrderbook ? ui("0.009", "0,009") : "25")
        app.swipeUp()
        tap(app.buttons["review-operation"])
        XCTAssertTrue(app.staticTexts[ui("Minimum received", "Получите не меньше")].waitForExistence(timeout: 15))
        capture("03-swap-review")
        app.swipeUp()
        let prepare = app.buttons[ui("Prepare receiving capacity", "Подготовить получение")]
        // A fresh wallet must prepare WETH capacity. Off-screen lazy rows are
        // not absent consent: scroll to the switch before preparing it.
        let credit = app.switches[ui("Allow unsecured test credit", "Разрешить тестовый кредит без обеспечения")]
        enable(credit)
        tap(prepare)
        reveal(app.buttons["confirm-operation"])
        tap(app.buttons["confirm-operation"], timeout: 20)
        tap(app.buttons[ui("View order result", "Посмотреть результат ордера")], timeout: 20)
        XCTAssertTrue(app.staticTexts[ui("Status, Closed", "Статус, Закрыт")].waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.staticTexts[ui("Received before fee", "Получено до комиссии")].exists)
        XCTAssertTrue(app.staticTexts[ui("Fee", "Комиссия")].exists)
        let gave = try receiptAmount(ui("Gave", "Отдано"), symbol: "USDC")
        let gross = try receiptAmount(ui("Received before fee", "Получено до комиссии"), symbol: "WETH")
        let fee = try receiptAmount(ui("Fee", "Комиссия"), symbol: "WETH")
        XCTAssertGreaterThan(gave, 0)
        XCTAssertGreaterThan(gross, fee)
        XCTAssertGreaterThanOrEqual(fee, 0)
        capture("04-swap-filled")
        tap(app.navigationBars.buttons["BackButton"])
        tap(app.buttons[ui("Done", "Готово")])
        if fromOrderbook { tap(app.tabBars.buttons[ui("Home", "Главная")]) }
        let weth = app.staticTexts["token-WETH"]
        XCTAssertTrue(weth.waitForExistence(timeout: 10))
        let received = try XCTUnwrap(Decimal(string: weth.label, locale: numberLocale))
        let remaining = try XCTUnwrap(Decimal(string: app.staticTexts["token-USDC"].label, locale: numberLocale))
        XCTAssertGreaterThan(received, 0)
        XCTAssertGreaterThanOrEqual(remaining, 75)
        XCTAssertLessThan(remaining, 100)
        XCTAssertEqual(remaining, 100 - gave)
        XCTAssertEqual(received, gross - fee)
        XCTAssertEqual(app.staticTexts["wallet-balance"].label, app.staticTexts["token-USDC"].label)
        capture("05-swap-balances")
        tap(app.buttons["balance-asset"])
        tap(app.buttons["balance-choice-WETH"])
        XCTAssertEqual(app.staticTexts["wallet-balance"].label, weth.label, app.debugDescription)
        XCTAssertFalse(app.staticTexts["Estimated total"].exists)
        capture("06-weth-balance")
    }

    private func receiptAmount(_ title: String, symbol: String) throws -> Decimal {
        let prefix = title + ", "
        let row = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", prefix)).firstMatch
        XCTAssertTrue(row.exists)
        XCTAssertTrue(row.label.hasSuffix(" " + symbol))
        let value = row.label.dropFirst(prefix.count).dropLast(symbol.count + 1)
        return try XCTUnwrap(Decimal(string: String(value), locale: numberLocale))
    }
    func testDefaultBrainvault() throws {
        try createWallet()
        capture("default-brainvault-ready")
    }
    private func createWallet() throws {
        tap(app.buttons["brainvault-create"])
        let name = app.textFields["brainvault-name"]
        XCTAssertTrue(name.waitForExistence(timeout: 5))
        name.tap()
        name.typeText(walletName)
        let password = app.secureTextFields["brainvault-password"]
        password.tap()
        password.typeText("Public test wallet 2026!")
        tap(app.buttons[ui("Show password", "Показать пароль")])
        XCTAssertEqual(app.textFields["brainvault-password"].value as? String, "Public test wallet 2026!")
        app.swipeUp()
        capture("01-create-brainvault")
        tap(app.buttons["brainvault-submit"])
        let confirmation = app.secureTextFields["brainvault-confirmation"]
        XCTAssertTrue(confirmation.waitForExistence(timeout: 5))
        confirmation.tap()
        confirmation.typeText("Public test wallet 2026!")
        app.swipeUp()
        let start = ProcessInfo.processInfo.systemUptime
        tap(app.buttons["brainvault-submit"])
        let ready = app.staticTexts["wallet-balance"].waitForExistence(timeout: 100)
        let evidence = "DEFAULT_BRAINVAULT_SUBMIT_TO_READY_SECONDS=\(ProcessInfo.processInfo.systemUptime - start) ready=\(ready)"
        print(evidence)
        let attachment = XCTAttachment(string: evidence)
        attachment.lifetime = .keepAlways
        add(attachment)
        XCTAssertTrue(ready, app.debugDescription)
    }

    private func fundWallet() throws {
        app.swipeUp()
        tap(app.buttons.containing(.staticText, identifier: ui("Try it with test money", "Попробуйте с тестовыми деньгами")).firstMatch)
        let credit = app.switches[ui("Allow unsecured test credit", "Разрешить тестовый кредит без обеспечения")]
        XCTAssertTrue(credit.waitForExistence(timeout: 5))
        enable(credit)
        tap(app.buttons["get-test-money"])
        tap(app.buttons[ui("Done", "Готово")], timeout: 25)
        let funded = NSPredicate(format: "label == %@", "100")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: funded, evaluatedWith: app.staticTexts["token-USDC"])], timeout: 15), .completed)
        app.swipeDown()
        capture("02-funded-wallet")
    }

    func enable(_ toggle: XCUIElement) {
        // A partly visible label can be hittable while the actual switch is off screen.
        for _ in 0..<8 {
            if toggle.exists {
                let frame = toggle.frame
                let point = CGPoint(x: frame.minX + frame.width * 0.9, y: frame.midY)
                if toggle.isHittable && app.windows.firstMatch.frame.insetBy(dx: 0, dy: 80).contains(point) {
                    toggle.coordinate(withNormalizedOffset: CGVector(dx: 0.9, dy: 0.5)).tap()
                    XCTAssertEqual(toggle.value as? String, "1", app.debugDescription)
                    return
                }
            }
            app.swipeUp()
        }
        XCTFail("Consent switch must be visible and operable", file: #filePath, line: #line)
    }

    func tap(_ element: XCUIElement, timeout: TimeInterval = 15) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), app.debugDescription)
        let enabled = NSPredicate(format: "enabled == true")
        XCTAssertEqual(XCTWaiter.wait(for: [expectation(for: enabled, evaluatedWith: element)], timeout: timeout), .completed)
        reveal(element)
        element.tap()
    }

    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
