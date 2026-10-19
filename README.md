# Firefox OneNote Quick Save

Save selected Firefox text or a selected on-screen area to a new page in the
Windows OneNote desktop app. The page title comes from the active tab.
Everything is sent through the local OneNote desktop automation interface;
the extension does not use Azure, Microsoft Graph, or a web service.

## Quick install from GitHub

Requirements: Windows, Firefox 128+, and the OneNote desktop app.

Open PowerShell and run:

```powershell
irm https://raw.githubusercontent.com/slaweally/one-note-firefox-sync/main/install.ps1 | iex
```

The setup downloads the latest GitHub source, installs the local OneNote
bridge for the current Windows user, and opens Firefox's temporary-add-on
page. Finish the one Firefox step by choosing **Load Temporary Add-on…** and
selecting the `manifest.json` path printed by the installer.

Firefox requires add-ons to be Mozilla-signed for persistent installation.
Until this add-on is signed and listed on AMO, Firefox requires loading it as a
temporary add-on again after a browser restart. See
[Mozilla's signing and distribution guide](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

## Choose your language

On first launch, choose **Türkçe** or **English**. The choice is saved on this
computer and applies to the extension popup, right-click menus, and notices.
Change it later from the popup's language selector.

## Use it

- Select text in a webpage, right-click, then choose **Send to OneNote**,
  **Send selected text…**, and the destination notebook section.
- For a screenshot, choose **Send selected area as an image…** and the
  destination section. The selected area is added to a new OneNote page.
- Or open the extension popup to select a default section, edit a note, add
  selected text or an image, and save.

The active Firefox tab title is used as the new OneNote page title.

## Build a source package

```powershell
.\package-release.ps1
```

The versioned source archive is created under `dist`. It contains the
installer and native-host source, not a precompiled executable.

## Privacy

Only content explicitly selected or entered by the user is sent to the local
OneNote desktop app. The add-on does not read Firefox saved passwords or
autofill data, and it does not upload notes to a web service.

## Firefox OneNote Quick Save (Türkçe)

Seçtiğiniz Firefox metnini veya ekrandaki seçili alanı, Windows OneNote masaüstü
uygulamasında yeni bir sayfaya kaydeder. Sayfa başlığı etkin sekmenin
başlığından alınır. Eklenti Azure, Microsoft Graph veya web servisi kullanmaz;
OneNote'a yerel masaüstü otomasyon arayüzünden bağlanır.

### GitHub üzerinden hızlı kurulum

Gereksinimler: Windows, Firefox 128 veya üzeri ve OneNote masaüstü uygulaması.

PowerShell'i açıp şu tek komutu çalıştırın:

```powershell
irm https://raw.githubusercontent.com/slaweally/one-note-firefox-sync/main/install.ps1 | iex
```

Kurulum, GitHub'dan güncel kaynak kodunu indirir, yerel OneNote bağlantısını
geçerli Windows kullanıcısı için kurar ve Firefox'un geçici eklenti sayfasını
açar. Firefox'ta **Geçici Eklenti Yükle…** düğmesine basıp kurulumun yazdırdığı
`manifest.json` dosyasını seçerek kurulumu tamamlayın.

Kalıcı kurulum için Firefox eklentisinin Mozilla tarafından imzalanması
gerekir. AMO imzası ve listelemesi tamamlanana kadar Firefox geçici eklentiyi
tarayıcı her yeniden başladığında tekrar yüklemeyi ister. Ayrıntı:
[Mozilla imzalama ve dağıtım rehberi](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

### Dil seçimi

Eklentiyi ilk açtığınızda **Türkçe** veya **English** seçin. Tercih bu
bilgisayara kaydedilir ve eklenti penceresi, sağ tık menüleri ile bildirimlere
uygulanır. Dili daha sonra eklenti penceresinden değiştirebilirsiniz.

### Kullanım

- Web sayfasında metin seçip sağ tıklayın. **OneNote’a gönder**, **Seçili metni
  gönder…** ve hedef defter bölümünü seçin.
- Görüntü için **Seçili alanı görüntü olarak gönder…** öğesini ve hedef bölümü
  seçin. Görüntü OneNote'ta yeni bir sayfaya eklenir.
- Alternatif olarak eklenti penceresini açıp varsayılan bölümü seçin, notu
  düzenleyin, seçili metni veya görüntüyü ekleyin ve kaydedin.

Yeni OneNote sayfa başlığı etkin Firefox sekmesinin başlığıdır.

### Kaynak paketi

```powershell
.\package-release.ps1
```

Sürümlenmiş kaynak paketi `dist` klasörüne yazılır. Pakete derlenmiş çalıştırılabilir
dosya değil, yerel kurulum betiği ve yardımcı programın kaynak kodu eklenir.

### Gizlilik

Yalnızca kullanıcının açıkça seçtiği veya girdiği içerik yerel OneNote
uygulamasına gönderilir. Eklenti Firefox kayıtlı parolalarını ya da otomatik
doldurma verilerini okumaz ve notları bir web servisine yüklemez.
