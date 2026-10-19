# Firefox OneNote Quick Save

Send text you select or an image of the selected area in Firefox to a new page
in the **OneNote desktop app on Windows**. Page titles use the active tab title.
No Azure app, Microsoft Graph permission, or separate Microsoft sign-in is
needed: the local OneNote desktop app handles the existing signed-in account.

## Install the extension

After Mozilla approves the AMO listing, install it from Firefox Add-ons:

**AMO listing:** to be added after approval.

Until then, `Firefox-OneNote-Quick-Save-v1.3.1.xpi` in the
[GitHub v1.3.1 release](https://github.com/slaweally/Firefox-OneNote-Quick-Save/releases/tag/v1.3.1)
is an **unsigned AMO submission package**, not a directly installable release
for regular Firefox. Submit that XPI through the AMO Developer Hub. Firefox
will install the signed version after Mozilla review. For local testing before
then, download the source ZIP from the same release, install the bridge below,
open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**,
and select the extracted `manifest.json`. Temporary add-ons must be loaded
again after Firefox restarts.

## Connect the local OneNote bridge

Requirements: Windows, Firefox 142+, and the OneNote desktop app.

Run this command in PowerShell:

```powershell
irm https://raw.githubusercontent.com/slaweally/Firefox-OneNote-Quick-Save/main/install.ps1 | iex
```

The installer downloads the bridge source from this repository, compiles it
using the Windows .NET Framework compiler, and registers a Firefox
Native Messaging host for the current Windows user. No administrator access
or prebuilt executable download is needed. Restart Firefox after setup.

The helper and Firefox extension communicate locally through Firefox Native
Messaging. The helper uses the OneNote desktop COM interface to list sections
and create pages. Keep the OneNote desktop app installed and signed in. The
helper is Windows-only and is separate from the AMO extension package.
Firefox may ask you to consent to processing website content. This refers to
content you explicitly select or enter and send through the extension to your
local OneNote app; this project does not operate a cloud service for that data.

## Use it

1. Open the extension and choose **Türkçe** or **English** the first time.
2. Select webpage text, right-click, then choose **Send to OneNote** and a
   section. For an image, choose **Send selected area as an image…** and a
   section.
3. Or open the popup to choose a section, edit a note, add selected text or an
   image, and save.

The page title is taken from the active Firefox tab. The extension stores the
language and selected destination section in Firefox local extension storage.

## Build packages

```powershell
.\package-xpi.ps1
```

Builds the Firefox add-on package under `dist`. To create both the XPI and the
source ZIP for GitHub:

```powershell
.\package-release.ps1
```

The XPI contains only extension files; the source ZIP also contains the
Windows bridge source and installer. The XPI produced locally is unsigned until
Mozilla signs it.

## Permissions and data

- `activeTab` and `scripting`: read the selected text and its visible bounds
  after the user invokes an extension action.
- `contextMenus`: provide the OneNote right-click actions.
- `nativeMessaging`: send the selected content to the separately installed
  local OneNote bridge.
- `storage`: save the language and destination-section preference locally.
- `notifications`: show whether a send succeeded or failed.

Selected text, screenshots, and notes are passed to the OneNote desktop app on
this computer. This extension does not send them to its developer or to a
service operated by this project, and it does not read Firefox saved passwords
or autofill data. OneNote may sync content according to the user's Microsoft
account and OneNote settings. Review the extension source and the [Mozilla
Add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/).

## Firefox OneNote Quick Save (Türkçe)

Firefox'ta seçtiğiniz metni veya seçili alanın görüntüsünü, **Windows OneNote
masaüstü uygulamasında** yeni bir sayfaya gönderir. Sayfa başlığı etkin
sekmeden alınır. Azure uygulaması, Microsoft Graph izni veya ayrıca Microsoft
hesabına giriş gerekmez; masaüstü OneNote uygulamasında zaten açık olan hesap
kullanılır.

### Eklentiyi yükleme

Mozilla AMO listelemesini onayladıktan sonra eklentiyi Firefox Eklentileri'nden
yükleyebilirsiniz:

**AMO sayfası:** Onaydan sonra eklenecek.

O zamana kadar [GitHub v1.3.1 sürümündeki
`Firefox-OneNote-Quick-Save-v1.3.1.xpi`](https://github.com/slaweally/Firefox-OneNote-Quick-Save/releases/tag/v1.3.1),
**AMO'ya gönderilmek üzere hazırlanmış imzasız pakettir**; normal Firefox'a
doğrudan kalıcı olarak yüklenemez. XPI dosyasını AMO Developer Hub üzerinden
Mozilla'ya gönderin. İnceleme sonrasında Firefox imzalı sürümü yükleyebilir.
İnceleme öncesi yerel deneme için aynı sürümün kaynak ZIP dosyasını indirin,
aşağıdaki köprüyü kurun, `about:debugging#/runtime/this-firefox` adresini açın,
**Geçici Eklenti Yükle…** düğmesine basın ve açılmış kaynak klasöründeki
`manifest.json` dosyasını seçin. Geçici eklentiyi Firefox yeniden başladıktan
sonra tekrar yüklemek gerekir.

### OneNote yerel bağlantısını kurma

Gereksinimler: Windows, Firefox 142 veya üzeri ve OneNote masaüstü uygulaması.

PowerShell'de şu komutu çalıştırın:

```powershell
irm https://raw.githubusercontent.com/slaweally/Firefox-OneNote-Quick-Save/main/install.ps1 | iex
```

Kurulum betiği bu depodan köprü kaynak kodunu indirir, Windows .NET Framework
derleyicisini kullanarak derler ve geçerli Windows kullanıcısı için Firefox
Native Messaging kaydını yapar. Yönetici izni veya önceden derlenmiş bir EXE
indirmez. Kurulumdan sonra Firefox'u yeniden başlatın.

Yardımcı uygulama ile Firefox eklentisi, Firefox Native Messaging üzerinden
bu bilgisayarda haberleşir. Yardımcı, OneNote masaüstü COM arayüzünü kullanarak
bölümleri listeler ve sayfalar oluşturur. OneNote masaüstü uygulaması kurulu ve
hesabınız açık olmalıdır. Yardımcı Windows'a özeldir ve AMO eklenti paketinden
ayrı kurulur.

Firefox, web sitesi içeriğinin işlenmesi için onay isteyebilir. Bu açıklama,
eklentiyle açıkça seçip veya girip yerel OneNote uygulamanıza gönderdiğiniz
içeriği kapsar; proje bu veriler için bulut servisi işletmez.

### Kullanım

1. Eklentiyi açıp ilk kullanımda **Türkçe** veya **English** dilini seçin.
2. Web sayfasında metin seçip sağ tıklayın; **OneNote’a gönder** öğesinden
   bölümü seçin. Görüntü için **Seçili alanı görüntü olarak gönder…** öğesini
   ve hedef bölümü seçin.
3. Alternatif olarak eklenti penceresini açıp bölüm seçin, notu düzenleyin,
   seçili metin veya görüntüyü ekleyin ve kaydedin.

Yeni sayfanın başlığı etkin Firefox sekmesinden alınır. Dil ve hedef bölüm
tercihi Firefox'un yerel eklenti depolamasında tutulur.

### Paketleri oluşturma

```powershell
.\package-xpi.ps1
```

Firefox eklenti paketini `dist` klasörüne oluşturur. Hem XPI hem de GitHub
kaynak ZIP dosyasını oluşturmak için:

```powershell
.\package-release.ps1
```

XPI yalnızca eklenti dosyalarını; kaynak ZIP'i ise Windows köprüsünün kaynak
kodunu ve kurulum betiğini de içerir. Yerel olarak üretilen XPI, Mozilla
imzalayana kadar imzasızdır.

### İzinler ve veriler

- `activeTab` ve `scripting`: kullanıcı eklenti eylemini başlattığında seçili
  metni ve ekrandaki sınırlarını okumak için.
- `contextMenus`: sağ tık OneNote eylemlerini sunmak için.
- `nativeMessaging`: seçilen içeriği ayrıca kurulan yerel OneNote köprüsüne
  göndermek için.
- `storage`: dili ve hedef bölüm tercihini yerel olarak saklamak için.
- `notifications`: gönderimin başarılı veya başarısız olduğunu bildirmek için.

Seçilen metin, görüntü ve notlar bu bilgisayardaki OneNote masaüstü
uygulamasına iletilir. Eklenti bunları geliştiriciye veya bu projeye ait bir
servise göndermez; Firefox kayıtlı parolalarını ve otomatik doldurma verilerini
okumaz. OneNote, içeriği kullanıcının Microsoft hesabı ve OneNote ayarlarına
göre eşitleyebilir. Ayrıntı için [eklenti kaynak kodunu](.) ve
[Mozilla Eklenti Politikalarını](https://extensionworkshop.com/documentation/publish/add-on-policies/)
inceleyin.
