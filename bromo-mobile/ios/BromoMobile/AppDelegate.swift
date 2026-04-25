import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import GoogleMaps

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()
    if let mapsApiKey = Bundle.main.object(forInfoDictionaryKey: "GoogleMapsAPIKey") as? String,
       mapsApiKey.isEmpty == false {
      GMSServices.provideAPIKey(mapsApiKey)
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "BromoMobile",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // Physical device: set `metroHost` in `bromo-config.json` to your Mac’s LAN IPv4
    // (run `npm run metro:sync-ip`, or `METRO_LAN_HOST=192.168.1.12 npm run metro:sync-ip`), then rebuild.
    // Invalid / placeholder values are ignored so we fall back to the default packager URL.
    if let host = Self.metroHostFromBundledConfig(), Self.isPlausibleMetroHost(host),
       let override = URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false") {
      return override
    }
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  private static func metroHostFromBundledConfig() -> String? {
    guard let url = Bundle.main.url(forResource: "bromo-config", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          let host = obj["metroHost"] as? String
    else { return nil }
    let trimmed = host.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  /// Rejects doc placeholders like `192.168.x.x` and other non-IPv4 / non-hostname junk.
  private static func isPlausibleMetroHost(_ host: String) -> Bool {
    let h = host.trimmingCharacters(in: .whitespacesAndNewlines)
    if h.isEmpty { return false }
    let lower = h.lowercased()
    if lower == "localhost" { return true }
    if lower.contains("x.x") { return false }

    let ipv4 = #"^(\d{1,3}\.){3}\d{1,3}$"#
    if h.range(of: ipv4, options: .regularExpression) != nil {
      let parts = h.split(separator: ".").compactMap { Int($0) }
      guard parts.count == 4 else { return false }
      return parts.allSatisfy { (0 ... 255).contains($0) }
    }

    let hostname = #"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$"#
    return h.range(of: hostname, options: .regularExpression) != nil
  }
}
