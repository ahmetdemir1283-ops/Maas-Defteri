# Mesai Defteri — telefon deneme sürümleri

## Android

- `MesaiDefteri-Android-debug.apk` dosyasını telefona indirin veya USB kablosuyla telefona kopyalayın.
- Android, Play Store dışından ilk kurulumda bu dosyayı açan tarayıcı/dosya yöneticisi için **Bilinmeyen uygulamaları yükle** izni isteyebilir. İzni verip APK’yı yeniden açın.
- Uygulamayı açın. Hatırlatıcıları Ayarlar > Hatırlatıcı bölümünden açıp bildirim iznini verin. **Bildirimi dene** ile deneme bildirimi gönderin.

Bu, telefona doğrudan kurulabilen debug imzalı deneme APK’sıdır. Google Play’e yayınlamak için ayrı release imzası ve Play Console gerekir.

## iPhone

Geçici iPhone denemesi için Safari’de şu adresi açın:

**https://mesai-defteri-ios-test.pages.dev/**

Safari’de **Paylaş > Ana Ekrana Ekle > Ekle** adımlarını izleyin ve uygulamayı yeni ana ekran simgesinden açın. Veriler bu iPhone’daki Safari/PWA alanında saklanır; başka cihaza kendiliğinden eşitlenmez. Site güncellendiğinde uygulamayı tamamen kapatıp yeniden açın.

Bu, App Store’dan yüklenen yerel IPA değildir. Depodaki `ios/App/App.xcodeproj` Xcode projesini açmak için kullanılır; yerel IPA üretmek için Mac, Xcode ve Apple imzalama erişimi gerekir.

## Bildirim testi

Web denemesinde Ayarlar > Hatırlatıcı > **Bildirim izni** ile izin verip **Bildirimi dene** düğmesine basın. iOS’ta bildirim izni ana ekrana eklenen web uygulamasında desteklenir; günlük hatırlatıcıların uygulama kapalıyken çalışması için yerel iOS uygulaması gerekir. Android APK için deneme bildirimi uygulama içinden gönderilebilir.
