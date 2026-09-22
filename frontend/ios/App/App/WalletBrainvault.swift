import SwiftUI

struct WalletBrainvault: View {
    @ObservedObject var model: WalletModel
    var creating = false
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var name = ""
    @State private var password = ""
    @State private var confirmation = ""
    @State private var factor = 3
    @State private var customShards = ""
    @State private var showingSettings = false
    @State private var showingPassword = false
    // Separate entry and confirmation: iOS AutoFill edited both simultaneous
    // secure fields and reduced the entered secret to its final character.
    @State private var confirming = false
    @FocusState private var focused: Field?
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize = 28.0
    private enum Field { case name, password, visiblePassword, confirmation }
    // Palette and mark match frontend runtime-creation.css / img/logo.png.
    private var accent: Color { WalletStyle.accent }
    private var pageColor: Color { colorScheme == .dark ? Color(red: 0.025, green: 0.02, blue: 0.015) : Color(red: 0.953, green: 0.961, blue: 0.976) }
    private var cardColor: Color { colorScheme == .dark ? Color(red: 0.04, green: 0.032, blue: 0.024) : .white }
    private var fieldColor: Color { colorScheme == .dark ? .black.opacity(0.6) : Color(red: 0.973, green: 0.98, blue: 0.988) }

    private var validWork: Bool {
        customShards.isEmpty || (Int(customShards).map { $0 >= 6 } ?? false)
    }
    private var canContinue: Bool {
        !model.busy && !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !password.isEmpty && validWork
    }
    private var canSubmit: Bool { canContinue && (!creating || password == confirmation) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    Image("XlnMark").resizable().scaledToFit().frame(width: 76, height: 66)
                        .foregroundStyle(Color.primary.opacity(0.85)).accessibilityLabel("xln")
                    VStack(alignment: .leading, spacing: 24) {
                        header
                        credentials
                        if !confirming { Button { focused = nil; showingSettings = true } label: {
                            HStack(spacing: 6) {
                                Text("Recovery settings")
                                if factor != 3 || !customShards.isEmpty {
                                    Image(systemName: "circle.fill").font(.system(size: 5))
                                }
                                Image(systemName: "chevron.right").font(.caption2.weight(.semibold))
                            }.font(.subheadline).foregroundStyle(.primary)
                                .frame(minHeight: 44).contentShape(Rectangle())
                        }.buttonStyle(.plain).disabled(model.busy)
                            .accessibilityIdentifier("brainvault-settings") }
                        if let error = model.error {
                            Label { Text(WalletL10n.text(error)).textSelection(.enabled) }
                                icon: { Image(systemName: "exclamationmark.circle") }
                                .font(.subheadline).foregroundStyle(.red).fixedSize(horizontal: false, vertical: true)
                                .accessibilityIdentifier("brainvault-error")
                        }
                        if model.busy {
                            HStack(spacing: 12) {
                                ProgressView()
                                Text(WalletL10n.text(model.progress)).font(.subheadline).foregroundStyle(.secondary)
                            }.accessibilityIdentifier("brainvault-progress")
                        }
                        action
                    }.padding(24).background(cardColor, in: .rect(cornerRadius: 24))
                        .overlay { RoundedRectangle(cornerRadius: 24).strokeBorder(accent.opacity(colorScheme == .dark ? 0.20 : 0.08)) }
                    Label("Your password stays on this iPhone.", systemImage: "lock")
                        .font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                }.frame(maxWidth: 480, alignment: .leading).padding(.horizontal, 20).padding(.top, 18).padding(.bottom, 28)
                    .frame(maxWidth: .infinity)
            }.scrollDismissesKeyboard(.interactively)
                .defaultScrollAnchor(.bottom, for: .sizeChanges)
                .background(pageColor)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button { password = ""; confirmation = ""; model.error = nil; dismiss() } label: { Image(systemName: "xmark") }
                            .accessibilityLabel("Close").disabled(model.busy)
                    }
                }
        }.tint(accent).presentationDetents([.large]).presentationDragIndicator(.hidden)
            .interactiveDismissDisabled(model.busy)
            .sheet(isPresented: $showingSettings) { settings }
            .onAppear { model.error = nil }
            .onChange(of: model.snapshot != nil) { _, opened in if opened { password = ""; dismiss() } }
            .onChange(of: model.concealed) { _, hidden in if hidden { password = ""; confirmation = ""; showingPassword = false; confirming = false; focused = nil } }
            .onDisappear { password = ""; confirmation = ""; if !model.busy { model.error = nil } }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Brain Vault").font(.subheadline.weight(.semibold)).foregroundStyle(accent)
            Text(LocalizedStringKey(confirming ? "Confirm password" : creating ? "Create your wallet" : "Unlock your wallet")).font(.system(size: titleSize, weight: .semibold)).tracking(-0.6)
                .fixedSize(horizontal: false, vertical: true).accessibilityAddTraits(.isHeader)
            Text("Your name and private secret recreate the same wallet. No backup phrase is required.")
                .font(.subheadline).foregroundStyle(WalletStyle.secondaryText).fixedSize(horizontal: false, vertical: true)
        }
    }

    private var credentials: some View {
        VStack(alignment: .leading, spacing: 18) {
            if !confirming {
            VStack(alignment: .leading, spacing: 9) {
                Text("Name").font(.subheadline.weight(.medium))
                TextField("", text: $name)
                    .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .focused($focused, equals: .name).submitLabel(.next).onSubmit { focused = .password }
                    .padding(18).background(fieldBackground(.name))
                    .accessibilityLabel("Name").accessibilityIdentifier("brainvault-name")
            }
            VStack(alignment: .leading, spacing: 9) {
                Text("Password").font(.subheadline.weight(.medium))
                HStack(spacing: 0) {
                    ZStack {
                        TextField("Your password", text: $password)
                            .focused($focused, equals: .visiblePassword)
                            .opacity(showingPassword ? 1 : 0).disabled(!showingPassword).accessibilityHidden(!showingPassword)
                        SecureField("Your password", text: $password)
                            .focused($focused, equals: .password)
                            .opacity(showingPassword ? 0 : 1).disabled(showingPassword).accessibilityHidden(showingPassword)
                    }.textContentType(.password).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .submitLabel(creating ? .next : .go).onSubmit { advance() }
                        .padding(.leading, 18).padding(.vertical, 18)
                        .accessibilityLabel("Password").accessibilityIdentifier("brainvault-password")
                    Button {
                        let hadFocus = focused == .password || focused == .visiblePassword
                        showingPassword.toggle()
                        if hadFocus { focused = showingPassword ? .visiblePassword : .password }
                    } label: {
                        Image(systemName: showingPassword ? "eye.slash" : "eye")
                            .font(.system(size: 18)).foregroundStyle(.primary).frame(width: 52, height: 52)
                            .contentShape(Rectangle())
                    }.buttonStyle(.plain).accessibilityLabel(showingPassword ? "Hide password" : "Show password")
                }.background(fieldBackground(.password))
            }
            }
            if confirming {
                VStack(alignment: .leading, spacing: 9) {
                    Text("Confirm password").font(.subheadline.weight(.medium))
                    SecureField("Repeat your password", text: $confirmation)
                        .focused($focused, equals: .confirmation)
                        .textContentType(.password).textInputAutocapitalization(.never).autocorrectionDisabled()
                        .padding(18).background(fieldColor, in: .rect(cornerRadius: 12))
                        .accessibilityIdentifier("brainvault-confirmation")
                }
            }
        }.disabled(model.busy)
    }

    private func fieldBackground(_ field: Field) -> some View {
        RoundedRectangle(cornerRadius: 12).fill(fieldColor)
            .overlay { RoundedRectangle(cornerRadius: 12).strokeBorder((focused == field || (field == .password && focused == .visiblePassword)) ? accent : Color.primary.opacity(0.10), lineWidth: 1) }
    }

    private var action: some View {
        VStack(spacing: 14) {
            if model.busy {
                if model.brainvaultCancellable {
                    Button("Cancel") { Task { await model.cancelBrainvault() } }
                        .frame(minHeight: 52).frame(maxWidth: .infinity).buttonStyle(.glass)
                } else {
                    Text("Finishing wallet setup. Keep xln open.")
                        .font(.footnote).foregroundStyle(.secondary)
                        .accessibilityIdentifier("brainvault-finalizing")
                }
            } else {
                Button(action: advance) {
                    HStack {
                        Text(LocalizedStringKey(creating && !confirming ? "Continue" : creating ? "Create BrainVault" : "Open BrainVault"))
                            .font(.headline).frame(maxWidth: .infinity)
                            .fixedSize(horizontal: false, vertical: true)
                        if !typeSize.isAccessibilitySize { Image(systemName: "arrow.right").font(.headline).accessibilityHidden(true) }
                    }
                        .foregroundStyle((confirming ? canSubmit : canContinue) ? (colorScheme == .dark ? Color.black : Color.white) : Color.primary)
                        .padding(.vertical, 12).padding(.horizontal, 10)
                }.buttonStyle(.glassProminent).controlSize(.large).disabled(confirming ? !canSubmit : !canContinue)
                    .accessibilityIdentifier("brainvault-submit")
                if confirming { Button("Back") { confirmation = ""; confirming = false; focused = .password }.frame(minHeight: 44) }
                if creating {
                    Text("Creating saves an encrypted recovery copy with xln. Remember your name, password and work settings.")
                        .font(.footnote).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                }
            }
        }.frame(maxWidth: .infinity)
    }

    private var settings: some View {
        NavigationStack {
            Form {
                Section {
                    Text("Use the same work settings as when you created your BrainVault.")
                    Picker("Work factor", selection: $factor) {
                        Text("1 · Test").tag(1); Text("2 · Basic").tag(2); Text("3 · Standard").tag(3)
                        Text("4 · Strong").tag(4); Text("5 · Maximum").tag(5)
                    }.disabled(!customShards.isEmpty)
                    TextField("Custom shards (optional)", text: $customShards).keyboardType(.numberPad)
                        .accessibilityIdentifier("brainvault-shards")
                    if !validWork { Text("Enter at least 6 shards.").foregroundStyle(.red) }
                }
            }.navigationTitle("Recovery settings").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showingSettings = false }.disabled(!validWork) } }
        }.presentationDetents(typeSize.isAccessibilitySize ? [.large] : [.medium, .large])
    }

    private func advance() {
        if creating && !confirming {
            guard canContinue else { return }
            showingPassword = false; confirming = true; focused = .confirmation
        } else { submit() }
    }

    private func submit() {
        guard canSubmit else { return }
        focused = nil
        let enteredPassword = password
        let enteredConfirmation = confirmation
        password = ""; confirmation = ""; showingPassword = false
        Task { await model.openBrainvault(name: name, password: enteredPassword, factor: factor, shards: Int(customShards), creating: creating, confirmation: enteredConfirmation) }
    }
}
